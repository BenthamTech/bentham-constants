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
