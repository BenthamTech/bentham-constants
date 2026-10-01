import { NotificationClient, createNotificationClient, type NotificationPayload } from '../../src/notification/index';
import { ServiceClientError } from '../../src/http';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/logger/context', () => ({
  getContext: jest.fn(() => ({ requestId: 'trace-notif-123' })),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const samplePayload: NotificationPayload = {
  type: 'email',
  to: ['user@example.com'],
  template_name: 'filing_result',
  subject: 'Your filing is complete',
  variables: { name: 'Ada' },
};

function okResponse(body: unknown = { messageId: 'msg-1' }) {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  process.env.BENTHAM_NOTIFICATION_API_HMAC = 'test-notif-secret';
});

afterEach(() => {
  jest.useRealTimers();
  delete process.env.BENTHAM_NOTIFICATION_API_HMAC;
});

function createClient(serviceName = 'test-service') {
  return new NotificationClient({ serviceName });
}

describe('NotificationClient', () => {
  describe('constructor', () => {
    it('uses default notification URL from config', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(okResponse());
      await client.send(samplePayload);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notification.bentham.legal/v1/notifications/send',
        expect.anything(),
      );
    });

    it('allows overriding baseUrl', async () => {
      const client = new NotificationClient({ serviceName: 'test', baseUrl: 'https://custom-notif.example.com' });
      mockFetch.mockResolvedValue(okResponse());
      await client.send(samplePayload);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-notif.example.com/v1/notifications/send',
        expect.anything(),
      );
    });

    it('wires HMAC headers using the default secret env var and serviceName', async () => {
      const client = createClient('bentham-mca-api');
      mockFetch.mockResolvedValue(okResponse());
      await client.send(samplePayload);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-service-id']).toBe('bentham-mca-api');
      expect(headers['x-signature']).toHaveLength(64);
    });

    it('allows overriding secretEnvVar', async () => {
      process.env.CUSTOM_NOTIF_HMAC = 'custom-secret';
      const client = new NotificationClient({ serviceName: 'test', secretEnvVar: 'CUSTOM_NOTIF_HMAC' });
      mockFetch.mockResolvedValue(okResponse());
      await client.send(samplePayload);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-service-id']).toBe('test');
      expect(headers['x-signature']).toHaveLength(64);
      delete process.env.CUSTOM_NOTIF_HMAC;
    });

    it('propagates trace headers', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(okResponse());
      await client.send(samplePayload);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['x-request-id']).toBe('trace-notif-123');
    });
  });

  describe('send', () => {
    it('posts the payload unchanged to /v1/notifications/send', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(okResponse({ messageId: 'msg-42' }));

      const result = await client.send(samplePayload);

      expect(result).toEqual({ messageId: 'msg-42' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notification.bentham.legal/v1/notifications/send',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(samplePayload),
        }),
      );
    });

    it('retries on a retryable (5xx) error then succeeds', async () => {
      const client = createClient();
      mockFetch
        .mockResolvedValueOnce(new Response('upstream down', { status: 503 }))
        .mockResolvedValueOnce(okResponse({ id: 'msg-after-retry' }));

      const promise = client.send(samplePayload);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ id: 'msg-after-retry' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on a non-retryable (4xx) error', async () => {
      const client = createClient();
      mockFetch.mockResolvedValue(new Response('bad request', { status: 400 }));

      await expect(client.send(samplePayload)).rejects.toBeInstanceOf(ServiceClientError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('createNotificationClient', () => {
    it('builds a client bound to the given service name', async () => {
      const client = createNotificationClient('bentham_trademark_api');
      mockFetch.mockResolvedValue(okResponse());
      await client.send(samplePayload);
      expect(mockFetch.mock.calls[0][1].headers['x-service-id']).toBe('bentham_trademark_api');
    });
  });
});
