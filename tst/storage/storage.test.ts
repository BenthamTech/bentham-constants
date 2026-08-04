import { StorageClient, StorageClientError, createStorageClient } from '../../src/storage/index';

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
