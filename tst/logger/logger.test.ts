import { asyncLocalStorage } from '../../src/logger/context';
import { getContext, addContext } from '../../src/logger/context';
import { logger } from '../../src/logger/logger';
import { requestContext } from './middleware';

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

  test('logs JSON with context fields inside async context', () => {
    asyncLocalStorage.run({ requestId: 'req-1', service: 'bentham-mca-api', api: 'POST /filing' }, () => {
      logger.info('test message');
    });
    const log = JSON.parse(output[0]);
    expect(log.level).toBe('info');
    expect(log.requestId).toBe('req-1');
    expect(log.service).toBe('bentham-mca-api');
    expect(log.api).toBe('POST /filing');
    expect(log.msg).toBe('test message');
    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('logs with contextual overrides', () => {
    asyncLocalStorage.run({ requestId: 'req-2', service: 'test' }, () => {
      logger.info({ applicationId: 'cmq3', durationMs: 100 }, 'done');
    });
    const log = JSON.parse(output[0]);
    expect(log.applicationId).toBe('cmq3');
    expect(log.durationMs).toBe(100);
    expect(log.msg).toBe('done');
  });

  test('logs without context when outside async context', () => {
    logger.info('no context');
    const log = JSON.parse(output[0]);
    expect(log.msg).toBe('no context');
    expect(log.requestId).toBeUndefined();
  });

  test('error level works', () => {
    asyncLocalStorage.run({ requestId: 'req-3', service: 'test' }, () => {
      logger.error({ error: { message: 'boom', code: 'ERR' } }, 'failed');
    });
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
      extractors: { userId: (req) => req.user?.id },
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
