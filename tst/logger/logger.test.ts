import { asyncLocalStorage } from '../../src/logger/context';
import { getContext, addContext } from '../../src/logger/context';
import { logger } from '../../src/logger/logger';
import { requestContext, requestLogger } from '../../src/logger/middleware';

function flushLogs(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 50));
}

describe('logger/context', () => {
  test('getContext returns empty object outside async context', () => {
    expect(getContext()).toEqual({});
  });

  test('getContext returns store inside async context', () => {
    asyncLocalStorage.run({ requestId: 'r1', service: 'test' }, () => {
      expect(getContext()).toEqual({ requestId: 'r1', service: 'test' });
    });
  });

  test('addContext enriches current store', () => {
    asyncLocalStorage.run({ requestId: 'r2', service: 'test' }, () => {
      addContext({ userId: 'u1', applicationId: 'app1' });
      expect(getContext()).toEqual({ requestId: 'r2', service: 'test', userId: 'u1', applicationId: 'app1' });
    });
  });

  test('addContext is no-op outside async context', () => {
    expect(() => addContext({ foo: 'bar' })).not.toThrow();
  });
});

describe('logger', () => {
  let output: string[];

  beforeEach(() => {
    output = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      output.push(chunk.toString());
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logs JSON with context fields inside async context', async () => {
    asyncLocalStorage.run({ requestId: 'req-1', service: 'bentham-mca-api', api: 'POST /filing' }, () => {
      logger.info('test message');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.level).toBe('info');
    expect(log.requestId).toBe('req-1');
    expect(log.service).toBe('bentham-mca-api');
    expect(log.api).toBe('POST /filing');
    expect(log.msg).toBe('test message');
    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('logs with contextual overrides', async () => {
    asyncLocalStorage.run({ requestId: 'req-2', service: 'test' }, () => {
      logger.info({ applicationId: 'cmq3', durationMs: 100 }, 'done');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.applicationId).toBe('cmq3');
    expect(log.durationMs).toBe(100);
    expect(log.msg).toBe('done');
  });

  test('logs without context when outside async context', async () => {
    logger.info('no context');
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.msg).toBe('no context');
    expect(log.requestId).toBeUndefined();
  });

  test('error level works', async () => {
    asyncLocalStorage.run({ requestId: 'req-3', service: 'test' }, () => {
      logger.error({ error: { message: 'boom', code: 'ERR' } }, 'failed');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.level).toBe('error');
    expect(log.error).toEqual({ message: 'boom', code: 'ERR' });
  });
});

describe('middleware/requestContext', () => {
  test('creates context with requestId and service', (done) => {
    const mw = requestContext({ service: 'bentham-app' });
    const req = { method: 'GET', path: '/api/test', headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    mw(req, res, () => {
      const ctx = getContext();
      expect(ctx.service).toBe('bentham-app');
      expect(ctx.api).toBe('GET /api/test');
      expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', ctx.requestId);
      done();
    });
  });

  test('uses incoming x-request-id header', (done) => {
    const mw = requestContext({ service: 'test' });
    const req = { method: 'POST', path: '/filing', headers: { 'x-request-id': 'ext-123' } } as any;
    const res = { setHeader: jest.fn() } as any;

    mw(req, res, () => {
      expect(getContext().requestId).toBe('ext-123');
      done();
    });
  });

  test('extractors populate context', (done) => {
    const mw = requestContext({
      service: 'test',
      extractors: { userId: (req: any) => req.user?.id },
    });
    const req = { method: 'GET', path: '/', headers: {}, user: { id: 'u-42' } } as any;
    const res = { setHeader: jest.fn() } as any;

    mw(req, res, () => {
      expect(getContext().userId).toBe('u-42');
      done();
    });
  });

  test('extractors skip null/undefined values', (done) => {
    const mw = requestContext({
      service: 'test',
      extractors: { userId: () => undefined },
    });
    const req = { method: 'GET', path: '/', headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    mw(req, res, () => {
      expect(getContext()).not.toHaveProperty('userId');
      done();
    });
  });
});

describe('middleware/requestLogger', () => {
  let output: string[];

  beforeEach(() => {
    output = [];
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      output.push(chunk.toString());
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createMockReq(overrides: Record<string, any> = {}) {
    return { method: 'POST', originalUrl: '/api/v1/files', path: '/api/v1/files', headers: {}, body: {}, ...overrides } as any;
  }

  function createMockRes() {
    const listeners: Record<string, Function[]> = {};
    const res: any = {
      statusCode: 200,
      setHeader: jest.fn(),
      json: jest.fn(),
      on(event: string, fn: Function) { (listeners[event] ??= []).push(fn); return res; },
      emit(event: string) { listeners[event]?.forEach(fn => fn()); },
    };
    return res;
  }

  test('logs method, path, status, and duration on finish', async () => {
    const mw = requestLogger({ service: 'bentham-storage-api' });
    const req = createMockReq();
    const res = createMockRes();

    mw(req, res, () => {
      res.statusCode = 200;
      res.emit('finish');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.method).toBe('POST');
    expect(log.path).toBe('/api/v1/files');
    expect(log.status).toBe(200);
    expect(log.duration).toMatch(/^\d+ms$/);
    expect(log.level).toBe('info');
  });

  test('sets x-request-id response header', (done) => {
    const mw = requestLogger({ service: 'test' });
    const req = createMockReq();
    const res = createMockRes();

    mw(req, res, () => {
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.stringMatching(/^[0-9a-f-]{36}$/));
      done();
    });
  });

  test('uses incoming x-request-id', (done) => {
    const mw = requestLogger({ service: 'test' });
    const req = createMockReq({ headers: { 'x-request-id': 'ext-456' } });
    const res = createMockRes();

    mw(req, res, () => {
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'ext-456');
      expect(getContext().requestId).toBe('ext-456');
      done();
    });
  });

  test('logs request body when present', async () => {
    const mw = requestLogger({ service: 'test' });
    const req = createMockReq({ body: { file: 'test.pdf' } });
    const res = createMockRes();

    mw(req, res, () => {
      res.emit('finish');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.request).toContain('test.pdf');
  });

  test('logs response body captured via res.json', async () => {
    const mw = requestLogger({ service: 'test' });
    const req = createMockReq();
    const res = createMockRes();

    mw(req, res, () => {
      res.json({ success: true, url: 'https://example.com' });
      res.emit('finish');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.response).toContain('example.com');
  });

  test('skips body logging for excludePaths', async () => {
    const mw = requestLogger({ service: 'test', excludePaths: ['/health'] });
    const req = createMockReq({ originalUrl: '/health', path: '/health', body: { secret: 'x' } });
    const res = createMockRes();

    mw(req, res, () => {
      res.json({ status: 'ok' });
      res.emit('finish');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.request).toBeUndefined();
    expect(log.response).toBeUndefined();
  });

  test('truncates body to maxBodyLen', async () => {
    const mw = requestLogger({ service: 'test', maxBodyLen: 20 });
    const req = createMockReq({ body: { data: 'a'.repeat(100) } });
    const res = createMockRes();

    mw(req, res, () => {
      res.emit('finish');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.request.length).toBeLessThanOrEqual(23); // 20 + '...'
    expect(log.request).toMatch(/\.\.\.$/);
  });

  test('logs at error level for 4xx/5xx', async () => {
    const mw = requestLogger({ service: 'test' });
    const req = createMockReq();
    const res = createMockRes();

    mw(req, res, () => {
      res.statusCode = 500;
      res.emit('finish');
    });
    await flushLogs();
    const log = JSON.parse(output[0]);
    expect(log.level).toBe('error');
  });

  test('establishes AsyncLocalStorage context for downstream handlers', (done) => {
    const mw = requestLogger({ service: 'bentham-app' });
    const req = createMockReq({ method: 'GET', path: '/api/test', originalUrl: '/api/test' });
    const res = createMockRes();

    mw(req, res, () => {
      const ctx = getContext();
      expect(ctx.service).toBe('bentham-app');
      expect(ctx.api).toBe('GET /api/test');
      expect(ctx.requestId).toBeDefined();
      done();
    });
  });
});
