export interface HmacHeaders {
    'x-service-id': string;
    'x-timestamp': string;
    'x-signature': string;
}
/**
 * Generate HMAC authentication headers for service-to-service requests.
 * Signs: METHOD:PATH:TIMESTAMP:SHA256(body)
 */
export declare function generateHmacHeaders(method: string, path: string, body: string, secret: string, serviceId: string): HmacHeaders;
export interface VerifyHmacOptions {
    /** The HMAC shared secret */
    secret: string;
    /** List of allowed service IDs */
    allowedServices: string[];
    /** Max age of request in seconds (default: 300) */
    maxAgeSeconds?: number;
}
export interface VerifyHmacRequest {
    method: string;
    path: string;
    body: string;
    headers: {
        'x-service-id'?: string;
        'x-timestamp'?: string;
        'x-signature'?: string;
    };
}
export interface VerifyHmacResult {
    valid: boolean;
    error?: string;
    statusCode?: number;
}
/**
 * Verify HMAC signature on an incoming request.
 * Returns { valid: true } or { valid: false, error, statusCode }.
 */
export declare function verifyHmacSignature(req: VerifyHmacRequest, options: VerifyHmacOptions): VerifyHmacResult;
export interface HmacAuthMiddlewareOptions {
    secret: string;
    allowedServices: string[];
    /** Skip verification when NODE_ENV=development (default: true) */
    skipInDev?: boolean;
    /** Skip verification when NODE_ENV=test (default: true) */
    skipInTest?: boolean;
    /** Max age of request in seconds (default: 300) */
    maxAgeSeconds?: number;
    /** Path prefixes to skip HMAC verification for (e.g. public routes) */
    skipPaths?: string[];
}
/**
 * Express middleware that verifies HMAC signatures on incoming requests.
 * Wraps verifyHmacSignature with request/response handling.
 */
export declare function hmacAuthMiddleware(opts: HmacAuthMiddlewareOptions): (req: any, res: any, next: () => void) => void;
