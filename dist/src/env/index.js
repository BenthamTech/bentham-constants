"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
/**
 * Validates that all required environment variables are present and non-empty.
 * Throws immediately listing all missing vars — call at startup for fail-fast behavior.
 */
function validateEnv(keys) {
    const missing = keys.filter((key) => !process.env[key] || process.env[key].trim() === '');
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
