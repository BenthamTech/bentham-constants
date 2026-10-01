import { BaseServiceClient, ServiceClientError } from '../http';
import { serviceUrls } from '../config';
import { type RetryConfig, buildRetryConfig, withRetry, isRetryableError } from '../retry';

/** Path the notification service exposes for sending a notification. */
const SEND_PATH = '/v1/notifications/send';

/** Default env var holding the notification-service HMAC shared secret. */
const DEFAULT_SECRET_ENV_VAR = 'BENTHAM_NOTIFICATION_API_HMAC';

/**
 * The wire payload for `POST /v1/notifications/send`. Identical shape across all
 * callers — the superset of the three hand-rolled clients this replaces.
 */
export interface NotificationPayload {
  /** Delivery channel. */
  type: 'email' | 'whatsapp';
  /** Recipient addresses (emails or phone numbers, per `type`). */
  to: string[];
  /** Template identifier registered with the notification service. */
  template_name: string;
  /** Email subject line (email only). */
  subject?: string;
  /** Template variable substitutions. */
  variables?: Record<string, string>;
  /** Additional email recipients (email only). */
  cc?: string[];
  /** Template language (whatsapp only). */
  language?: string;
  /** Idempotency key — the service dedups sends sharing this key. */
  dedup_key?: string;
  /** How long (seconds) the dedup key is honoured. */
  dedup_ttl_seconds?: number;
}

/** Response from a successful send. The service returns an id under either key. */
export interface NotificationSendResult {
  messageId?: string;
  id?: string;
}

export interface NotificationClientOptions {
  /** Calling service name (sent as x-service-id in HMAC headers). */
  serviceName: string;
  /** Override the notification API base URL (defaults to serviceUrls.notification). */
  baseUrl?: string;
  /** Override the HMAC secret env var name (defaults to 'BENTHAM_NOTIFICATION_API_HMAC'). */
  secretEnvVar?: string;
  /** Request timeout in milliseconds (default: 10000). */
  timeout?: number;
  /** Retry-with-backoff overrides (default: `buildRetryConfig()` defaults). */
  retry?: Partial<RetryConfig>;
}

/**
 * Pre-built HMAC-authenticated client for bentham-notification-service.
 *
 * Mirrors the {@link StorageClient} precedent: the caller supplies only its
 * `serviceName`; the endpoint path, HMAC env-var default, retry policy, and
 * payload contract all live here. Sends retry on retryable errors (5xx, 429,
 * transient network) with exponential backoff.
 *
 * @example
 * ```ts
 * import { NotificationClient } from '@bentham/constants/notification';
 *
 * const notifier = new NotificationClient({ serviceName: 'bentham-mca-api' });
 * await notifier.send({
 *   type: 'email',
 *   to: ['user@example.com'],
 *   template_name: 'filing_result',
 *   subject: 'Your filing is complete',
 *   variables: { name: 'Ada' },
 * });
 * ```
 */
export class NotificationClient extends BaseServiceClient {
  private readonly retryConfig: RetryConfig;

  constructor(opts: NotificationClientOptions) {
    super({
      baseUrl: opts.baseUrl ?? serviceUrls.notification,
      auth: {
        secretEnvVar: opts.secretEnvVar ?? DEFAULT_SECRET_ENV_VAR,
        serviceName: opts.serviceName,
      },
      timeout: opts.timeout ?? 10_000,
    });
    this.retryConfig = buildRetryConfig(opts.retry);
  }

  /**
   * Send a notification. Retries retryable failures with exponential backoff.
   * @throws ServiceClientError on a non-2xx response after retries are exhausted.
   */
  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    return withRetry(
      () => this.post<NotificationSendResult>(SEND_PATH, payload),
      this.retryConfig,
      (err) => err instanceof ServiceClientError ? isRetryableError({ status: err.status }) : isRetryableError(err),
      'Notification',
    );
  }
}

/**
 * Factory function to create a NotificationClient instance.
 * @param serviceName - The calling service name for HMAC auth.
 */
export function createNotificationClient(serviceName: string): NotificationClient {
  return new NotificationClient({ serviceName });
}
