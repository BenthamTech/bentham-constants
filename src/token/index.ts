import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Arbitrary claims embedded in a signed token (e.g. `{ wid }` to bind a token
 * to a specific workflow). Values must be JSON-serialisable primitives.
 */
export type TokenClaims = Record<string, string | number>;

export interface CreateTokenOptions {
  /** The shared HMAC secret used to sign the token. */
  secret: string;
  /** Optional claims to embed in the token payload. */
  claims?: TokenClaims;
  /** Lifetime in seconds; used to derive `exp` when `expiresAtMs` is not given. */
  ttlSeconds?: number;
  /** Absolute expiry in epoch milliseconds; takes precedence over `ttlSeconds`. */
  expiresAtMs?: number;
}

export interface VerifyTokenOptions {
  /** The shared HMAC secret the token was signed with. */
  secret: string;
  /** The token string to verify. */
  token: string;
  /** Claims that must match exactly for the token to be considered valid. */
  expectedClaims?: TokenClaims;
  /** Bypass verification when NODE_ENV=development (default: true). */
  skipInDev?: boolean;
}

interface TokenPayload extends TokenClaims {
  /** Expiry as an epoch-seconds timestamp. */
  exp: number;
  /** Random per-token nonce to prevent identical payloads producing identical tokens. */
  nonce: string;
}

/**
 * Create an HMAC-signed capability token.
 *
 * Token format: `base64url(JSON({ ...claims, exp, nonce })).hmacSHA256Signature`
 * where the signature is HMAC-SHA256 of the base64url-encoded payload string.
 *
 * `exp` is derived from `expiresAtMs` (absolute) when provided, otherwise from
 * `ttlSeconds` relative to now.
 *
 * Never log the returned token or the secret used to sign it.
 */
export function createSignedToken(options: CreateTokenOptions): string {
  const { secret, claims = {}, ttlSeconds = 0, expiresAtMs } = options;
  const exp =
    typeof expiresAtMs === 'number'
      ? Math.floor(expiresAtMs / 1000)
      : Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: TokenPayload = {
    ...claims,
    exp,
    nonce: randomBytes(16).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

/**
 * Check the signature (constant-time) and expiry, and return the payload.
 * Returns null for a malformed, tampered or expired token.
 */
function decodeVerifiedPayload(secret: string, token: string): TokenPayload | null {
  if (!secret || !token) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest('hex');
  try {
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const { exp } = payload as TokenPayload;
  if (typeof exp !== 'number' || Math.floor(Date.now() / 1000) >= exp) return null;

  return payload as TokenPayload;
}

/**
 * Verify an HMAC-signed capability token.
 *
 * Returns `true` only when the signature is valid (constant-time compare), the
 * token has not expired, and every entry in `expectedClaims` matches the token's
 * payload. Returns `false` for any malformed, tampered, expired, or mismatched
 * token rather than throwing.
 *
 * When `skipInDev` is true (default) and NODE_ENV=development, verification is
 * bypassed and `true` is returned. Verification is NOT bypassed under
 * NODE_ENV=test so tests exercise the real crypto path.
 *
 * Never log the token or the secret.
 */
export function verifySignedToken(options: VerifyTokenOptions): boolean {
  const { secret, token, expectedClaims = {}, skipInDev = true } = options;

  if (skipInDev && process.env.NODE_ENV === 'development') return true;

  const payload = decodeVerifiedPayload(secret, token);
  if (!payload) return false;

  for (const [key, value] of Object.entries(expectedClaims)) {
    if (payload[key] !== value) return false;
  }

  return true;
}

export interface ReadTokenOptions {
  /** The shared HMAC secret the token was signed with. */
  secret: string;
  /** The token string to read. */
  token: string;
}

/**
 * Verify a token and return its claims plus `exp` (epoch seconds), or `null`
 * when it's malformed, tampered with or expired.
 *
 * Unlike {@link verifySignedToken} there is no development bypass: claims are
 * only worth reading once the signature is checked.
 *
 * Never log the token or the secret.
 */
export function readSignedToken(options: ReadTokenOptions): (TokenClaims & { exp: number }) | null {
  const payload = decodeVerifiedPayload(options.secret, options.token);
  if (!payload) return null;
  const { nonce: _nonce, ...claims } = payload;
  return claims;
}
