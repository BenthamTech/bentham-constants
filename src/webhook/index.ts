import { generateHmacHeaders } from '../hmac';
import { fetchExternal } from '../fetch';
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

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetchExternal(url, { method: 'POST', headers, body }, this.timeoutMs);
        if (res.ok) {
          logger.info({ path, attempt, service: this.serviceName }, `Webhook delivered to ${path}`);
          return;
        }
        logger.warn(
          { path, attempt, status: res.status, service: this.serviceName },
          `Webhook ${path} returned ${res.status}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          { path, attempt, error: message, service: this.serviceName },
          `Webhook ${path} attempt ${attempt} failed: ${message}`,
        );
      }

      if (attempt < this.maxRetries) {
        await new Promise((r) => setTimeout(r, this.retryDelayMs));
      }
    }

    logger.error(
      { path, maxRetries: this.maxRetries, service: this.serviceName },
      `Webhook ${path} failed after ${this.maxRetries + 1} attempts`,
    );
  }

  /**
   * Fire-and-forget variant — catches all errors internally.
   * Use this when webhook delivery should not block the caller.
   */
  fireAndForget(path: string, payload: unknown): void {
    this.send(path, payload).catch(() => {});
  }
}
