"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedLock = void 0;
const firestore_1 = require("@google-cloud/firestore");
const DEFAULT_TTL_MS = 15 * 60 * 1000;
/**
 * Distributed lock backed by Firestore transactions.
 * Uses atomic check-and-set to prevent race conditions across instances.
 *
 * Credentials auto-detected via ADC (no explicit config needed).
 */
class DistributedLock {
    constructor(collection, options) {
        this.collection = collection;
        this.firestore = new firestore_1.Firestore();
        this.logger = options?.logger;
    }
    /**
     * Attempt to acquire a lock for the given key.
     * Returns true if acquired, false if held by another (or on error — fail-closed).
     */
    async acquire(key, options) {
        const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
        try {
            const docRef = this.firestore.collection(this.collection).doc(key);
            return await this.firestore.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                if (doc.exists) {
                    const data = doc.data();
                    const expiresAt = data?.expiresAt;
                    // Lock exists and has not expired — someone else holds it
                    if (expiresAt && expiresAt.toMillis() > Date.now()) {
                        return false;
                    }
                }
                // Lock is available (doesn't exist or expired) — acquire it
                // Use single clock source (local time) for both timestamps to avoid
                // drift between Firestore server time and local machine time.
                const nowMs = Date.now();
                const lockedAt = firestore_1.Timestamp.fromMillis(nowMs);
                const expiresAt = firestore_1.Timestamp.fromMillis(nowMs + ttlMs);
                transaction.set(docRef, { lockedAt, expiresAt });
                return true;
            });
        }
        catch (err) {
            // Fail-closed: if Firestore errors, treat as unable to acquire
            this.logger?.warn({ key, err }, 'distributed-lock: acquire failed');
            return false;
        }
    }
    /**
     * Release a lock. Best-effort — does not throw on error.
     */
    async release(key) {
        try {
            const docRef = this.firestore.collection(this.collection).doc(key);
            await docRef.delete();
        }
        catch (err) {
            // Best-effort: log but don't throw on release errors
            this.logger?.warn({ key, err }, 'distributed-lock: release failed');
        }
    }
}
exports.DistributedLock = DistributedLock;
