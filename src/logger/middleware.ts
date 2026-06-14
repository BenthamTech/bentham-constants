import { randomUUID } from 'node:crypto';
import { asyncLocalStorage, LogContext } from './context';

export interface RequestContextOptions {
  service: string;
  extractors?: Record<string, (req: any) => unknown>;
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
