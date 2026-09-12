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
export declare class WebhookCallbackClient {
    private readonly hmacSecret;
    private readonly serviceName;
    private readonly baseUrl;
    private readonly maxRetries;
    private readonly retryDelayMs;
    private readonly timeoutMs;
    constructor(opts: WebhookClientOptions);
    /**
     * Send a webhook callback with HMAC auth and retry.
     * Logs success/failure but never throws — safe for fire-and-forget usage.
     * @param path - API path (e.g. '/api/webhooks/company-filing/status')
     * @param payload - JSON-serializable payload
     */
    send(path: string, payload: unknown): Promise<void>;
    /**
     * Fire-and-forget variant — catches all errors internally.
     * Use this when webhook delivery should not block the caller.
     */
    fireAndForget(path: string, payload: unknown): void;
}
