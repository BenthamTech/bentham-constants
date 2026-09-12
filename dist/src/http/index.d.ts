import { ServiceAuthFn } from '../service-auth';
export interface BaseServiceClientOptions {
    /** Base URL of the target service (e.g. 'https://api.storage.bentham.legal') */
    baseUrl: string;
    /** Either a pre-built auth function or config for auto-creation */
    auth: ServiceAuthFn | {
        secretEnvVar: string;
        serviceName: string;
    };
    /** Request timeout in milliseconds (default: 10000) */
    timeout?: number;
}
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
export declare class BaseServiceClient {
    protected readonly baseUrl: string;
    protected readonly authFn: ServiceAuthFn;
    protected readonly timeout: number;
    constructor(opts: BaseServiceClientOptions);
    protected buildUrl(path: string): string;
    protected traceHeaders(): Record<string, string>;
    /**
     * Make a JSON POST request. Returns parsed response body.
     * Throws on network errors or non-2xx responses.
     */
    post<T = unknown>(path: string, payload: unknown): Promise<T>;
    /**
     * Make a JSON GET request. Returns parsed response body.
     * Throws on network errors or non-2xx responses.
     */
    get<T = unknown>(path: string): Promise<T>;
    /**
     * Make a raw HTTP request. Returns the unmodified Response object.
     * Useful when you need to handle the response stream or non-JSON bodies.
     */
    request(method: string, path: string, body?: string | null, extraHeaders?: Record<string, string>): Promise<Response>;
    /**
     * Make a raw request where the over-the-wire body differs from the HMAC body.
     * Used for binary/FormData uploads where HMAC is computed over a JSON descriptor
     * but the actual body is the raw file content.
     */
    requestRaw(method: string, path: string, rawBody: BodyInit, hmacBody: string, extraHeaders?: Record<string, string>): Promise<Response>;
}
/**
 * Error thrown when a service responds with a non-2xx status code.
 */
export declare class ServiceClientError extends Error {
    readonly status: number;
    readonly path: string;
    readonly responseBody: string;
    constructor(status: number, path: string, responseBody: string);
}
