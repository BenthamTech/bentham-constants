export interface ErrorHandlerOptions {
    exposeStack?: boolean;
}
interface AppError extends Error {
    statusCode?: number;
    code?: string;
    details?: unknown;
}
export declare function errorHandler(opts?: ErrorHandlerOptions): (err: AppError, _req: any, res: any, _next: any) => void;
export declare function notFound(): (req: any, res: any) => void;
/**
 * Express middleware: when X-Validate-Only header is truthy, short-circuits
 * after validation passes with { success: true, valid: true }.
 * Place AFTER validation middleware, BEFORE the controller.
 */
export declare function validateOnlyGuard(req: any, res: any, next: () => void): void;
export {};
