import { generateHmacHeaders } from '../hmac';
import { fetchExternal } from '../fetch';
import { withRetry } from '../retry';
import { logger } from '../logger/logger';
import { getContext } from '../logger/context';

export interface WebhookClientOptions {
  /** HMAC secret for signing requests */
  hmacSecret: string;
  /** Service name for HMAC headers */
  serviceName: string;
  /** Base URL of the target (e.g. serviceUrls.app) */
  baseUrl: string;
  /** Max retries (default: 1) */
  maxRetries?: number;
  /** Retry delay in ms (default: 5000) */
  retryDelayMs?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
}

/**
 * HMAC-authenticated webhook client with retry.
 * Extracted from bentham-mca-api and bentham_trademark_api WebhookHelper modules.
 */
export class WebhookCallbackClient {
  private readonly hmacSecret: string;
  private readonly serviceName: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;

  constructor(opts: WebhookClientOptions) {
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
  async send(path: string, payload: unknown): Promise<void> {
    const url = `${this.baseUrl}${path}`;

    let body: string;
    let headers: Record<string, string>;
    try {
      body = JSON.stringify(payload);
      const hmacHeaders = generateHmacHeaders('POST', path, body, this.hmacSecret, this.serviceName);
      const { requestId } = getContext();

      headers = {
        'Content-Type': 'application/json',
        ...hmacHeaders,
      };
      if (requestId) {
        headers['x-request-id'] = requestId;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        { path, error: message, service: this.serviceName },
        `Webhook ${path} setup failed: ${message}`,
      );
      return;
    }

    // Delivery is fire-and-forget safe: retry on ANY failure (thrown error or
    // non-ok status) and never throw. `withRetry` owns the attempt counting and
    // the constant delay (backoffMultiplier: 1 keeps it flat, matching the old
    // loop); the per-attempt warn and success info logs live inside `fn` so the
    // observable logging is unchanged. `timeoutMs: 0` avoids double-timing —
    // `fetchExternal` already applies `this.timeoutMs`.
    try {
      await withRetry(
        async (attempt) => {
          let res: Awaited<ReturnType<typeof fetchExternal>>;
          try {
            res = await fetchExternal(url, { method: 'POST', headers, body }, this.timeoutMs);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn(
              { path, attempt, error: message, service: this.serviceName },
              `Webhook ${path} attempt ${attempt} failed: ${message}`,
            );
            throw err;
          }
          if (res.ok) {
            logger.info({ path, attempt, service: this.serviceName }, `Webhook delivered to ${path}`);
            return res;
          }
          logger.warn(
            { path, attempt, status: res.status, service: this.serviceName },
            `Webhook ${path} returned ${res.status}`,
          );
          const httpError: Error & { status?: number } = new Error(`HTTP ${res.status}`);
          httpError.status = res.status;
          throw httpError;
        },
        {
          maxRetries: this.maxRetries,
          initialDelayMs: this.retryDelayMs,
          backoffMultiplier: 1,
          timeoutMs: 0,
        },
        () => true,
        `webhook ${path}`,
      );
    } catch {
      // Reached only after the final attempt is exhausted. Every attempt's
      // failure (thrown error or non-ok status) was already warn-logged inside
      // `fn` — so we do NOT re-warn here (that would double-count and the tests
      // assert an exact warn count). We only record the permanent failure, and
      // swallow rather than rethrow (send() is fire-and-forget safe).
      logger.error(
        { path, maxRetries: this.maxRetries, service: this.serviceName },
        `Webhook ${path} failed after ${this.maxRetries + 1} attempts`,
      );
    }
  }

  /**
   * Fire-and-forget variant — catches all errors internally.
   * Use this when webhook delivery should not block the caller.
   */
  fireAndForget(path: string, payload: unknown): void {
    this.send(path, payload).catch(() => {});
  }
}
