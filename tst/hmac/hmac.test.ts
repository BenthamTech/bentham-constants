import { generateHmacHeaders, verifyHmacSignature, verifyServiceRequest } from '../../src/hmac/index';

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

  it('rejects a non-numeric timestamp instead of treating it as fresh', () => {
    const headers = generateHmacHeaders('POST', '/api', '{}', secret, 'bentham-app');
    headers['x-timestamp'] = 'not-a-number';
    const result = verifyHmacSignature(
      { method: 'POST', path: '/api', body: '{}', headers },
      options,
    );
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('Invalid timestamp');
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

  const middleware = hmacAuthMiddleware({ secret, allowedServices, skipInTest: false });

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

  it('skips verification in test mode by default', () => {
    const { next, res } = makeMocks();
    const testMiddleware = hmacAuthMiddleware({ secret, allowedServices });
    testMiddleware({ method: 'GET', originalUrl: '/', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enforces verification in test mode when skipInTest is false', () => {
    const { next, res } = makeMocks();
    const strictMiddleware = hmacAuthMiddleware({ secret, allowedServices, skipInTest: false });
    strictMiddleware({ method: 'GET', originalUrl: '/', body: {}, headers: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('skips verification for paths in skipPaths', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/api/v1/public', '/health'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/api/v1/public/data', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enforces verification for paths not in skipPaths', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/api/v1/public'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/api/v1/private', body: {}, headers: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('matches skipPaths on path boundaries (subpath allowed)', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/health'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/health/check', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('does not skip paths that share a prefix but lack a boundary', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/health'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/healthadmin', body: {}, headers: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('skips exact path match in skipPaths', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/health'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/health', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips paths with query parameters when path matches skipPaths', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/api/v1/mca/din/associations'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/api/v1/mca/din/associations?din=12345678', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips subpath with query parameters when parent matches skipPaths', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/api/v1/public'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/api/v1/public/data?page=1&limit=10', body: {}, headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not skip paths that share prefix but lack boundary even with query params', () => {
    const { next, res } = makeMocks();
    const skipMiddleware = hmacAuthMiddleware({
      secret,
      allowedServices,
      skipInTest: false,
      skipPaths: ['/health'],
    });
    skipMiddleware({ method: 'GET', originalUrl: '/healthadmin?check=true', body: {}, headers: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('verifyServiceRequest', () => {
  const secret = 'service-request-secret';
  const options = { secret, allowedServices: ['bentham-app', 'bentham-mca-api'] };
  const url = 'https://app.example.com/api/webhooks/trademark-filing/status?x=1';
  const pathname = '/api/webhooks/trademark-filing/status';

  function signedRequest(
    body: string,
    { method = 'POST', serviceId = 'bentham-app', url: reqUrl = url, headerOverrides = {} as Record<string, string> } = {},
  ) {
    const headers = generateHmacHeaders(method, pathname, body, secret, serviceId);
    const merged = { ...headers, ...headerOverrides };
    const init: RequestInit = { method, headers: merged };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = body;
    }
    return new Request(reqUrl, init);
  }

  it('accepts a valid signed request and returns the parsed body + raw body', async () => {
    const body = JSON.stringify({ status: 'approved', markId: 42 });
    const result = await verifyServiceRequest<{ status: string; markId: number }>(
      signedRequest(body),
      options,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.rawBody).toBe(body);
      expect(result.body).toEqual({ status: 'approved', markId: 42 });
    }
  });

  it('accepts a GET with no body and parses body to undefined', async () => {
    const headers = generateHmacHeaders('GET', pathname, '', secret, 'bentham-app');
    const request = new Request(url, { method: 'GET', headers: { ...headers } });
    const result = await verifyServiceRequest(request, options);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.rawBody).toBe('');
      expect(result.body).toBeUndefined();
    }
  });

  it('rejects missing headers with 401', async () => {
    const request = new Request(url, { method: 'POST', body: '{}' });
    const result = await verifyServiceRequest(request, options);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Missing auth headers');
    }
  });

  it('rejects a service not in allowedServices with 403', async () => {
    const result = await verifyServiceRequest(
      signedRequest('{}', { serviceId: 'rogue-service' }),
      options,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(403);
      expect(result.error).toBe('Service not allowed');
    }
  });

  it('rejects an expired timestamp with 401', async () => {
    const result = await verifyServiceRequest(
      signedRequest('{}', { headerOverrides: { 'x-timestamp': '1000000000' } }),
      options,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Request expired');
    }
  });

  it('rejects a non-numeric timestamp with 401', async () => {
    const result = await verifyServiceRequest(
      signedRequest('{}', { headerOverrides: { 'x-timestamp': 'nope' } }),
      options,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Invalid timestamp');
    }
  });

  it('rejects a tampered body with 401', async () => {
    const headers = generateHmacHeaders('POST', pathname, '{"original":true}', secret, 'bentham-app');
    const request = new Request(url, { method: 'POST', headers: { ...headers }, body: '{"tampered":true}' });
    const result = await verifyServiceRequest(request, options);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Invalid signature');
    }
  });

  it('rejects an empty secret with 401', async () => {
    const result = await verifyServiceRequest(signedRequest('{}'), { ...options, secret: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Auth not configured');
    }
  });

  it('rejects invalid JSON on a signed non-empty body with 400', async () => {
    const bad = 'not-json';
    const headers = generateHmacHeaders('POST', pathname, bad, secret, 'bentham-app');
    const request = new Request(url, { method: 'POST', headers: { ...headers }, body: bad });
    const result = await verifyServiceRequest(request, options);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe('Invalid JSON');
    }
  });
});
