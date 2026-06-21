import { logger } from '../logger/logger';

/**
 * Wrapper around native fetch that logs request/response for external service calls.
 * Returns the unmodified Response object.
 */
export async function fetchExternal(
  url: string | URL,
  options?: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  const method = (options?.method || 'GET').toUpperCase();
  const parsedUrl = new URL(url.toString());
  const pathname = parsedUrl.pathname;
  const start = Date.now();

  logger.info({ method, url: url.toString(), timeout: timeoutMs }, `→ ${method} ${pathname}`);

  const fetchOptions: RequestInit = { ...options };
  if (timeoutMs) {
    fetchOptions.signal = AbortSignal.timeout(timeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err: unknown) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ method, url: url.toString(), duration, error: message }, `← ERROR ${message}`);
    throw err;
  }

  const duration = Date.now() - start;

  if (response.ok) {
    logger.info({ method, url: url.toString(), status: response.status, duration }, `← ${response.status} (${duration}ms)`);
  } else {
    let body = '';
    try {
      body = await response.clone().text();
      if (body.length > 500) body = body.slice(0, 500);
    } catch { /* ignore body read failures */ }
    logger.error({ method, url: url.toString(), status: response.status, duration, body }, `← ${response.status} (${duration}ms) ${body}`);
  }

  return response;
}
