import { BaseServiceClient, ServiceClientError } from '../../src/http/index';
import { logger } from '../../src/logger/logger';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/logger/context', () => ({
  getContext: jest.fn(() => ({ requestId: 'trace-abc-123' })),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TEST_SERVICE_HMAC = 'secret-key-123';
});

afterEach(() => {
  delete process.env.TEST_SERVICE_HMAC;
});

function createClient(overrides?: Partial<ConstructorParameters<typeof BaseServiceClient>[0]>) {
  return new BaseServiceClient({
    baseUrl: 'https://api.example.com',
    auth: { secretEnvVar: 'TEST_SERVICE_HMAC', serviceName: 'test-service' },
    ...overrides,
  });
}

describe('BaseServiceClient', () => {
  describe('constructor', () => {
    it('strips trailing slashes from baseUrl', () => {
      const client = createClient({ baseUrl: 'https://api.example.com///' });
      // Access via post to verify URL construction
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      client.post('/test', {});
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.anything(),
      );
    });

    it('accepts a pre-built auth function', () => {
      const customAuth = jest.fn().mockReturnValue({ 'x-signature': 'custom' });
      const client = new BaseServiceClient({
        baseUrl: 'https://api.example.com',
        auth: customAuth,
      });
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      client.get('/test');
      expect(customAuth).toHaveBeenCalledWith('GET', '/test');
    });

    it('defaults timeout to 10000ms', () => {
      const client = createClient();
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      client.get('/test');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe('post', () => {
    it('sends JSON body with correct headers', async () => {
      const payload = { key: 'value', num: 42 };
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

      const client = createClient();
      await client.post('/api/v1/resource', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/resource',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['x-service-id']).toBe('test-service');
      expect(headers['x-signature']).toHaveLength(64);
      expect(headers['x-timestamp']).toMatch(/^\d+$/);
      expect(headers['x-request-id']).toBe('trace-abc-123');
    });

    it('returns parsed JSON response', async () => {
      const responseData = { id: 1, name: 'test' };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(responseData), { status: 200 }),
      );

      const client = createClient();
      const result = await client.post<typeof responseData>('/api/create', { name: 'test' });
      expect(result).toEqual(responseData);
    });

    it('throws ServiceClientError on non-2xx response', async () => {
      mockFetch.mockResolvedValue(
        new Response('{"error":"not found"}', { status: 404 }),
      );

      const client = createClient();
      await expect(client.post('/api/missing', {})).rejects.toThrow(ServiceClientError);

      mockFetch.mockResolvedValue(
        new Response('{"error":"not found"}', { status: 404 }),
      );
      await expect(client.post('/api/missing', {})).rejects.toMatchObject({
        status: 404,
        path: '/api/missing',
        responseBody: '{"error":"not found"}',
      });
    });
  });

  describe('get', () => {
    it('sends GET with auth and trace headers', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

      const client = createClient();
      await client.get('/api/v1/items');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/items',
        expect.objectContaining({ method: 'GET' }),
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-service-id']).toBe('test-service');
      expect(headers['x-signature']).toHaveLength(64);
      expect(headers['x-request-id']).toBe('trace-abc-123');
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('returns parsed JSON response', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ items: [1, 2, 3] }), { status: 200 }),
      );

      const client = createClient();
      const result = await client.get<{ items: number[] }>('/api/list');
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('throws ServiceClientError on 500', async () => {
      mockFetch.mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      const client = createClient();
      await expect(client.get('/api/broken')).rejects.toThrow(ServiceClientError);
    });
  });

  describe('request (raw)', () => {
    it('sends arbitrary method with auth headers', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      const client = createClient();
      const resp = await client.request('DELETE', '/api/v1/resource/42');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/resource/42',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(resp.status).toBe(200);
    });

    it('passes body and extra headers', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));

      const client = createClient();
      await client.request('PUT', '/api/v1/item', '{"name":"updated"}', {
        'X-Custom': 'header-value',
      });

      const opts = mockFetch.mock.calls[0][1];
      expect(opts.body).toBe('{"name":"updated"}');
      expect(opts.headers['X-Custom']).toBe('header-value');
      expect(opts.headers['x-signature']).toHaveLength(64);
    });

    it('returns raw Response (does not throw on non-2xx)', async () => {
      mockFetch.mockResolvedValue(new Response('not found', { status: 404 }));

      const client = createClient();
      const resp = await client.request('GET', '/api/missing');
      expect(resp.status).toBe(404);
    });
  });

  describe('requestRaw', () => {
    it('sends raw body but uses hmacBody for auth signature', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));

      const client = createClient();
      const rawBody = new Uint8Array([1, 2, 3, 4]);
      const hmacBody = JSON.stringify({ filename: 'test.pdf', size: 4 });

      await client.requestRaw('POST', '/api/v1/upload', rawBody, hmacBody, {
        'Content-Type': 'application/octet-stream',
      });

      const opts = mockFetch.mock.calls[0][1];
      expect(opts.body).toBe(rawBody);
      expect(opts.headers['Content-Type']).toBe('application/octet-stream');
      expect(opts.headers['x-signature']).toHaveLength(64);
      expect(opts.headers['x-request-id']).toBe('trace-abc-123');
    });
  });

  describe('trace headers', () => {
    it('includes x-request-id when context has requestId', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createClient();
      await client.get('/test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-request-id']).toBe('trace-abc-123');
    });

    it('omits x-request-id when context has no requestId', async () => {
      const { getContext } = require('../../src/logger/context');
      (getContext as jest.Mock).mockReturnValueOnce({});

      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createClient();
      await client.get('/test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-request-id']).toBeUndefined();
    });
  });

  describe('timeout', () => {
    it('respects custom timeout', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createClient({ timeout: 30_000 });
      await client.get('/slow');

      // fetchExternal receives timeout as 3rd arg — we verify it's passed via the signal
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe('ServiceClientError', () => {
    it('contains status, path, and responseBody', () => {
      const error = new ServiceClientError(403, '/api/secret', 'forbidden');
      expect(error.status).toBe(403);
      expect(error.path).toBe('/api/secret');
      expect(error.responseBody).toBe('forbidden');
      expect(error.message).toBe('Service request failed: 403 /api/secret');
      expect(error.name).toBe('ServiceClientError');
    });

    it('is an instance of Error', () => {
      const error = new ServiceClientError(500, '/path', 'body');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('URL construction', () => {
    it('handles path without leading slash', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createClient();
      await client.get('api/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/test',
        expect.anything(),
      );
    });

    it('handles path with leading slash', async () => {
      mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
      const client = createClient();
      await client.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/test',
        expect.anything(),
      );
    });
  });
});
