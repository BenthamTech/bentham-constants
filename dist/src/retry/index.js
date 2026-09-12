"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRetryConfig = buildRetryConfig;
exports.isRetryableError = isRetryableError;
exports.fetchWithTimeout = fetchWithTimeout;
exports.withRetry = withRetry;
exports.fetchWithRetry = fetchWithRetry;
const logger_1 = require("../logger/logger");
const index_1 = require("../fetch/index");
const DEFAULT_CONFIG = {
    maxRetries: 1,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    timeoutMs: 30000,
};
/** Build a full config from partial overrides. */
function buildRetryConfig(overrides) {
    return { ...DEFAULT_CONFIG, ...overrides };
}
/** Determine whether an error is worth retrying. */
function isRetryableError(error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')
        return true;
    if (error.name === 'TypeError' && error.message?.includes('fetch failed'))
        return true;
    if (error.name === 'AbortError')
        return true;
    if (typeof error.status === 'number') {
        if (error.status >= 500 && error.status < 600)
            return true;
        if (error.status === 429)
            return true;
    }
    return false;
}
function backoffDelay(attempt, cfg) {
    return Math.min(cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, attempt), cfg.maxDelayMs);
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Fetch with AbortController-based timeout.
 * Pass timeoutMs = 0 to skip the timeout.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
    return (0, index_1.fetchExternal)(url, options, timeoutMs || undefined);
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
async function withRetry(fn, config, shouldRetry = isRetryableError, label) {
    const cfg = buildRetryConfig(config);
    let lastError;
    const tag = label ? `[${label}] ` : '';
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
        try {
            return await fn(attempt);
        }
        catch (error) {
            lastError = error;
            if (attempt === cfg.maxRetries || !shouldRetry(error))
                break;
            const ms = backoffDelay(attempt, cfg);
            logger_1.logger.info(`${tag}Attempt ${attempt + 1} failed, retrying in ${ms}ms…`);
            await delay(ms);
        }
    }
    throw lastError;
}
/**
 * Convenience wrapper: fetch with retry + timeout + auto-throw on non-ok responses.
 */
async function fetchWithRetry(url, options = {}, config) {
    const cfg = buildRetryConfig(config);
    return withRetry(async () => {
        const response = await fetchWithTimeout(url, options, cfg.timeoutMs);
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return response;
    }, config);
}
