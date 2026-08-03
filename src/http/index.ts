import { createServiceAuth, ServiceAuthFn } from '../service-auth';
import { fetchExternal } from '../fetch';
import { getContext } from '../logger/context';

export interface BaseServiceClientOptions {
  /** Base URL of the target service (e.g. 'https://api.storage.bentham.legal') */
  baseUrl: string;
  /** Either a pre-built auth function or config for auto-creation */
  auth: ServiceAuthFn | { secretEnvVar: string; serviceName: string };
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
export class BaseServiceClient {
  protected readonly baseUrl: string;
  protected readonly authFn: ServiceAuthFn;
  protected readonly timeout: number;

  constructor(opts: BaseServiceClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.timeout = opts.timeout ?? 10_000;
    this.authFn =
      typeof opts.auth === 'function'
        ? opts.auth
        : createServiceAuth(opts.auth.secretEnvVar, opts.auth.serviceName);
  }

  protected buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  protected traceHeaders(): Record<string, string> {
    const ctx = getContext();
    return ctx.requestId ? { 'x-request-id': ctx.requestId } : {};
  }

  /**
   * Make a JSON POST request. Returns parsed response body.
   * Throws on network errors or non-2xx responses.
   */
  async post<T = unknown>(path: string, payload: unknown): Promise<T> {
    const body = JSON.stringify(payload);
    const authHeaders = this.authFn('POST', path, body);
    const response = await fetchExternal(
      this.buildUrl(path),
      {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...this.traceHeaders(),
        },
      },
      this.timeout,
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new ServiceClientError(response.status, path, errorBody);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a JSON GET request. Returns parsed response body.
   * Throws on network errors or non-2xx responses.
   */
  async get<T = unknown>(path: string): Promise<T> {
    const authHeaders = this.authFn('GET', path);
    const response = await fetchExternal(
      this.buildUrl(path),
      {
        method: 'GET',
        headers: {
          ...authHeaders,
          ...this.traceHeaders(),
        },
      },
      this.timeout,
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new ServiceClientError(response.status, path, errorBody);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a raw HTTP request. Returns the unmodified Response object.
   * Useful when you need to handle the response stream or non-JSON bodies.
   */
  async request(
    method: string,
    path: string,
    body?: string | null,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    const authHeaders = this.authFn(method, path, body ?? undefined);
    return fetchExternal(
      this.buildUrl(path),
      {
        method,
        body: body ?? undefined,
        headers: {
          ...authHeaders,
          ...this.traceHeaders(),
          ...extraHeaders,
        },
      },
      this.timeout,
    );
  }

  /**
   * Make a raw request where the over-the-wire body differs from the HMAC body.
   * Used for binary/FormData uploads where HMAC is computed over a JSON descriptor
   * but the actual body is the raw file content.
   */
  async requestRaw(
    method: string,
    path: string,
    rawBody: BodyInit,
    hmacBody: string,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    const authHeaders = this.authFn(method, path, hmacBody);
    return fetchExternal(
      this.buildUrl(path),
      {
        method,
        body: rawBody,
        headers: {
          ...authHeaders,
          ...this.traceHeaders(),
          ...extraHeaders,
        },
      },
      this.timeout,
    );
  }
}

/**
 * Error thrown when a service responds with a non-2xx status code.
 */
export class ServiceClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly responseBody: string,
  ) {
    super(`Service request failed: ${status} ${path}`);
    this.name = 'ServiceClientError';
  }
}
