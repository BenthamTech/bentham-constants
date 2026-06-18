import { createHash, createHmac, timingSafeEqual } from 'crypto';

export interface HmacHeaders {
  'x-service-id': string;
  'x-timestamp': string;
  'x-signature': string;
}

/**
 * Generate HMAC authentication headers for service-to-service requests.
 * Signs: METHOD:PATH:TIMESTAMP:SHA256(body)
 */
export function generateHmacHeaders(
  method: string,
  path: string,
  body: string,
  secret: string,
  serviceId: string,
): HmacHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const message = [method, path, timestamp, bodyHash].join(':');
  const signature = createHmac('sha256', secret).update(message).digest('hex');
  return { 'x-service-id': serviceId, 'x-timestamp': timestamp, 'x-signature': signature };
}

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
export function verifyHmacSignature(req: VerifyHmacRequest, options: VerifyHmacOptions): VerifyHmacResult {
  const { secret, allowedServices, maxAgeSeconds = 300 } = options;

  if (!secret) {
    return { valid: false, error: 'Auth not configured', statusCode: 401 };
  }

  const serviceId = req.headers['x-service-id'];
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  if (!serviceId || !timestamp || !signature) {
    return { valid: false, error: 'Missing auth headers', statusCode: 401 };
  }

  if (!allowedServices.includes(serviceId)) {
    return { valid: false, error: 'Service not allowed', statusCode: 403 };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > maxAgeSeconds) {
    return { valid: false, error: 'Request expired', statusCode: 401 };
  }

  const bodyHash = createHash('sha256').update(req.body).digest('hex');
  const message = [req.method, req.path, timestamp, bodyHash].join(':');
  const expectedSignature = createHmac('sha256', secret).update(message).digest('hex');

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, error: 'Invalid signature', statusCode: 401 };
    }
  } catch {
    return { valid: false, error: 'Invalid signature', statusCode: 401 };
  }

  return { valid: true };
}
