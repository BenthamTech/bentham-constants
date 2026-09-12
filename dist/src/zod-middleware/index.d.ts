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
export declare function formatZodPath(path: (string | number)[]): string;
/**
 * Express middleware factory: validates req[source] against a Zod schema.
 * Returns 400 with structured errors on failure; replaces req[source] with
 * parsed (coerced/transformed) data on success.
 */
export declare function validateRequest(schema: ZodSchema, options?: ValidateRequestOptions): (req: any, res: any, next: () => void) => any;
/**
 * Deferred variant — stores errors on req._validationErrors instead of
 * sending a response. Useful for Pub/Sub routes where downstream middleware
 * needs to handle errors before acknowledging.
 */
export declare function validateRequestDeferred(schema: ZodSchema, options?: Pick<ValidateRequestOptions, 'source'>): (req: any, res: any, next: () => void) => void;
