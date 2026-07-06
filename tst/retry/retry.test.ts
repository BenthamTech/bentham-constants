import {
  buildRetryConfig,
  isRetryableError,
  fetchWithTimeout,
  withRetry,
  fetchWithRetry,
} from '../../src/retry/index';
import { logger } from '../../src/logger/logger';

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildRetryConfig', () => {
  it('returns defaults when called with no overrides', () => {
    const cfg = buildRetryConfig();
    expect(cfg).toEqual({
      maxRetries: 1,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      timeoutMs: 30000,
    });
  });

  it('merges partial overrides into defaults', () => {
    const cfg = buildRetryConfig({ maxRetries: 3, timeoutMs: 5000 });
    expect(cfg.maxRetries).toBe(3);
    expect(cfg.timeoutMs).toBe(5000);
    expect(cfg.initialDelayMs).toBe(1000);
  });
});

describe('isRetryableError', () => {
  it('returns true for ECONNRESET', () => {
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('returns true for ENOTFOUND', () => {
    expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
  });

  it('returns true for fetch failed TypeError', () => {
    expect(isRetryableError({ name: 'TypeError', message: 'fetch failed' })).toBe(true);
  });

  it('returns true for AbortError', () => {
    expect(isRetryableError({ name: 'AbortError' })).toBe(true);
  });

  it('returns true for HTTP 500', () => {
    expect(isRetryableError({ status: 500 })).toBe(true);
  });

  it('returns true for HTTP 503', () => {
    expect(isRetryableError({ status: 503 })).toBe(true);
  });

  it('returns true for HTTP 429', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
  });

  it('returns false for HTTP 400', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it('returns false for generic error', () => {
    expect(isRetryableError(new Error('something'))).toBe(false);
  });
});

describe('fetchWithTimeout', () => {
  it('delegates to fetchExternal with the provided timeout', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    const response = await fetchWithTimeout('https://api.example.com/test', {}, 5000);
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('passes undefined timeout when timeoutMs is 0', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    await fetchWithTimeout('https://api.example.com/test', {}, 0);
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.signal).toBeUndefined();
  });
});

describe('withRetry', () => {
  const FAST = { initialDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2 };

  it('returns result on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { ...FAST, maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds on second attempt', async () => {
    const error: any = new Error('timeout');
    error.code = 'ETIMEDOUT';
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { ...FAST, maxRetries: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-retryable error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('validation failed'));
    await expect(withRetry(fn, { ...FAST, maxRetries: 3 })).rejects.toThrow('validation failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws last error after exhausting retries', async () => {
    const error: any = new Error('server down');
    error.status = 500;
    const fn = jest.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { ...FAST, maxRetries: 2 })).rejects.toThrow('server down');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls fn with increasing attempt numbers', async () => {
    const error: any = new Error('fail');
    error.status = 500;
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { ...FAST, maxRetries: 1 });
    expect(fn).toHaveBeenNthCalledWith(1, 0);
    expect(fn).toHaveBeenNthCalledWith(2, 1);
  });

  it('uses custom shouldRetry predicate', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('custom error'));
    const customRetry = (err: any) => err.message === 'custom error';

    await expect(withRetry(fn, { ...FAST, maxRetries: 1 }, customRetry)).rejects.toThrow('custom error');
    // Custom predicate says retry → should have called twice
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('logs retry attempts with label', async () => {
    const error: any = new Error('oops');
    error.code = 'ECONNRESET';
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { ...FAST, maxRetries: 1 }, undefined, 'TestOp');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[TestOp] Attempt 1 failed'),
    );
  });

  it('logs retry attempts without label', async () => {
    const error: any = new Error('oops');
    error.code = 'ECONNRESET';
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { ...FAST, maxRetries: 1 });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/^Attempt 1 failed/),
    );
  });

  it('respects maxDelayMs cap', async () => {
    const error: any = new Error('timeout');
    error.code = 'ETIMEDOUT';
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('done');

    const start = Date.now();
    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 5,
      backoffMultiplier: 100,
      maxDelayMs: 10,
    });
    const elapsed = Date.now() - start;
    // Second delay would be 5*100=500 but capped at 10, so total should be ~15ms max
    expect(elapsed).toBeLessThan(100);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('fetchWithRetry', () => {
  it('returns response on successful fetch', async () => {
    mockFetch.mockResolvedValue(new Response('ok', { status: 200 }));
    const result = await fetchWithRetry('https://api.example.com/data');
    expect(result.status).toBe(200);
  });

  it('throws on non-retryable HTTP error without retry', async () => {
    mockFetch.mockResolvedValue(new Response('bad request', { status: 400 }));
    await expect(
      fetchWithRetry('https://api.example.com/bad', {}, { initialDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow('HTTP 400');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const result = await fetchWithRetry(
      'https://api.example.com/flaky',
      {},
      { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
    );
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted on 503', async () => {
    mockFetch.mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(
      fetchWithRetry('https://api.example.com/down', {}, { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow('HTTP 503');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
