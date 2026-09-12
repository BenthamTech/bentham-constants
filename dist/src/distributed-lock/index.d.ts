export interface LockLogger {
    warn(obj: Record<string, unknown>, msg: string): void;
}
export interface DistributedLockOptions {
    /** Optional logger for visibility into lock failures */
    logger?: LockLogger;
}
export interface AcquireOptions {
    /** Lock TTL in milliseconds. Default: 15 minutes */
    ttlMs?: number;
}
/**
 * Distributed lock backed by Firestore transactions.
 * Uses atomic check-and-set to prevent race conditions across instances.
 *
 * Credentials auto-detected via ADC (no explicit config needed).
 */
export declare class DistributedLock {
    private readonly firestore;
    private readonly collection;
    private readonly logger?;
    constructor(collection: string, options?: DistributedLockOptions);
    /**
     * Attempt to acquire a lock for the given key.
     * Returns true if acquired, false if held by another (or on error — fail-closed).
     */
    acquire(key: string, options?: AcquireOptions): Promise<boolean>;
    /**
     * Release a lock. Best-effort — does not throw on error.
     */
    release(key: string): Promise<void>;
}
