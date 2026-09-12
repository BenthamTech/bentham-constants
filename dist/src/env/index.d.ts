/**
 * Validates that all required environment variables are present and non-empty.
 * Throws immediately listing all missing vars — call at startup for fail-fast behavior.
 */
export declare function validateEnv(keys: string[]): void;
