/**
 * Canonical names of shared environment variables that form a cross-repo contract.
 *
 * These are the string KEYS (not the secret values) that multiple Bentham services
 * reference by name — HMAC shared-secret env vars for service-to-service auth. Each key
 * is one source of truth so a rename happens in exactly one place instead of being
 * hand-typed at every `createServiceAuth` / `withWebhookHmac` / client call site.
 *
 * Only vars that are a genuine shared contract live here. Truly local, single-use env
 * reads (e.g. a service's own `LOG_LEVEL`, `NODE_ENV`) stay co-located with their reader.
 *
 * @example
 * ```ts
 * import { HMAC_ENV_KEYS } from '@bentham/constants/env-keys';
 * import { createServiceAuth } from '@bentham/constants/service-auth';
 *
 * const storageAuth = createServiceAuth(HMAC_ENV_KEYS.STORAGE, 'bentham-mca-api');
 * ```
 */
export const HMAC_ENV_KEYS = {
  /** HMAC shared secret for calling bentham-storage-api. */
  STORAGE: 'BENTHAM_STORAGE_API_HMAC',
  /** HMAC shared secret for calling bentham-notification-service. */
  NOTIFICATION: 'BENTHAM_NOTIFICATION_API_HMAC',
  /** HMAC shared secret for calling bentham_trademark_api. */
  TRADEMARK: 'BENTHAM_TRADEMARK_API_HMAC',
  /** HMAC shared secret for calling bentham-document-validator-api. */
  DOCUMENT_VALIDATOR: 'BENTHAM_DOCUMENT_VALIDATOR_API_HMAC',
} as const;

/** A valid HMAC env-var key name. */
export type HmacEnvKey = (typeof HMAC_ENV_KEYS)[keyof typeof HMAC_ENV_KEYS];
