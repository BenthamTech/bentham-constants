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
