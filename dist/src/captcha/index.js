"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeCaptcha = decodeCaptcha;
exports.isCaptchaAvailable = isCaptchaAvailable;
const service_auth_1 = require("../service-auth");
const config_1 = require("../config");
const fetch_1 = require("../fetch");
const logger_1 = require("../logger/logger");
const CAPTCHA_DECODE_PATH = '/api/v1/captcha/decode';
const TIMEOUT_MS = 10000;
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
async function decodeCaptcha(imageBuffer, serviceName) {
    const secret = process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC;
    if (!secret) {
        logger_1.logger.error('BENTHAM_DOCUMENT_VALIDATOR_API_HMAC not configured');
        return null;
    }
    const auth = (0, service_auth_1.createServiceAuth)('BENTHAM_DOCUMENT_VALIDATOR_API_HMAC', serviceName);
    const body = JSON.stringify({ image: imageBuffer.toString('base64') });
    const headers = auth('POST', CAPTCHA_DECODE_PATH, body);
    try {
        const response = await (0, fetch_1.fetchExternal)(`${config_1.serviceUrls.documentValidator}${CAPTCHA_DECODE_PATH}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } }, TIMEOUT_MS);
        if (!response.ok) {
            logger_1.logger.error({ status: response.status }, 'Captcha decode API error');
            return null;
        }
        const data = await response.json();
        return data.success && data.text ? data.text : null;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger_1.logger.error({ error: message }, 'Captcha decode request failed');
        return null;
    }
}
/**
 * Check whether captcha decoding is available (env var + service URL configured).
 */
function isCaptchaAvailable() {
    return Boolean(process.env.BENTHAM_DOCUMENT_VALIDATOR_API_HMAC && config_1.serviceUrls.documentValidator);
}
