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
export declare function decodeCaptcha(imageBuffer: Buffer, serviceName: string): Promise<string | null>;
/**
 * Check whether captcha decoding is available (env var + service URL configured).
 */
export declare function isCaptchaAvailable(): boolean;
