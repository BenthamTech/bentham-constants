"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookCallbackClient = void 0;
const hmac_1 = require("../hmac");
const fetch_1 = require("../fetch");
const logger_1 = require("../logger/logger");
const context_1 = require("../logger/context");
/**
 * HMAC-authenticated webhook client with retry.
 * Extracted from bentham-mca-api and bentham_trademark_api WebhookHelper modules.
 */
class WebhookCallbackClient {
    constructor(opts) {
        this.hmacSecret = opts.hmacSecret;
        this.serviceName = opts.serviceName;
        this.baseUrl = opts.baseUrl.replace(/\/$/, '');
        this.maxRetries = opts.maxRetries ?? 1;
        this.retryDelayMs = opts.retryDelayMs ?? 5000;
        this.timeoutMs = opts.timeoutMs ?? 10000;
    }
    /**
     * Send a webhook callback with HMAC auth and retry.
     * Logs success/failure but never throws — safe for fire-and-forget usage.
     * @param path - API path (e.g. '/api/webhooks/company-filing/status')
     * @param payload - JSON-serializable payload
     */
    async send(path, payload) {
        const url = `${this.baseUrl}${path}`;
        let body;
        let headers;
        try {
            body = JSON.stringify(payload);
            const hmacHeaders = (0, hmac_1.generateHmacHeaders)('POST', path, body, this.hmacSecret, this.serviceName);
            const { requestId } = (0, context_1.getContext)();
            headers = {
                'Content-Type': 'application/json',
                ...hmacHeaders,
            };
            if (requestId) {
                headers['x-request-id'] = requestId;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger_1.logger.error({ path, error: message, service: this.serviceName }, `Webhook ${path} setup failed: ${message}`);
            return;
        }
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const res = await (0, fetch_1.fetchExternal)(url, { method: 'POST', headers, body }, this.timeoutMs);
                if (res.ok) {
                    logger_1.logger.info({ path, attempt, service: this.serviceName }, `Webhook delivered to ${path}`);
                    return;
                }
                logger_1.logger.warn({ path, attempt, status: res.status, service: this.serviceName }, `Webhook ${path} returned ${res.status}`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger_1.logger.warn({ path, attempt, error: message, service: this.serviceName }, `Webhook ${path} attempt ${attempt} failed: ${message}`);
            }
            if (attempt < this.maxRetries) {
                await new Promise((r) => setTimeout(r, this.retryDelayMs));
            }
        }
        logger_1.logger.error({ path, maxRetries: this.maxRetries, service: this.serviceName }, `Webhook ${path} failed after ${this.maxRetries + 1} attempts`);
    }
    /**
     * Fire-and-forget variant — catches all errors internally.
     * Use this when webhook delivery should not block the caller.
     */
    fireAndForget(path, payload) {
        this.send(path, payload).catch(() => { });
    }
}
exports.WebhookCallbackClient = WebhookCallbackClient;
