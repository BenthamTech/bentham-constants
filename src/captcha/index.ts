import { createServiceAuth } from '../service-auth';
import { serviceUrls } from '../config';
import { fetchExternal } from '../fetch';
import { logger } from '../logger/logger';

const CAPTCHA_DECODE_PATH = '/api/v1/captcha/decode';
const TIMEOUT_MS = 10_000;

/**
 * Decode a captcha image using the document-validator service.
 *
 * @param imageBuffer - Raw image buffer (PNG/JPEG captcha screenshot)
 * @param serviceName - Name of the calling service for HMAC x-service-id header
 * @returns Decoded captcha text, or null on failure
 *
 * @example
 * ```ts
 * import { decodeCaptcha } from '@bentham/constants/captcha';
 * const text = await decodeCaptcha(screenshotBuffer, 'bentham-mca-api');
 * ```
 */
export async function decodeCaptcha(
  imageBuffer: Buffer,
  serviceName: string,
): Promise<string | null> {
  const secret = process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC;
  if (!secret) {
    logger.error('BENTHAM_DOCUMENT_VALIDATOR_API_HMAC not configured');
    return null;
  }

  const auth = createServiceAuth('BENTHAM_DOCUMENT_VALIDATOR_API_HMAC', serviceName);
  const body = JSON.stringify({ image: imageBuffer.toString('base64') });
  const headers = auth('POST', CAPTCHA_DECODE_PATH, body);

  try {
    const response = await fetchExternal(
      `${serviceUrls.documentValidator}${CAPTCHA_DECODE_PATH}`,
      { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } },
      TIMEOUT_MS,
    );
    if (!response.ok) {
      logger.error({ status: response.status }, 'Captcha decode API error');
      return null;
    }
    const data = await response.json();
    return data.success && data.text ? data.text : null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Captcha decode request failed');
    return null;
  }
}

/**
 * Check whether captcha decoding is available (env var + service URL configured).
 */
export function isCaptchaAvailable(): boolean {
  return Boolean(process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC && serviceUrls.documentValidator);
}
