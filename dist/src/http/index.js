"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceClientError = exports.BaseServiceClient = void 0;
const service_auth_1 = require("../service-auth");
const fetch_1 = require("../fetch");
const context_1 = require("../logger/context");
/**
 * General-purpose HMAC-authenticated HTTP client for service-to-service calls.
 * Automatically injects HMAC auth headers and trace headers (x-request-id).
 *
 * @example
 * ```ts
 * import { BaseServiceClient } from '@bentham/constants/http';
 *
 * const storageClient = new BaseServiceClient({
 *   baseUrl: serviceUrls.storage,
 *   auth: { secretEnvVar: 'BENTHAM_STORAGE_API_HMAC', serviceName: 'bentham-mca-api' },
 * });
 *
 * const result = await storageClient.post<{ url: string }>('/api/v1/files/signed_url', { url: fileUrl });
 * ```
 */
class BaseServiceClient {
    constructor(opts) {
        this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
        this.timeout = opts.timeout ?? 10000;
        this.authFn =
            typeof opts.auth === 'function'
                ? opts.auth
                : (0, service_auth_1.createServiceAuth)(opts.auth.secretEnvVar, opts.auth.serviceName);
    }
    buildUrl(path) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${this.baseUrl}${normalizedPath}`;
    }
    traceHeaders() {
        const ctx = (0, context_1.getContext)();
        return ctx.requestId ? { 'x-request-id': ctx.requestId } : {};
    }
    /**
     * Make a JSON POST request. Returns parsed response body.
     * Throws on network errors or non-2xx responses.
     */
    async post(path, payload) {
        const body = JSON.stringify(payload);
        const authHeaders = this.authFn('POST', path, body);
        const response = await (0, fetch_1.fetchExternal)(this.buildUrl(path), {
            method: 'POST',
            body,
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
                ...this.traceHeaders(),
            },
        }, this.timeout);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new ServiceClientError(response.status, path, errorBody);
        }
        return response.json();
    }
    /**
     * Make a JSON GET request. Returns parsed response body.
     * Throws on network errors or non-2xx responses.
     */
    async get(path) {
        const authHeaders = this.authFn('GET', path);
        const response = await (0, fetch_1.fetchExternal)(this.buildUrl(path), {
            method: 'GET',
            headers: {
                ...authHeaders,
                ...this.traceHeaders(),
            },
        }, this.timeout);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new ServiceClientError(response.status, path, errorBody);
        }
        return response.json();
    }
    /**
     * Make a raw HTTP request. Returns the unmodified Response object.
     * Useful when you need to handle the response stream or non-JSON bodies.
     */
    async request(method, path, body, extraHeaders) {
        const authHeaders = this.authFn(method, path, body ?? undefined);
        return (0, fetch_1.fetchExternal)(this.buildUrl(path), {
            method,
            body: body ?? undefined,
            headers: {
                ...authHeaders,
                ...this.traceHeaders(),
                ...extraHeaders,
            },
        }, this.timeout);
    }
    /**
     * Make a raw request where the over-the-wire body differs from the HMAC body.
     * Used for binary/FormData uploads where HMAC is computed over a JSON descriptor
     * but the actual body is the raw file content.
     */
    async requestRaw(method, path, rawBody, hmacBody, extraHeaders) {
        const authHeaders = this.authFn(method, path, hmacBody);
        return (0, fetch_1.fetchExternal)(this.buildUrl(path), {
            method,
            body: rawBody,
            headers: {
                ...authHeaders,
                ...this.traceHeaders(),
                ...extraHeaders,
            },
        }, this.timeout);
    }
}
exports.BaseServiceClient = BaseServiceClient;
/**
 * Error thrown when a service responds with a non-2xx status code.
 */
class ServiceClientError extends Error {
    constructor(status, path, responseBody) {
        super(`Service request failed: ${status} ${path}`);
        this.status = status;
        this.path = path;
        this.responseBody = responseBody;
        this.name = 'ServiceClientError';
    }
}
exports.ServiceClientError = ServiceClientError;
