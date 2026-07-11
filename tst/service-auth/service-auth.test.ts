import { createServiceAuth } from '../../src/service-auth/index';
import { verifyHmacSignature } from '../../src/hmac/index';

describe('createServiceAuth', () => {
  const ENV_VAR = 'TEST_HMAC_SECRET';
  const SECRET = 'test-shared-secret-123';
  const SERVICE_NAME = 'bentham-mca-api';

  beforeEach(() => {
    process.env[ENV_VAR] = SECRET;
  });

  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  it('returns a function', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    expect(typeof auth).toBe('function');
  });

  it('generates valid HMAC headers with string body', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const headers = auth('POST', '/api/v1/files', '{"url":"test"}');

    expect(headers['x-service-id']).toBe(SERVICE_NAME);
    expect(headers['x-timestamp']).toMatch(/^\d+$/);
    expect(headers['x-signature']).toHaveLength(64);
  });

  it('generates valid HMAC headers with object body', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const headers = auth('POST', '/api/v1/files', { url: 'test' });

    expect(headers['x-service-id']).toBe(SERVICE_NAME);
    expect(headers['x-signature']).toHaveLength(64);
  });

  it('generates valid HMAC headers with no body', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const headers = auth('GET', '/api/v1/health');

    expect(headers['x-service-id']).toBe(SERVICE_NAME);
    expect(headers['x-signature']).toHaveLength(64);
  });

  it('produces headers that pass verification', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const body = JSON.stringify({ url: 'https://storage.bentham.legal/file.pdf' });
    const headers = auth('POST', '/api/v1/files/signed_url', body);

    const result = verifyHmacSignature(
      { method: 'POST', path: '/api/v1/files/signed_url', body, headers },
      { secret: SECRET, allowedServices: [SERVICE_NAME] },
    );

    expect(result).toEqual({ valid: true });
  });

  it('reads secret at call time, not factory time', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);

    // Change the secret after creating the auth function
    const newSecret = 'rotated-secret-456';
    process.env[ENV_VAR] = newSecret;

    const body = '{}';
    const headers = auth('POST', '/api/test', body);

    // Should verify against the NEW secret
    const result = verifyHmacSignature(
      { method: 'POST', path: '/api/test', body, headers },
      { secret: newSecret, allowedServices: [SERVICE_NAME] },
    );

    expect(result).toEqual({ valid: true });
  });

  it('returns empty-secret headers when env var is not set', () => {
    delete process.env[ENV_VAR];

    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const headers = auth('POST', '/api/test', '{}');

    // Still returns headers (with empty-string secret signature)
    expect(headers['x-service-id']).toBe(SERVICE_NAME);
    expect(headers['x-timestamp']).toMatch(/^\d+$/);
    expect(headers['x-signature']).toHaveLength(64);
  });

  it('produces different signatures for different methods', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const h1 = auth('GET', '/api/test', '{}');
    const h2 = auth('POST', '/api/test', '{}');

    expect(h1['x-signature']).not.toBe(h2['x-signature']);
  });

  it('produces different signatures for different paths', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const h1 = auth('POST', '/api/v1/files', '{}');
    const h2 = auth('POST', '/api/v1/users', '{}');

    expect(h1['x-signature']).not.toBe(h2['x-signature']);
  });

  it('object body produces same signature as equivalent JSON string', () => {
    const auth = createServiceAuth(ENV_VAR, SERVICE_NAME);
    const obj = { key: 'value', num: 42 };
    const h1 = auth('POST', '/api/test', obj);
    const h2 = auth('POST', '/api/test', JSON.stringify(obj));

    expect(h1['x-signature']).toBe(h2['x-signature']);
  });
});
