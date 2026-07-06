import { logger } from '../logger/logger';
import { fetchExternal } from '../fetch/index';

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

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 1,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  timeoutMs: 30000,
};

/** Build a full config from partial overrides. */
export function buildRetryConfig(overrides?: Partial<RetryConfig>): RetryConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/** Determine whether an error is worth retrying. */
export function isRetryableError(error: any): boolean {
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') return true;
  if (error.name === 'TypeError' && error.message?.includes('fetch failed')) return true;
  if (error.name === 'AbortError') return true;
  if (typeof error.status === 'number') {
    if (error.status >= 500 && error.status < 600) return true;
    if (error.status === 429) return true;
  }
  return false;
}

function backoffDelay(attempt: number, cfg: RetryConfig): number {
  return Math.min(cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, attempt), cfg.maxDelayMs);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with AbortController-based timeout.
 * Pass timeoutMs = 0 to skip the timeout.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetchExternal(url, options, timeoutMs || undefined);
}

/**
 * Execute an async function with retry + exponential backoff.
 *
 * @param fn        — The operation to retry. Receives the current attempt (0-indexed).
 * @param config    — Partial retry config (merged with defaults).
 * @param shouldRetry — Optional custom predicate; defaults to `isRetryableError`.
 * @param label     — Optional label for log messages.
 * @returns The result of `fn` on the first successful attempt.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config?: Partial<RetryConfig>,
  shouldRetry: (error: any) => boolean = isRetryableError,
  label?: string,
): Promise<T> {
  const cfg = buildRetryConfig(config);
  let lastError: any;
  const tag = label ? `[${label}] ` : '';

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error: any) {
      lastError = error;
      if (attempt === cfg.maxRetries || !shouldRetry(error)) break;
      const ms = backoffDelay(attempt, cfg);
      logger.info(`${tag}Attempt ${attempt + 1} failed, retrying in ${ms}ms…`);
      await delay(ms);
    }
  }

  throw lastError;
}

/**
 * Convenience wrapper: fetch with retry + timeout + auto-throw on non-ok responses.
 */
export async function fetchWithRetry(url: string, options: RequestInit = {}, config?: Partial<RetryConfig>): Promise<Response> {
  const cfg = buildRetryConfig(config);

  return withRetry(async () => {
    const response = await fetchWithTimeout(url, options, cfg.timeoutMs);
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  }, config);
}
