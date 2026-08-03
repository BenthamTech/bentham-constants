import { decodeCaptcha, isCaptchaAvailable } from '../../src/captcha/index';
import { fetchExternal } from '../../src/fetch/index';
import { logger } from '../../src/logger/logger';

jest.mock('../../src/fetch/index', () => ({
  fetchExternal: jest.fn(),
}));

jest.mock('../../src/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockFetchExternal = fetchExternal as jest.MockedFunction<typeof fetchExternal>;

const TEST_IMAGE = Buffer.from('fake-captcha-png');
const SERVICE_NAME = 'bentham-test';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC = 'test-secret-123';
});

afterEach(() => {
  delete process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC;
});

describe('decodeCaptcha', () => {
  it('returns decoded text on success', async () => {
    mockFetchExternal.mockResolvedValue(
      new Response(JSON.stringify({ success: true, text: 'ABC123' }), { status: 200 }),
    );

    const result = await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    expect(result).toBe('ABC123');
    expect(mockFetchExternal).toHaveBeenCalledWith(
      'https://api.document-validator.bentham.legal/api/v1/captcha/decode',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: TEST_IMAGE.toString('base64') }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
      10_000,
    );
  });

  it('returns null when HMAC env var is missing', async () => {
    delete process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC;

    const result = await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('BENTHAM_DOCUMENT_VALIDATOR_API_HMAC not configured');
    expect(mockFetchExternal).not.toHaveBeenCalled();
  });

  it('returns null on non-2xx API response', async () => {
    mockFetchExternal.mockResolvedValue(
      new Response('Service Unavailable', { status: 503 }),
    );

    const result = await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      'Captcha decode API error',
    );
  });

  it('returns null when API returns success:false', async () => {
    mockFetchExternal.mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );

    const result = await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    expect(result).toBeNull();
  });

  it('returns null when API returns empty text', async () => {
    mockFetchExternal.mockResolvedValue(
      new Response(JSON.stringify({ success: true, text: '' }), { status: 200 }),
    );

    const result = await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetchExternal.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'ECONNREFUSED' }),
      'Captcha decode request failed',
    );
  });

  it('includes HMAC auth headers in the request', async () => {
    mockFetchExternal.mockResolvedValue(
      new Response(JSON.stringify({ success: true, text: 'XYZ' }), { status: 200 }),
    );

    await decodeCaptcha(TEST_IMAGE, SERVICE_NAME);

    const callHeaders = mockFetchExternal.mock.calls[0][1]?.headers as Record<string, string>;
    expect(callHeaders['x-service-id']).toBe(SERVICE_NAME);
    expect(callHeaders['x-timestamp']).toBeDefined();
    expect(callHeaders['x-signature']).toBeDefined();
  });
});

describe('isCaptchaAvailable', () => {
  it('returns true when HMAC env var is set', () => {
    process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC = 'some-secret';
    expect(isCaptchaAvailable()).toBe(true);
  });

  it('returns false when HMAC env var is missing', () => {
    delete process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC;
    expect(isCaptchaAvailable()).toBe(false);
  });

  it('returns false when HMAC env var is empty string', () => {
    process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC = '';
    expect(isCaptchaAvailable()).toBe(false);
  });
});
