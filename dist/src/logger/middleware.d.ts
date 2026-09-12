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
export declare function requestContext(opts: RequestContextOptions): (req: any, res: any, next: () => void) => void;
/**
 * Combined request context + request/response logging middleware.
 * Sets up AsyncLocalStorage context AND logs method/path/status/duration/bodies.
 */
export declare function requestLogger(opts: RequestLoggerOptions): (req: any, res: any, next: () => void) => void;
export declare function withRequestContext(opts: RequestContextOptions): (handler: (req: any, res: any) => Promise<any>) => (req: any, res: any) => Promise<any>;
