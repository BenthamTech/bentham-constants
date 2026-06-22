import { randomUUID } from 'node:crypto';
import { asyncLocalStorage, LogContext } from './context';
import { logger } from './logger';

export interface RequestContextOptions {
  service: string;
  extractors?: Record<string, (req: any) => unknown>;
}

export interface RequestLoggerOptions {
  service: string;
  excludePaths?: string[];
  maxBodyLen?: number;
  extractors?: Record<string, (req: any) => unknown>;
}

function truncate(obj: unknown, maxLen: number): string {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

export function requestContext(opts: RequestContextOptions) {
  return (req: any, res: any, next: () => void) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const api = `${req.method} ${req.route?.path || req.path || req.url}`;

    const context: LogContext = { requestId, service: opts.service, api };

    if (opts.extractors) {
      for (const [key, extractor] of Object.entries(opts.extractors)) {
        const value = extractor(req);
        if (value !== undefined && value !== null) context[key] = value;
      }
    }

    // Set response header for tracing
    res.setHeader('x-request-id', requestId);

    asyncLocalStorage.run(context, () => next());
  };
}

/**
 * Combined request context + request/response logging middleware.
 * Sets up AsyncLocalStorage context AND logs method/path/status/duration/bodies.
 */
export function requestLogger(opts: RequestLoggerOptions) {
  const maxLen = opts.maxBodyLen ?? 500;
  const excludePaths = opts.excludePaths ?? [];

  return (req: any, res: any, next: () => void) => {
    const start = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const { method, originalUrl } = req;

    const context: LogContext = { requestId, service: opts.service, api: `${method} ${req.path || req.url}` };

    if (opts.extractors) {
      for (const [key, extractor] of Object.entries(opts.extractors)) {
        const value = extractor(req);
        if (value !== undefined && value !== null) context[key] = value;
      }
    }

    res.setHeader('x-request-id', requestId);

    // Capture response body by wrapping res.json
    const originalJson = res.json.bind(res);
    let responseBody: unknown;
    res.json = (body: unknown) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      const duration = Date.now() - start;
      // req.route is available after route matching (only in finish callback)
      const api = `${method} ${req.route?.path || req.path || req.url}`;
      context.api = api;

      const excluded = excludePaths.some((p: string) => originalUrl.startsWith(p));
      const logEntry: Record<string, unknown> = {
        method,
        path: originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
      };

      if (!excluded) {
        if (req.body && Object.keys(req.body).length > 0) logEntry.request = truncate(req.body, maxLen);
        if (responseBody) logEntry.response = truncate(responseBody, maxLen);
      }

      const level = res.statusCode >= 400 ? 'error' : 'info';
      logger[level](logEntry, `${api} ${res.statusCode} (${duration}ms)`);
    });

    asyncLocalStorage.run(context, () => next());
  };
}

// Next.js API route wrapper
export function withRequestContext(opts: RequestContextOptions) {
  return (handler: (req: any, res: any) => Promise<any>) => {
    return (req: any, res: any) => {
      const requestId = (req.headers['x-request-id'] as string) || randomUUID();
      const api = `${req.method} ${req.url}`;

      const context: LogContext = { requestId, service: opts.service, api };

      if (opts.extractors) {
        for (const [key, extractor] of Object.entries(opts.extractors)) {
          const value = extractor(req);
          if (value !== undefined && value !== null) context[key] = value;
        }
      }

      res.setHeader('x-request-id', requestId);

      return asyncLocalStorage.run(context, () => handler(req, res));
    };
  };
}
