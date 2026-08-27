import { StorageClient, StorageClientError, createStorageClient, validateFileContent, withTempDownload, withTempDownloads } from '../../src/storage/index';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/logger/context', () => ({
  getContext: jest.fn(() => ({ requestId: 'trace-storage-123' })),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BENTHAM_STORAGE_API_HMAC = 'test-storage-secret';
});

afterEach(() => {
  delete process.env.BENTHAM_STORAGE_API_HMAC;
});

function createClient(serviceName = 'test-service') {
  return new StorageClient({ serviceName });
}

describe('StorageClient', () => {
  describe('constructor', () => {
    it('uses default storage URL from config', () => {
      const client = createClient();
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );
      client.getSignedUrl('gs://bucket/file.pdf');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storage.bentham.legal/api/v1/files/signed_url',
        expect.anything(),
      );
    });

    it('allows overriding baseUrl', () => {
      const client = new StorageClient({
        serviceName: 'test',
        baseUrl: 'https://custom-storage.example.com',
      });
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );
      client.getSignedUrl('gs://bucket/file.pdf');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-storage.example.com/api/v1/files/signed_url',
        expect.anything(),
      );
    });

    it('allows overriding secretEnvVar', () => {
      process.env.CUSTOM_HMAC = 'custom-secret';
      const client = new StorageClient({
        serviceName: 'test',
        secretEnvVar: 'CUSTOM_HMAC',
      });
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );
      client.getSignedUrl('gs://bucket/file.pdf');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-service-id']).toBe('test');
      expect(headers['x-signature']).toHaveLength(64);
      delete process.env.CUSTOM_HMAC;
    });

    it('defaults timeout to 30000ms', () => {
      const client = createClient();
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );
      client.getSignedUrl('gs://bucket/file.pdf');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('allows overriding timeout', () => {
      const client = new StorageClient({ serviceName: 'test', timeout: 60_000 });
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );
      client.getSignedUrl('gs://bucket/file.pdf');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe('getSignedUrl', () => {
    it('posts to /api/v1/files/signed_url and returns the URL', async () => {
      const signedUrl = 'https://storage.googleapis.com/bucket/file.pdf?X-Goog-Signature=abc';
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: signedUrl } }), { status: 200 }),
      );

      const client = createClient();
      const result = await client.getSignedUrl('gs://bucket/file.pdf');

      expect(result).toBe(signedUrl);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storage.bentham.legal/api/v1/files/signed_url',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'gs://bucket/file.pdf' }),
        }),
      );
    });

    it('includes HMAC auth headers', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );

      const client = createClient('bentham-mca-api');
      await client.getSignedUrl('gs://bucket/file.pdf');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-service-id']).toBe('bentham-mca-api');
      expect(headers['x-signature']).toHaveLength(64);
      expect(headers['x-timestamp']).toMatch(/^\d+$/);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('includes trace header', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
      );

      const client = createClient();
      await client.getSignedUrl('gs://bucket/file.pdf');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-request-id']).toBe('trace-storage-123');
    });

    it('throws StorageClientError on non-2xx response', async () => {
      mockFetch.mockResolvedValue(
        new Response('{"error":"invalid URL"}', { status: 400 }),
      );

      const client = createClient();
      await expect(client.getSignedUrl('invalid')).rejects.toThrow('Storage getSignedUrl failed: 400');
    });
  });

  describe('uploadFile', () => {
    it('uploads via multipart form to /api/v1/files/store', async () => {
      const uploadedUrl = 'gs://bentham-uploads/apps/123/doc.pdf';
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: uploadedUrl } }), { status: 200 }),
      );

      const client = createClient();
      const buffer = Buffer.from('PDF content here');
      const result = await client.uploadFile(buffer, 'document.pdf', 'applications/123/documents');

      expect(result).toBe(uploadedUrl);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storage.bentham.legal/api/v1/files/store',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends FormData as body', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'gs://bucket/file.pdf' } }), { status: 200 }),
      );

      const client = createClient();
      const buffer = Buffer.from('test data');
      await client.uploadFile(buffer, 'test.pdf', 'folder/path');

      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toBeInstanceOf(FormData);
    });

    it('includes HMAC headers computed from JSON descriptor', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'gs://bucket/file.pdf' } }), { status: 200 }),
      );

      const client = createClient('bentham-app');
      await client.uploadFile(Buffer.from('data'), 'file.pdf', 'uploads/docs');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-service-id']).toBe('bentham-app');
      expect(headers['x-signature']).toHaveLength(64);
    });

    it('throws StorageClientError on non-2xx response', async () => {
      mockFetch.mockResolvedValue(
        new Response('{"error":"quota exceeded"}', { status: 507 }),
      );

      const client = createClient();
      await expect(
        client.uploadFile(Buffer.from('data'), 'file.pdf', 'path'),
      ).rejects.toThrow(StorageClientError);

      mockFetch.mockResolvedValue(
        new Response('{"error":"quota exceeded"}', { status: 507 }),
      );
      await expect(
        client.uploadFile(Buffer.from('data'), 'file.pdf', 'path'),
      ).rejects.toMatchObject({
        operation: 'upload',
        status: 507,
        responseBody: '{"error":"quota exceeded"}',
      });
    });

    it('accepts Uint8Array as buffer', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'gs://bucket/file.pdf' } }), { status: 200 }),
      );

      const client = createClient();
      const uint8 = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      const result = await client.uploadFile(uint8, 'image.jpg', 'images');

      expect(result).toBe('gs://bucket/file.pdf');
    });

    it('sets Blob content type from file extension', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'gs://bucket/file.pdf' } }), { status: 200 }),
      );

      const client = createClient();
      await client.uploadFile(Buffer.from('data'), 'report.pdf', 'docs');

      const body = mockFetch.mock.calls[0][1].body as FormData;
      const file = body.get('file') as File;
      expect(file.type).toBe('application/pdf');
    });

    it('uses explicit contentType over inferred', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'gs://bucket/file.pdf' } }), { status: 200 }),
      );

      const client = createClient();
      await client.uploadFile(Buffer.from('data'), 'file.bin', 'uploads', 'application/pdf');

      const body = mockFetch.mock.calls[0][1].body as FormData;
      const file = body.get('file') as File;
      expect(file.type).toBe('application/pdf');
    });

    it('falls back to octet-stream for unknown extensions', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: { url: 'gs://bucket/file.xyz' } }), { status: 200 }),
      );

      const client = createClient();
      await client.uploadFile(Buffer.from('data'), 'file.xyz', 'uploads');

      const body = mockFetch.mock.calls[0][1].body as FormData;
      const file = body.get('file') as File;
      expect(file.type).toBe('application/octet-stream');
    });
  });

  describe('deleteFile', () => {
    it('posts to /api/v1/files/delete', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      const client = createClient();
      await client.deleteFile('gs://bucket/old-file.pdf');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storage.bentham.legal/api/v1/files/delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'gs://bucket/old-file.pdf' }),
        }),
      );
    });

    it('returns void on success', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      const client = createClient();
      const result = await client.deleteFile('gs://bucket/file.pdf');
      expect(result).toBeUndefined();
    });

    it('throws on non-2xx response', async () => {
      mockFetch.mockResolvedValue(
        new Response('{"error":"not found"}', { status: 404 }),
      );

      const client = createClient();
      await expect(client.deleteFile('gs://bucket/missing.pdf')).rejects.toThrow(
        'Storage deleteFile failed: 404',
      );
    });
  });
});

describe('StorageClientError', () => {
  it('contains operation, status, and responseBody', () => {
    const error = new StorageClientError('upload', 500, 'server error');
    expect(error.operation).toBe('upload');
    expect(error.status).toBe(500);
    expect(error.responseBody).toBe('server error');
    expect(error.message).toBe('Storage upload failed: 500');
    expect(error.name).toBe('StorageClientError');
  });

  it('is an instance of Error', () => {
    const error = new StorageClientError('delete', 403, 'forbidden');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('createStorageClient', () => {
  it('returns a StorageClient instance', () => {
    const client = createStorageClient('my-service');
    expect(client).toBeInstanceOf(StorageClient);
  });

  it('uses the provided serviceName', () => {
    const client = createStorageClient('bentham-trademark-api');
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { url: 'https://signed.url' } }), { status: 200 }),
    );
    client.getSignedUrl('gs://bucket/file.pdf');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['x-service-id']).toBe('bentham-trademark-api');
  });
});

describe('downloadToFile', () => {
  const tmpDir = os.tmpdir();

  function createReadableStream(content: Buffer) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(content));
        controller.close();
      },
    });
  }

  afterEach(() => {
    // Clean up any leftover temp files from tests
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      if (f.startsWith('bentham_dl_')) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
    }
  });

  it('downloads file via signed URL and writes to temp path', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 test content');

    // First call: getSignedUrl
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    // Second call: fetchExternal download
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdfContent), { status: 200 }),
    );

    const client = createClient();
    const tempPath = await client.downloadToFile('gs://bucket/document.pdf');

    try {
      expect(fs.existsSync(tempPath)).toBe(true);
      expect(tempPath).toMatch(/bentham_dl_.*\.pdf$/);
      expect(fs.readFileSync(tempPath).toString()).toBe('%PDF-1.4 test content');
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  it('uses .pdf extension by default when URL has no extension', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 content');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdfContent), { status: 200 }),
    );

    const client = createClient();
    const tempPath = await client.downloadToFile('gs://bucket/noext');

    try {
      expect(tempPath).toMatch(/\.pdf$/);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  it('preserves original extension from URL', async () => {
    const content = Buffer.from('\x89PNG\r\n\x1a\n image data');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(content), { status: 200 }),
    );

    const client = createClient();
    const tempPath = await client.downloadToFile('gs://bucket/photo.png', { validate: false });

    try {
      expect(tempPath).toMatch(/\.png$/);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  it('throws StorageClientError on non-2xx download response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const client = createClient();
    await expect(client.downloadToFile('gs://bucket/missing.pdf')).rejects.toMatchObject({
      operation: 'download',
      status: 404,
    });
  });

  it('validates file content by default', async () => {
    const htmlContent = Buffer.from('<!DOCTYPE html><html><body>Error</body></html>');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(htmlContent), { status: 200 }),
    );

    const client = createClient();
    await expect(client.downloadToFile('gs://bucket/file.pdf')).rejects.toThrow(StorageClientError);
  });

  it('skips validation when validate: false', async () => {
    const htmlContent = Buffer.from('<!DOCTYPE html><html><body>Hello</body></html>');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(htmlContent), { status: 200 }),
    );

    const client = createClient();
    const tempPath = await client.downloadToFile('gs://bucket/page.html', { validate: false });

    try {
      expect(fs.existsSync(tempPath)).toBe(true);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  it('uses custom tempDir when provided', async () => {
    const customDir = fs.mkdtempSync(path.join(tmpDir, 'bentham-test-'));
    const pdfContent = Buffer.from('%PDF-1.4 content');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdfContent), { status: 200 }),
    );

    const client = createClient();
    const tempPath = await client.downloadToFile('gs://bucket/doc.pdf', { tempDir: customDir });

    try {
      expect(tempPath.startsWith(customDir)).toBe(true);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      fs.rmdirSync(customDir);
    }
  });
});

describe('validateFileContent', () => {
  const tmpDir = os.tmpdir();

  function writeTempFile(content: Buffer, ext = '.pdf'): string {
    const filePath = path.join(tmpDir, `bentham_validate_test_${Date.now()}${ext}`);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('accepts valid PDF files', () => {
    const filePath = writeTempFile(Buffer.from('%PDF-1.4 valid PDF content here'));
    expect(() => validateFileContent(filePath, '.pdf')).not.toThrow();
    fs.unlinkSync(filePath);
  });

  it('rejects empty files (0 bytes)', () => {
    const filePath = writeTempFile(Buffer.alloc(0));
    expect(() => validateFileContent(filePath, '.pdf')).toThrow(StorageClientError);
    expect(fs.existsSync(filePath)).toBe(false); // cleaned up
  });

  it('rejects HTML error pages starting with <!DOCTYPE', () => {
    const filePath = writeTempFile(Buffer.from('<!DOCTYPE html><html><body>Error</body></html>'));
    try {
      validateFileContent(filePath, '.pdf');
      fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(StorageClientError);
      expect(err.responseBody).toContain('HTML error page');
    }
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('rejects HTML error pages starting with <html', () => {
    const filePath = writeTempFile(Buffer.from('<html><head></head><body>Error</body></html>'));
    try {
      validateFileContent(filePath, '.pdf');
      fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(StorageClientError);
      expect(err.responseBody).toContain('HTML error page');
    }
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('rejects HTML error pages starting with <HTML (uppercase)', () => {
    const filePath = writeTempFile(Buffer.from('<HTML><HEAD></HEAD><BODY>Error</BODY></HTML>'));
    try {
      validateFileContent(filePath, '.pdf');
      fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(StorageClientError);
      expect(err.responseBody).toContain('HTML error page');
    }
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('rejects invalid PDF header when extension is .pdf', () => {
    const filePath = writeTempFile(Buffer.from('This is not a PDF file at all'));
    try {
      validateFileContent(filePath, '.pdf');
      fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(StorageClientError);
      expect(err.responseBody).toContain('invalid PDF header');
    }
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('does not check PDF header for non-pdf extensions', () => {
    const filePath = writeTempFile(Buffer.from('Just some text content'), '.txt');
    expect(() => validateFileContent(filePath, '.txt')).not.toThrow();
    fs.unlinkSync(filePath);
  });

  it('accepts PNG files without PDF header check', () => {
    const filePath = writeTempFile(Buffer.from('\x89PNG\r\n\x1a\n some image data'), '.png');
    expect(() => validateFileContent(filePath, '.png')).not.toThrow();
    fs.unlinkSync(filePath);
  });
});

describe('withTempDownload', () => {
  function createReadableStream(content: Buffer) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(content));
        controller.close();
      },
    });
  }

  it('provides local path to callback and cleans up on success', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 test');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdfContent), { status: 200 }),
    );

    const client = createClient();
    let capturedPath = '';

    const result = await withTempDownload(client, 'gs://bucket/doc.pdf', async (localPath) => {
      capturedPath = localPath;
      expect(fs.existsSync(localPath)).toBe(true);
      expect(fs.readFileSync(localPath).toString()).toBe('%PDF-1.4 test');
      return 'processed';
    });

    expect(result).toBe('processed');
    expect(fs.existsSync(capturedPath)).toBe(false); // cleaned up
  });

  it('cleans up temp file on callback failure', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 test');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdfContent), { status: 200 }),
    );

    const client = createClient();
    let capturedPath = '';

    await expect(
      withTempDownload(client, 'gs://bucket/doc.pdf', async (localPath) => {
        capturedPath = localPath;
        throw new Error('processing failed');
      }),
    ).rejects.toThrow('processing failed');

    expect(fs.existsSync(capturedPath)).toBe(false); // cleaned up despite error
  });
});

describe('withTempDownloads', () => {
  function createReadableStream(content: Buffer) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(content));
        controller.close();
      },
    });
  }

  it('downloads multiple files and provides paths record to callback', async () => {
    const pdf1 = Buffer.from('%PDF-1.4 file one');
    const pdf2 = Buffer.from('%PDF-1.4 file two');

    // First file: getSignedUrl + download
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed1' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed2' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdf1), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdf2), { status: 200 }),
    );

    const client = createClient();
    let capturedPaths: Record<string, string> = {};

    const result = await withTempDownloads(
      client,
      [
        { key: 'doc1', url: 'gs://bucket/first.pdf' },
        { key: 'doc2', url: 'gs://bucket/second.pdf' },
      ],
      async (paths) => {
        capturedPaths = { ...paths };
        expect(Object.keys(paths)).toEqual(expect.arrayContaining(['doc1', 'doc2']));
        expect(fs.existsSync(paths.doc1)).toBe(true);
        expect(fs.existsSync(paths.doc2)).toBe(true);
        return 'batch-done';
      },
    );

    expect(result).toBe('batch-done');
    // Both cleaned up
    expect(fs.existsSync(capturedPaths.doc1)).toBe(false);
    expect(fs.existsSync(capturedPaths.doc2)).toBe(false);
  });

  it('cleans up all files on callback failure', async () => {
    const pdf1 = Buffer.from('%PDF-1.4 file one');
    const pdf2 = Buffer.from('%PDF-1.4 file two');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed1' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed2' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdf1), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdf2), { status: 200 }),
    );

    const client = createClient();
    let capturedPaths: Record<string, string> = {};

    await expect(
      withTempDownloads(
        client,
        [
          { key: 'a', url: 'gs://bucket/a.pdf' },
          { key: 'b', url: 'gs://bucket/b.pdf' },
        ],
        async (paths) => {
          capturedPaths = { ...paths };
          throw new Error('batch failed');
        },
      ),
    ).rejects.toThrow('batch failed');

    expect(fs.existsSync(capturedPaths.a)).toBe(false);
    expect(fs.existsSync(capturedPaths.b)).toBe(false);
  });

  it('cleans up already-downloaded files if one download fails', async () => {
    const pdf1 = Buffer.from('%PDF-1.4 file one');

    // First file succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/signed1' } }), { status: 200 }),
    );
    // Second file: getSignedUrl fails
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"not found"}', { status: 404 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(createReadableStream(pdf1), { status: 200 }),
    );

    const client = createClient();

    await expect(
      withTempDownloads(
        client,
        [
          { key: 'a', url: 'gs://bucket/a.pdf' },
          { key: 'b', url: 'gs://bucket/missing.pdf' },
        ],
        async (paths) => paths,
      ),
    ).rejects.toThrow();

    // Verify no leftover temp files
    const tmpFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('bentham_dl_'));
    expect(tmpFiles.length).toBe(0);
  });
});
