import { Firestore, Timestamp } from '@google-cloud/firestore';

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

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Distributed lock backed by Firestore transactions.
 * Uses atomic check-and-set to prevent race conditions across instances.
 *
 * Credentials auto-detected via ADC (no explicit config needed).
 */
export class DistributedLock {
  private readonly firestore: Firestore;
  private readonly collection: string;
  private readonly logger?: LockLogger;

  constructor(collection: string, options?: DistributedLockOptions) {
    this.collection = collection;
    this.firestore = new Firestore();
    this.logger = options?.logger;
  }

  /**
   * Attempt to acquire a lock for the given key.
   * Returns true if acquired, false if held by another (or on error — fail-closed).
   */
  async acquire(key: string, options?: AcquireOptions): Promise<boolean> {
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

    try {
      const docRef = this.firestore.collection(this.collection).doc(key);

      return await this.firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (doc.exists) {
          const data = doc.data();
          const expiresAt = data?.expiresAt as Timestamp | undefined;

          // Lock exists and has not expired — someone else holds it
          if (expiresAt && expiresAt.toMillis() > Date.now()) {
            return false;
          }
        }

        // Lock is available (doesn't exist or expired) — acquire it
        // Use single clock source (local time) for both timestamps to avoid
        // drift between Firestore server time and local machine time.
        const nowMs = Date.now();
        const lockedAt = Timestamp.fromMillis(nowMs);
        const expiresAt = Timestamp.fromMillis(nowMs + ttlMs);

        transaction.set(docRef, { lockedAt, expiresAt });
        return true;
      });
    } catch (err) {
      // Fail-closed: if Firestore errors, treat as unable to acquire
      this.logger?.warn({ key, err }, 'distributed-lock: acquire failed');
      return false;
    }
  }

  /**
   * Release a lock. Best-effort — does not throw on error.
   */
  async release(key: string): Promise<void> {
    try {
      const docRef = this.firestore.collection(this.collection).doc(key);
      await docRef.delete();
    } catch (err) {
      // Best-effort: log but don't throw on release errors
      this.logger?.warn({ key, err }, 'distributed-lock: release failed');
    }
  }
}
