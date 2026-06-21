import { generateHmacHeaders, verifyHmacSignature } from '../../src/hmac/index';

describe('generateHmacHeaders', () => {
  it('returns all three required headers', () => {
    const headers = generateHmacHeaders('POST', '/api/test', '{}', 'secret', 'my-service');
    expect(headers['x-service-id']).toBe('my-service');
    expect(headers['x-timestamp']).toMatch(/^\d+$/);
    expect(headers['x-signature']).toHaveLength(64);
  });

  it('produces different signatures for different secrets', () => {
    const h1 = generateHmacHeaders('POST', '/api', '{}', 'secret1', 'svc');
    const h2 = generateHmacHeaders('POST', '/api', '{}', 'secret2', 'svc');
    expect(h1['x-signature']).not.toBe(h2['x-signature']);
  });

  it('produces different signatures for different bodies', () => {
    const h1 = generateHmacHeaders('POST', '/api', 'body1', 'secret', 'svc');
    const h2 = generateHmacHeaders('POST', '/api', 'body2', 'secret', 'svc');
    expect(h1['x-signature']).not.toBe(h2['x-signature']);
  });
});

describe('verifyHmacSignature', () => {
  const secret = 'test-secret-key';
  const options = { secret, allowedServices: ['bentham-app', 'bentham-mca-api'] };

  function makeValidRequest(method = 'POST', path = '/api/test', body = '{}') {
    const headers = generateHmacHeaders(method, path, body, secret, 'bentham-app');
    return { method, path, body, headers };
  }

  it('returns valid for correct signature', () => {
    const req = makeValidRequest();
    expect(verifyHmacSignature(req, options)).toEqual({ valid: true });
  });

  it('rejects missing headers', () => {
    const result = verifyHmacSignature(
      { method: 'POST', path: '/api', body: '{}', headers: {} },
      options,
    );
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('Missing auth headers');
  });

  it('rejects unknown service', () => {
    const headers = generateHmacHeaders('POST', '/api', '{}', secret, 'unknown-service');
    const result = verifyHmacSignature(
      { method: 'POST', path: '/api', body: '{}', headers },
      options,
    );
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toBe('Service not allowed');
  });

  it('rejects expired timestamps', () => {
    const headers = generateHmacHeaders('POST', '/api', '{}', secret, 'bentham-app');
    headers['x-timestamp'] = '1000000000'; // very old
    const result = verifyHmacSignature(
      { method: 'POST', path: '/api', body: '{}', headers },
      options,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Request expired');
  });

  it('rejects tampered body', () => {
    const req = makeValidRequest('POST', '/api', '{"original": true}');
    req.body = '{"tampered": true}';
    const result = verifyHmacSignature(req, options);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('rejects empty secret', () => {
    const req = makeValidRequest();
    const result = verifyHmacSignature(req, { ...options, secret: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Auth not configured');
  });
});

describe('hmacAuthMiddleware', () => {
  const { hmacAuthMiddleware, generateHmacHeaders } = require('../../src/hmac/index');
  const secret = 'middleware-test-secret';
  const allowedServices = ['bentham-app', 'bentham-mca-api'];

  function makeMocks() {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    return { next, res };
  }

  function makeReq(overrides: any = {}) {
    const body = overrides.body ?? {};
    const headers = generateHmacHeaders(
      overrides.method ?? 'POST',
      overrides.originalUrl ?? '/api/test',
      JSON.stringify(body),
      secret,
      overrides.serviceId ?? 'bentham-app',
    );
    return {
      method: overrides.method ?? 'POST',
      originalUrl: overrides.originalUrl ?? '/api/test',
      body,
      headers: { ...headers, ...overrides.headers },
    };
  }

  const middleware = hmacAuthMiddleware({ secret, allowedServices });

  it('calls next() for valid HMAC', () => {
    const { next, res } = makeMocks();
    middleware(makeReq(), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 for missing headers', () => {
    const { next, res } = makeMocks();
    middleware({ method: 'POST', originalUrl: '/api', body: {}, headers: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Missing auth headers' });
  });

  it('returns 401 for invalid signature', () => {
    const { next, res } = makeMocks();
    const req = makeReq();
    req.headers['x-signature'] = 'invalid';
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for unknown service', () => {
    const { next, res } = makeMocks();
    const req = makeReq({ serviceId: 'unknown-svc' });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Service not allowed' });
  });

  it('returns 401 for expired timestamp', () => {
    const { next, res } = makeMocks();
    const req = makeReq();
    req.headers['x-timestamp'] = '1000000000';
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('skips verification in development mode', () => {
    const { next, res } = makeMocks();
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const devMiddleware = hmacAuthMiddleware({ secret, allowedServices });
    devMiddleware({ method: 'GET', originalUrl: '/', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    process.env.NODE_ENV = prev;
  });
});
