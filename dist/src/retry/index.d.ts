/**
 * Shared retry utility with exponential backoff for external API calls.
 *
 * Originally in bentham-app/src/lib/utils/retry.ts — moved here so all
 * services can reuse it via `@bentham/constants/retry`.
 */
export interface RetryConfig {
    /** Maximum number of retry attempts after the initial call (default: 1) */
    maxRetries: number;
    /** Initial delay in ms before first retry (default: 1000) */
    initialDelayMs: number;
    /** Maximum delay in ms between retries (default: 10000) */
    maxDelayMs: number;
    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier: number;
    /** Request timeout in ms — 0 means no timeout (default: 30000) */
    timeoutMs: number;
}
/** Build a full config from partial overrides. */
export declare function buildRetryConfig(overrides?: Partial<RetryConfig>): RetryConfig;
/** Determine whether an error is worth retrying. */
export declare function isRetryableError(error: any): boolean;
/**
 * Fetch with AbortController-based timeout.
 * Pass timeoutMs = 0 to skip the timeout.
 */
export declare function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response>;
/**
 * Execute an async function with retry + exponential backoff.
 *
 * @param fn        — The operation to retry. Receives the current attempt (0-indexed).
 * @param config    — Partial retry config (merged with defaults).
 * @param shouldRetry — Optional custom predicate; defaults to `isRetryableError`.
 * @param label     — Optional label for log messages.
 * @returns The result of `fn` on the first successful attempt.
 */
export declare function withRetry<T>(fn: (attempt: number) => Promise<T>, config?: Partial<RetryConfig>, shouldRetry?: (error: any) => boolean, label?: string): Promise<T>;
/**
 * Convenience wrapper: fetch with retry + timeout + auto-throw on non-ok responses.
 */
export declare function fetchWithRetry(url: string, options?: RequestInit, config?: Partial<RetryConfig>): Promise<Response>;
