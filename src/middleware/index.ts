import { logger } from '../logger/logger';

export interface ErrorHandlerOptions {
  exposeStack?: boolean;
}

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(opts?: ErrorHandlerOptions) {
  const exposeStack = opts?.exposeStack ?? process.env.NODE_ENV === 'development';

  return (err: AppError, _req: any, res: any, _next: any) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';

    logger.error({ statusCode, code, err: err.message }, 'Unhandled error');

    const body: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message: err.message || 'Internal server error',
        ...(err.details !== undefined && { details: err.details }),
        ...(exposeStack && err.stack && { stack: err.stack }),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(body);
  };
}

export function notFound() {
  return (req: any, res: any) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl || req.url}` },
      timestamp: new Date().toISOString(),
    });
  };
}
