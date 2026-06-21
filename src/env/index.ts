/**
 * Validates that all required environment variables are present and non-empty.
 * Throws immediately listing all missing vars — call at startup for fail-fast behavior.
 */
export function validateEnv(keys: string[]): void {
  const missing = keys.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ''
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
