import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { StorageClient, StorageClientError, withTempDownload, withTempDownloads } from '../../src/storage/index';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/logger/context', () => ({
  getContext: jest.fn(() => ({ requestId: 'trace-download-123' })),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

let tempDir: string;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BENTHAM_STORAGE_API_HMAC = 'test-storage-secret';
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bentham-dl-test-'));
});

afterEach(() => {
  delete process.env.BENTHAM_STORAGE_API_HMAC;
  // Clean up temp dir
  if (fs.existsSync(tempDir)) {
    for (const file of fs.readdirSync(tempDir)) {
      fs.unlinkSync(path.join(tempDir, file));
    }
    fs.rmdirSync(tempDir);
  }
});

function createClient() {
  return new StorageClient({ serviceName: 'test-service' });
}

/** Mock getSignedUrl (first call) then fetchExternal (second call) */
function mockDownloadPipeline(content: Buffer | string, contentType = 'application/pdf') {
  const buf = typeof content === 'string' ? Buffer.from(content) : content;

  // First fetch: getSignedUrl via HMAC-authenticated POST
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/bucket/file.pdf?X-Goog-Signature=abc' } }), { status: 200 }),
  );

  // Second fetch: the actual download via fetchExternal
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
  mockFetch.mockResolvedValueOnce(
    new Response(stream, { status: 200, headers: { 'content-type': contentType } }),
  );
}

describe('StorageClient.downloadToFile', () => {
  it('downloads a valid PDF to a temp file', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 fake pdf content here');
    mockDownloadPipeline(pdfContent);

    const client = createClient();
    const filePath = await client.downloadToFile('gs://bucket/document.pdf', { tempDir });

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath).toString()).toBe(pdfContent.toString());
    expect(filePath).toMatch(/bentham_dl_\d+_[a-f0-9]+\.pdf$/);

    fs.unlinkSync(filePath);
  });

  it('uses correct extension from GCS URL', async () => {
    const content = Buffer.from('PNG fake content');
    mockDownloadPipeline(content);

    const client = createClient();
    const filePath = await client.downloadToFile('gs://bucket/photos/image.png', { tempDir, validate: false });

    expect(filePath).toMatch(/\.png$/);
    fs.unlinkSync(filePath);
  });

  it('defaults to .pdf extension when URL has no extension', async () => {
    const content = Buffer.from('%PDF-1.4 content');
    mockDownloadPipeline(content);

    const client = createClient();
    // gs://bucket/noext has no extension
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/bucket/noext?sig=x' } }), { status: 200 }),
    );
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(content));
        controller.close();
      },
    });
    mockFetch.mockResolvedValueOnce(new Response(stream, { status: 200 }));

    const filePath = await client.downloadToFile('gs://bucket/noext', { tempDir });
    expect(filePath).toMatch(/\.pdf$/);
    fs.unlinkSync(filePath);
  });

  it('throws StorageClientError when download returns non-2xx', async () => {
    // First call: getSignedUrl succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/bucket/file.pdf?sig=x' } }), { status: 200 }),
    );
    // Second call: actual download fails
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const client = createClient();
    await expect(client.downloadToFile('gs://bucket/missing.pdf', { tempDir }))
      .rejects.toThrow('Storage download failed: 404');
  });

  it('rejects empty files when validate=true', async () => {
    // Empty content
    mockDownloadPipeline(Buffer.alloc(0));

    const client = createClient();
    await expect(client.downloadToFile('gs://bucket/empty.pdf', { tempDir }))
      .rejects.toMatchObject({
        name: 'StorageClientError',
        operation: 'download',
        responseBody: 'Downloaded file is empty (0 bytes)',
      });

    // Verify temp file was cleaned up
    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(0);
  });

  it('rejects HTML error pages', async () => {
    mockDownloadPipeline('<!DOCTYPE html><html><body>Error</body></html>');

    const client = createClient();
    await expect(client.downloadToFile('gs://bucket/file.pdf', { tempDir }))
      .rejects.toMatchObject({
        name: 'StorageClientError',
        operation: 'download',
        responseBody: 'Downloaded file is an HTML error page',
      });

    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(0);
  });

  it('rejects invalid PDF header', async () => {
    mockDownloadPipeline('This is not a PDF file at all');

    const client = createClient();
    await expect(client.downloadToFile('gs://bucket/file.pdf', { tempDir }))
      .rejects.toMatchObject({
        name: 'StorageClientError',
        operation: 'download',
        responseBody: 'Downloaded file has invalid PDF header',
      });

    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(0);
  });

  it('skips validation when validate=false', async () => {
    mockDownloadPipeline('This is not a PDF but we skip validation');

    const client = createClient();
    const filePath = await client.downloadToFile('gs://bucket/file.pdf', { tempDir, validate: false });

    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });

  it('does not reject non-PDF files for invalid PDF header', async () => {
    mockDownloadPipeline('regular text content');

    const client = createClient();
    const filePath = await client.downloadToFile('gs://bucket/notes.txt', { tempDir });

    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });

  it('uses custom tempDir from options', async () => {
    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-dl-'));
    const pdfContent = Buffer.from('%PDF-1.4 content');
    mockDownloadPipeline(pdfContent);

    const client = createClient();
    const filePath = await client.downloadToFile('gs://bucket/doc.pdf', { tempDir: customDir });

    expect(filePath.startsWith(customDir)).toBe(true);
    fs.unlinkSync(filePath);
    fs.rmdirSync(customDir);
  });
});

describe('withTempDownload', () => {
  it('provides local path to callback and cleans up on success', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 test content');
    mockDownloadPipeline(pdfContent);

    const client = createClient();
    let capturedPath = '';

    const result = await withTempDownload(client, 'gs://bucket/doc.pdf', async (localPath) => {
      capturedPath = localPath;
      expect(fs.existsSync(localPath)).toBe(true);
      return fs.readFileSync(localPath, 'utf8');
    }, { tempDir });

    expect(result).toBe(pdfContent.toString());
    expect(fs.existsSync(capturedPath)).toBe(false); // cleaned up
  });

  it('cleans up temp file even when callback throws', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 test content');
    mockDownloadPipeline(pdfContent);

    const client = createClient();
    let capturedPath = '';

    await expect(
      withTempDownload(client, 'gs://bucket/doc.pdf', async (localPath) => {
        capturedPath = localPath;
        throw new Error('callback failed');
      }, { tempDir }),
    ).rejects.toThrow('callback failed');

    expect(fs.existsSync(capturedPath)).toBe(false); // still cleaned up
  });

  it('propagates download errors without orphan files', async () => {
    // getSignedUrl succeeds, download fails
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/bucket/file.pdf?sig=x' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

    const client = createClient();
    await expect(
      withTempDownload(client, 'gs://bucket/fail.pdf', async () => 'never reached', { tempDir }),
    ).rejects.toThrow('Storage download failed: 500');

    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(0);
  });
});

describe('withTempDownloads', () => {
  it('downloads multiple files in parallel and provides paths map', async () => {
    const pdf1 = Buffer.from('%PDF-1.4 first document');
    const pdf2 = Buffer.from('%PDF-1.4 second document');

    // First file: getSignedUrl + download
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/b/f1.pdf?sig=1' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/b/f2.pdf?sig=2' } }), { status: 200 }),
    );

    const stream1 = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(pdf1)); c.close(); } });
    const stream2 = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(pdf2)); c.close(); } });
    mockFetch.mockResolvedValueOnce(new Response(stream1, { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response(stream2, { status: 200 }));

    const client = createClient();
    let capturedPaths: Record<string, string> = {};

    const result = await withTempDownloads(
      client,
      [
        { key: 'pan', url: 'gs://bucket/pan.pdf' },
        { key: 'aadhar', url: 'gs://bucket/aadhar.pdf' },
      ],
      async (paths) => {
        capturedPaths = { ...paths };
        expect(Object.keys(paths)).toEqual(['pan', 'aadhar']);
        expect(fs.existsSync(paths.pan)).toBe(true);
        expect(fs.existsSync(paths.aadhar)).toBe(true);
        return 'processed';
      },
      { tempDir },
    );

    expect(result).toBe('processed');
    // All cleaned up
    expect(fs.existsSync(capturedPaths.pan)).toBe(false);
    expect(fs.existsSync(capturedPaths.aadhar)).toBe(false);
  });

  it('cleans up all downloaded files when callback throws', async () => {
    const pdf1 = Buffer.from('%PDF-1.4 first');
    const pdf2 = Buffer.from('%PDF-1.4 second');

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/b/f1.pdf?sig=1' } }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/b/f2.pdf?sig=2' } }), { status: 200 }),
    );

    const stream1 = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(pdf1)); c.close(); } });
    const stream2 = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(pdf2)); c.close(); } });
    mockFetch.mockResolvedValueOnce(new Response(stream1, { status: 200 }));
    mockFetch.mockResolvedValueOnce(new Response(stream2, { status: 200 }));

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
          throw new Error('processing failed');
        },
        { tempDir },
      ),
    ).rejects.toThrow('processing failed');

    expect(fs.existsSync(capturedPaths.a)).toBe(false);
    expect(fs.existsSync(capturedPaths.b)).toBe(false);
  });

  it('cleans up successfully downloaded files when one download fails', async () => {
    const pdf1 = Buffer.from('%PDF-1.4 first');

    // First file succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/b/f1.pdf?sig=1' } }), { status: 200 }),
    );
    // Second file getSignedUrl succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { url: 'https://storage.googleapis.com/b/f2.pdf?sig=2' } }), { status: 200 }),
    );

    // First download succeeds
    const stream1 = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(pdf1)); c.close(); } });
    mockFetch.mockResolvedValueOnce(new Response(stream1, { status: 200 }));
    // Second download fails
    mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

    const client = createClient();

    await expect(
      withTempDownloads(
        client,
        [
          { key: 'good', url: 'gs://bucket/good.pdf' },
          { key: 'bad', url: 'gs://bucket/bad.pdf' },
        ],
        async () => 'never reached',
        { tempDir },
      ),
    ).rejects.toThrow('Storage download failed: 500');

    // Verify no orphan files
    const files = fs.readdirSync(tempDir);
    expect(files).toHaveLength(0);
  });
});
