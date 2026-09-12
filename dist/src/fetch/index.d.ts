/**
 * Wrapper around native fetch that logs request/response for external service calls.
 * Returns the unmodified Response object.
 */
export declare function fetchExternal(url: string | URL, options?: RequestInit, timeoutMs?: number): Promise<Response>;
