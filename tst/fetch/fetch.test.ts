import { fetchExternal } from '../../src/fetch/index';
import { logger } from '../../src/logger/logger';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchExternal', () => {
  it('logs request method and URL on call', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    await fetchExternal('https://api.example.com/test');
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: 'https://api.example.com/test' }),
      '→ GET /test',
    );
  });

  it('logs response status and duration on success', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    await fetchExternal('https://api.example.com/path', { method: 'POST' });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', status: 200 }),
      expect.stringMatching(/^← 200 \(\d+ms\)$/),
    );
  });

  it('logs error body on non-2xx response', async () => {
    mockFetch.mockResolvedValue(new Response('not found', { status: 404 }));
    await fetchExternal('https://api.example.com/missing');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, body: 'not found' }),
      expect.stringContaining('← 404'),
    );
  });

  it('logs network error message when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(fetchExternal('https://api.example.com/down')).rejects.toThrow('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'ECONNREFUSED' }),
      expect.stringContaining('← ERROR ECONNREFUSED'),
    );
  });

  it('passes timeout via AbortSignal', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    await fetchExternal('https://api.example.com/slow', {}, 5000);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/slow',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns unmodified Response object', async () => {
    const resp = new Response(JSON.stringify({ data: 1 }), { status: 200 });
    mockFetch.mockResolvedValue(resp);
    const result = await fetchExternal('https://api.example.com/data');
    expect(result).toBe(resp);
  });

  it('combines caller signal with timeout signal via AbortSignal.any', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    const callerAbort = new AbortController();
    await fetchExternal('https://api.example.com/both', { signal: callerAbort.signal }, 5000);
    const passedSignal = mockFetch.mock.calls[0][1].signal;
    expect(passedSignal).toBeInstanceOf(AbortSignal);
    expect(passedSignal).not.toBe(callerAbort.signal); // composite signal
  });

  it('truncates error body to 500 chars', async () => {
    const longBody = 'x'.repeat(1000);
    mockFetch.mockResolvedValue(new Response(longBody, { status: 500 }));
    await fetchExternal('https://api.example.com/err');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'x'.repeat(500) }),
      expect.any(String),
    );
  });
});
