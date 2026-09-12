"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchExternal = fetchExternal;
const logger_1 = require("../logger/logger");
/**
 * Wrapper around native fetch that logs request/response for external service calls.
 * Returns the unmodified Response object.
 */
async function fetchExternal(url, options, timeoutMs) {
    const method = (options?.method || 'GET').toUpperCase();
    const parsedUrl = new URL(url.toString());
    const pathname = parsedUrl.pathname;
    const start = Date.now();
    logger_1.logger.info({ method, url: url.toString(), timeout: timeoutMs }, `→ ${method} ${pathname}`);
    const fetchOptions = { ...options };
    if (timeoutMs) {
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        fetchOptions.signal = options?.signal
            ? AbortSignal.any([options.signal, timeoutSignal])
            : timeoutSignal;
    }
    let response;
    try {
        response = await fetch(url, fetchOptions);
    }
    catch (err) {
        const duration = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error({ method, url: url.toString(), duration, error: message }, `← ERROR ${message}`);
        throw err;
    }
    const duration = Date.now() - start;
    if (response.ok) {
        logger_1.logger.info({ method, url: url.toString(), status: response.status, duration }, `← ${response.status} (${duration}ms)`);
    }
    else {
        let body = '';
        try {
            body = await response.clone().text();
            if (body.length > 500)
                body = body.slice(0, 500);
        }
        catch { /* ignore body read failures */ }
        logger_1.logger.error({ method, url: url.toString(), status: response.status, duration, body }, `← ${response.status} (${duration}ms) ${body}`);
    }
    return response;
}
