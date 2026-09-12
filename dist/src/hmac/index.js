"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHmacHeaders = generateHmacHeaders;
exports.verifyHmacSignature = verifyHmacSignature;
exports.hmacAuthMiddleware = hmacAuthMiddleware;
const crypto_1 = require("crypto");
const logger_1 = require("../logger/logger");
/**
 * Generate HMAC authentication headers for service-to-service requests.
 * Signs: METHOD:PATH:TIMESTAMP:SHA256(body)
 */
function generateHmacHeaders(method, path, body, secret, serviceId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyHash = (0, crypto_1.createHash)('sha256').update(body).digest('hex');
    const message = [method, path, timestamp, bodyHash].join(':');
    const signature = (0, crypto_1.createHmac)('sha256', secret).update(message).digest('hex');
    return { 'x-service-id': serviceId, 'x-timestamp': timestamp, 'x-signature': signature };
}
/**
 * Verify HMAC signature on an incoming request.
 * Returns { valid: true } or { valid: false, error, statusCode }.
 */
function verifyHmacSignature(req, options) {
    const { secret, allowedServices, maxAgeSeconds = 300 } = options;
    if (!secret) {
        return { valid: false, error: 'Auth not configured', statusCode: 401 };
    }
    const serviceId = req.headers['x-service-id'];
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];
    if (!serviceId || !timestamp || !signature) {
        return { valid: false, error: 'Missing auth headers', statusCode: 401 };
    }
    if (!allowedServices.includes(serviceId)) {
        return { valid: false, error: 'Service not allowed', statusCode: 403 };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > maxAgeSeconds) {
        return { valid: false, error: 'Request expired', statusCode: 401 };
    }
    const bodyHash = (0, crypto_1.createHash)('sha256').update(req.body).digest('hex');
    const message = [req.method, req.path, timestamp, bodyHash].join(':');
    const expectedSignature = (0, crypto_1.createHmac)('sha256', secret).update(message).digest('hex');
    try {
        if (!(0, crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return { valid: false, error: 'Invalid signature', statusCode: 401 };
        }
    }
    catch {
        return { valid: false, error: 'Invalid signature', statusCode: 401 };
    }
    return { valid: true };
}
/**
 * Express middleware that verifies HMAC signatures on incoming requests.
 * Wraps verifyHmacSignature with request/response handling.
 */
function hmacAuthMiddleware(opts) {
    const { secret, allowedServices, skipInDev = true, skipInTest = true, maxAgeSeconds = 300, skipPaths = [] } = opts;
    return (req, res, next) => {
        if (skipInDev && process.env.NODE_ENV === 'development') {
            return next();
        }
        if (skipInTest && process.env.NODE_ENV === 'test') {
            return next();
        }
        if (skipPaths.length > 0) {
            const urlPath = req.originalUrl.split('?')[0];
            if (skipPaths.some((p) => urlPath === p || urlPath.startsWith(p + '/'))) {
                return next();
            }
        }
        const result = verifyHmacSignature({
            method: req.method,
            path: req.originalUrl,
            body: JSON.stringify(req.body || {}),
            headers: req.headers,
        }, { secret, allowedServices, maxAgeSeconds });
        if (result.valid) {
            return next();
        }
        const serviceId = req.headers['x-service-id'] || 'unknown';
        logger_1.logger.error({ serviceId, path: req.originalUrl, error: result.error }, 'HMAC auth rejected');
        res.status(result.statusCode ?? 401).json({ success: false, message: result.error });
    };
}
