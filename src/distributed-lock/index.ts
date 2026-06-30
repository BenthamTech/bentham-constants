import { Firestore, Timestamp } from '@google-cloud/firestore';

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

  constructor(collection: string) {
    this.collection = collection;
    this.firestore = new Firestore();
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
        const now = Timestamp.now();
        const expiresAt = Timestamp.fromMillis(Date.now() + ttlMs);

        transaction.set(docRef, { lockedAt: now, expiresAt });
        return true;
      });
    } catch {
      // Fail-closed: if Firestore errors, treat as unable to acquire
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
    } catch {
      // Best-effort: silently ignore release errors
    }
  }
}
