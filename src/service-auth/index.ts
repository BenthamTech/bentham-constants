import { generateHmacHeaders, HmacHeaders } from '../hmac';

export type ServiceAuthFn = (method: string, path: string, body?: string | object) => HmacHeaders;

/**
 * Create an HMAC header generator for outbound service-to-service calls.
 *
 * Reads the secret from the given environment variable at call time (not at factory time),
 * so it picks up rotated secrets without restart.
 *
 * @param envVarName - Name of the env var holding the HMAC shared secret
 * @param serviceName - The calling service name (sent as x-service-id)
 * @returns A function that generates HMAC headers for a given request
 *
 * @example
 * ```ts
 * const storageAuth = createServiceAuth('BENTHAM_STORAGE_API_HMAC', 'bentham-mca-api');
 * const headers = storageAuth('POST', '/api/v1/files/signed_url', { url: fileUrl });
 * ```
 */
export function createServiceAuth(envVarName: string, serviceName: string): ServiceAuthFn {
  return (method: string, path: string, body?: string | object): HmacHeaders => {
    const secret = process.env[envVarName] || '';
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {});
    return generateHmacHeaders(method, path, bodyStr, secret, serviceName);
  };
}
