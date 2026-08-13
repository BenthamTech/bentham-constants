import { ZodSchema } from 'zod';

export interface ZodValidationError {
  field: string;
  message: string;
}

export interface ValidateRequestOptions {
  /** Which part of the request to validate. Defaults to 'body'. */
  source?: 'body' | 'query' | 'params';
  /** If true, return all errors; if false (default), return only the first. */
  allErrors?: boolean;
}

/**
 * Formats a Zod error path with bracket notation for arrays.
 * ['forms', 0, 'name'] → 'forms[0].name'
 */
export function formatZodPath(path: (string | number)[]): string {
  let result = '';
  for (const seg of path) {
    result += typeof seg === 'number' ? `[${seg}]` : (result ? `.${seg}` : seg);
  }
  return result;
}

/**
 * Express middleware factory: validates req[source] against a Zod schema.
 * Returns 400 with structured errors on failure; replaces req[source] with
 * parsed (coerced/transformed) data on success.
 */
export function validateRequest(schema: ZodSchema, options?: ValidateRequestOptions) {
  const { source = 'body', allErrors = false } = options || {};
  return (req: any, res: any, next: () => void) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors: ZodValidationError[] = allErrors
        ? result.error.errors.map(e => ({ field: formatZodPath(e.path), message: e.message }))
        : [{ field: formatZodPath(result.error.errors[0].path), message: result.error.errors[0].message }];
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    req[source] = result.data;
    next();
  };
}

/**
 * Deferred variant — stores errors on req._validationErrors instead of
 * sending a response. Useful for Pub/Sub routes where downstream middleware
 * needs to handle errors before acknowledging.
 */
export function validateRequestDeferred(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: any, res: any, next: () => void) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      req._validationErrors = result.error.errors.map(e => ({
        field: formatZodPath(e.path),
        message: e.message,
      }));
    } else {
      req[source] = result.data;
    }
    next();
  };
}
