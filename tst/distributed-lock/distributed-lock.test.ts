import { DistributedLock } from '../../src/distributed-lock/index';

// Mock @google-cloud/firestore
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('@google-cloud/firestore', () => {
  const { Timestamp } = jest.requireActual('@google-cloud/firestore');
  return {
    Firestore: jest.fn().mockImplementation(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          delete: mockDelete,
        }),
      }),
      runTransaction: mockRunTransaction,
    })),
    Timestamp,
  };
});

describe('DistributedLock', () => {
  let lock: DistributedLock;

  beforeEach(() => {
    jest.clearAllMocks();
    lock = new DistributedLock('otp_sessions');
  });

  describe('acquire', () => {
    it('returns true when lock does not exist (empty collection)', async () => {
      mockRunTransaction.mockImplementation(async (fn: Function) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: false }),
          set: mockSet,
        };
        return fn(transaction);
      });

      const result = await lock.acquire('REF123');
      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalled();
    });

    it('returns false when unexpired lock exists', async () => {
      const { Timestamp } = jest.requireActual('@google-cloud/firestore');
      const futureTime = Timestamp.fromMillis(Date.now() + 60000);

      mockRunTransaction.mockImplementation(async (fn: Function) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ lockedAt: Timestamp.now(), expiresAt: futureTime }),
          }),
          set: mockSet,
        };
        return fn(transaction);
      });

      const result = await lock.acquire('REF123');
      expect(result).toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('returns true when expired lock exists (overwrite)', async () => {
      const { Timestamp } = jest.requireActual('@google-cloud/firestore');
      const pastTime = Timestamp.fromMillis(Date.now() - 60000);

      mockRunTransaction.mockImplementation(async (fn: Function) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ lockedAt: Timestamp.now(), expiresAt: pastTime }),
          }),
          set: mockSet,
        };
        return fn(transaction);
      });

      const result = await lock.acquire('REF123');
      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalled();
    });

    it('uses custom ttlMs when provided', async () => {
      const { Timestamp } = jest.requireActual('@google-cloud/firestore');

      mockRunTransaction.mockImplementation(async (fn: Function) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: false }),
          set: mockSet,
        };
        return fn(transaction);
      });

      const before = Date.now();
      await lock.acquire('REF123', { ttlMs: 5000 });

      const setCall = mockSet.mock.calls[0];
      const expiresAt = setCall[1].expiresAt as { toMillis: () => number };
      // TTL should be approximately 5 seconds from now
      expect(expiresAt.toMillis()).toBeGreaterThanOrEqual(before + 5000);
      expect(expiresAt.toMillis()).toBeLessThanOrEqual(before + 6000);
    });

    it('returns false on Firestore error (fail-closed)', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await lock.acquire('REF123');
      expect(result).toBe(false);
    });
  });

  describe('release', () => {
    it('calls delete on the document', async () => {
      mockDelete.mockResolvedValue(undefined);

      await lock.release('REF123');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('does not throw on delete error', async () => {
      mockDelete.mockRejectedValue(new Error('Firestore error'));

      await expect(lock.release('REF123')).resolves.toBeUndefined();
    });
  });
});
