"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = requestContext;
exports.requestLogger = requestLogger;
exports.withRequestContext = withRequestContext;
const node_crypto_1 = require("node:crypto");
const context_1 = require("./context");
const logger_1 = require("./logger");
function truncate(obj, maxLen) {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
function requestContext(opts) {
    return (req, res, next) => {
        const requestId = req.headers['x-request-id'] || (0, node_crypto_1.randomUUID)();
        const api = `${req.method} ${req.route?.path || req.path || req.url}`;
        const context = { requestId, service: opts.service, api };
        if (opts.extractors) {
            for (const [key, extractor] of Object.entries(opts.extractors)) {
                const value = extractor(req);
                if (value !== undefined && value !== null)
                    context[key] = value;
            }
        }
        // Set response header for tracing
        res.setHeader('x-request-id', requestId);
        context_1.asyncLocalStorage.run(context, () => next());
    };
}
/**
 * Combined request context + request/response logging middleware.
 * Sets up AsyncLocalStorage context AND logs method/path/status/duration/bodies.
 */
function requestLogger(opts) {
    const maxLen = opts.maxBodyLen ?? 500;
    const excludePaths = opts.excludePaths ?? [];
    return (req, res, next) => {
        const start = Date.now();
        const requestId = req.headers['x-request-id'] || (0, node_crypto_1.randomUUID)();
        const { method, originalUrl } = req;
        const context = { requestId, service: opts.service, api: `${method} ${req.path || req.url}` };
        if (opts.extractors) {
            for (const [key, extractor] of Object.entries(opts.extractors)) {
                const value = extractor(req);
                if (value !== undefined && value !== null)
                    context[key] = value;
            }
        }
        res.setHeader('x-request-id', requestId);
        // Capture response body by wrapping res.json
        const originalJson = res.json.bind(res);
        let responseBody;
        res.json = (body) => {
            responseBody = body;
            return originalJson(body);
        };
        res.on('finish', () => {
            const duration = Date.now() - start;
            // req.route is available after route matching (only in finish callback)
            const api = `${method} ${req.route?.path || req.path || req.url}`;
            context.api = api;
            const excluded = excludePaths.some((p) => originalUrl.startsWith(p));
            const logEntry = {
                method,
                path: originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
            };
            if (!excluded) {
                if (req.body && Object.keys(req.body).length > 0)
                    logEntry.request = truncate(req.body, maxLen);
                if (responseBody)
                    logEntry.response = truncate(responseBody, maxLen);
            }
            const level = res.statusCode >= 400 ? 'error' : 'info';
            logger_1.logger[level](logEntry, `${api} ${res.statusCode} (${duration}ms)`);
        });
        context_1.asyncLocalStorage.run(context, () => next());
    };
}
// Next.js API route wrapper
function withRequestContext(opts) {
    return (handler) => {
        return (req, res) => {
            const requestId = req.headers['x-request-id'] || (0, node_crypto_1.randomUUID)();
            const api = `${req.method} ${req.url}`;
            const context = { requestId, service: opts.service, api };
            if (opts.extractors) {
                for (const [key, extractor] of Object.entries(opts.extractors)) {
                    const value = extractor(req);
                    if (value !== undefined && value !== null)
                        context[key] = value;
                }
            }
            res.setHeader('x-request-id', requestId);
            return context_1.asyncLocalStorage.run(context, () => handler(req, res));
        };
    };
}
