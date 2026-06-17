import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  requestId: string;
  service: string;
  api?: string;
  userId?: string;
  [key: string]: unknown;
}

export const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

export function getContext(): Partial<LogContext> {
  return asyncLocalStorage.getStore() ?? {};
}

export function addContext(fields: Record<string, unknown>): void {
  const store = asyncLocalStorage.getStore();
  if (store) Object.assign(store, fields);
}

/**
 * Runs `fn` within a logging context scope. All `logger.*` calls and
 * `getContext()`/`addContext()` invoked during `fn` (and its async
 * continuations) see this context. Framework-agnostic — callers building their
 * own request wrapper (e.g. Next.js App Router) should use this instead of
 * reaching for the internal AsyncLocalStorage instance.
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}
