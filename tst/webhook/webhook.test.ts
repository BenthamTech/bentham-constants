import { WebhookCallbackClient } from '../../src/webhook/index';
import { logger } from '../../src/logger/logger';
import { getContext } from '../../src/logger/context';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/logger/context', () => ({
  getContext: jest.fn(() => ({})),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

function createClient(overrides?: Partial<ConstructorParameters<typeof WebhookCallbackClient>[0]>) {
  return new WebhookCallbackClient({
    hmacSecret: 'test-secret',
    serviceName: 'test-service',
    baseUrl: 'https://www.bentham.legal',
    retryDelayMs: 0,
    ...overrides,
  });
}

describe('WebhookCallbackClient', () => {
  describe('send', () => {
    it('delivers successfully on first attempt', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
      const client = createClient();

      await client.send('/api/webhooks/test', { id: '123' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.bentham.legal/api/webhooks/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id: '123' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-service-id': 'test-service',
            'x-timestamp': expect.any(String),
            'x-signature': expect.any(String),
          }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/webhooks/test', attempt: 0 }),
        'Webhook delivered to /api/webhooks/test',
      );
    });

    it('retries once on failure then logs permanent failure', async () => {
      mockFetch.mockResolvedValue(new Response('error', { status: 500 }));
      const client = createClient();

      await client.send('/api/webhooks/test', { id: '456' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/webhooks/test', maxRetries: 1 }),
        'Webhook /api/webhooks/test failed after 2 attempts',
      );
    });

    it('retries on network error (fetch throws)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const client = createClient();

      await client.send('/api/webhooks/test', { status: 'filed' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'ECONNREFUSED', attempt: 0 }),
        expect.stringContaining('ECONNREFUSED'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ maxRetries: 1 }),
        expect.stringContaining('failed after 2 attempts'),
      );
    });

    it('succeeds on retry after initial failure', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('error', { status: 502 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));
      const client = createClient();

      await client.send('/api/webhooks/test', { id: '789' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/webhooks/test', attempt: 1 }),
        'Webhook delivered to /api/webhooks/test',
      );
      // fetchExternal logs non-2xx as error, but the webhook module should NOT log permanent failure
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.objectContaining({ maxRetries: expect.anything() }),
        expect.stringContaining('failed after'),
      );
    });

    it('respects custom maxRetries', async () => {
      mockFetch.mockResolvedValue(new Response('error', { status: 500 }));
      const client = createClient({ maxRetries: 3 });

      await client.send('/api/webhooks/test', {});

      expect(mockFetch).toHaveBeenCalledTimes(4); // initial + 3 retries
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ maxRetries: 3 }),
        'Webhook /api/webhooks/test failed after 4 attempts',
      );
    });

    it('respects custom timeoutMs', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
      const client = createClient({ timeoutMs: 30000 });

      await client.send('/api/webhooks/test', {});

      // fetchExternal receives the timeout — verify signal is set
      const passedOptions = mockFetch.mock.calls[0][1];
      expect(passedOptions.signal).toBeInstanceOf(AbortSignal);
    });

    it('propagates x-request-id from context', async () => {
      (getContext as jest.Mock).mockReturnValue({ requestId: 'req-abc-123' });
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
      const client = createClient();

      await client.send('/api/webhooks/test', {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-request-id': 'req-abc-123' }),
        }),
      );
    });

    it('omits x-request-id header when context has no requestId', async () => {
      (getContext as jest.Mock).mockReturnValue({});
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
      const client = createClient();

      await client.send('/api/webhooks/test', {});

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('x-request-id');
    });

    it('strips trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
      const client = createClient({ baseUrl: 'https://www.bentham.legal/' });

      await client.send('/api/webhooks/test', {});

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.bentham.legal/api/webhooks/test',
        expect.any(Object),
      );
    });

    it('logs error and returns early when payload is not serializable', async () => {
      const circular: any = {};
      circular.self = circular;
      const client = createClient();

      await client.send('/api/webhooks/test', circular);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/webhooks/test', service: 'test-service' }),
        expect.stringContaining('setup failed'),
      );
    });

    it('logs error and returns early when getContext throws', async () => {
      (getContext as jest.Mock).mockImplementation(() => {
        throw new Error('context unavailable');
      });
      const client = createClient();

      await client.send('/api/webhooks/test', { id: '123' });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/webhooks/test', error: 'context unavailable' }),
        expect.stringContaining('setup failed'),
      );
    });
  });

  describe('fireAndForget', () => {
    it('does not throw even when send fails', () => {
      mockFetch.mockRejectedValue(new Error('total failure'));
      const client = createClient();

      // Should not throw
      expect(() => client.fireAndForget('/api/webhooks/test', {})).not.toThrow();
    });

    it('calls send with the same arguments', async () => {
      mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
      const client = createClient();
      const sendSpy = jest.spyOn(client, 'send');

      client.fireAndForget('/api/webhooks/filing/status', { applicationId: 'app-1' });

      // Let microtasks resolve
      await new Promise(process.nextTick);

      expect(sendSpy).toHaveBeenCalledWith('/api/webhooks/filing/status', { applicationId: 'app-1' });
    });
  });
});
