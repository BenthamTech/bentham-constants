import { createSignedToken, verifySignedToken } from '../../src/token/index';

describe('createSignedToken / verifySignedToken', () => {
  const secret = 'test-token-secret';

  it('round-trips a valid token', () => {
    const token = createSignedToken({ secret, ttlSeconds: 600 });
    expect(verifySignedToken({ secret, token })).toBe(true);
  });

  it('produces the base64url(payload).signature shape', () => {
    const token = createSignedToken({ secret, ttlSeconds: 600 });
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toHaveLength(64); // hex sha256
  });

  it('rejects a tampered signature', () => {
    const token = createSignedToken({ secret, ttlSeconds: 600 });
    const [encoded] = token.split('.');
    const tampered = `${encoded}.${'0'.repeat(64)}`;
    expect(verifySignedToken({ secret, token: tampered })).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const token = createSignedToken({ secret, claims: { wid: 'w1' }, ttlSeconds: 600 });
    const [, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ wid: 'w2', exp: 9999999999, nonce: 'x' })).toString(
      'base64url',
    );
    expect(verifySignedToken({ secret, token: `${forged}.${signature}` })).toBe(false);
  });

  it('rejects an expired token', () => {
    const token = createSignedToken({ secret, expiresAtMs: Date.now() - 1000 });
    expect(verifySignedToken({ secret, token })).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSignedToken({ secret: 'other-secret', ttlSeconds: 600 });
    expect(verifySignedToken({ secret, token })).toBe(false);
  });

  it('rejects a malformed token', () => {
    expect(verifySignedToken({ secret, token: 'not-a-token' })).toBe(false);
    expect(verifySignedToken({ secret, token: '' })).toBe(false);
  });

  it('accepts when expectedClaims match', () => {
    const token = createSignedToken({ secret, claims: { wid: 'wf-123' }, ttlSeconds: 600 });
    expect(verifySignedToken({ secret, token, expectedClaims: { wid: 'wf-123' } })).toBe(true);
  });

  it('rejects when expectedClaims do not match', () => {
    const token = createSignedToken({ secret, claims: { wid: 'wf-123' }, ttlSeconds: 600 });
    expect(verifySignedToken({ secret, token, expectedClaims: { wid: 'wf-999' } })).toBe(false);
  });

  it('uses expiresAtMs in preference to ttlSeconds', () => {
    const token = createSignedToken({ secret, ttlSeconds: 600, expiresAtMs: Date.now() - 1000 });
    expect(verifySignedToken({ secret, token })).toBe(false);
  });

  it('bypasses verification under NODE_ENV=development when skipInDev is true', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(verifySignedToken({ secret, token: 'anything', skipInDev: true })).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('does not bypass under NODE_ENV=development when skipInDev is false', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(verifySignedToken({ secret, token: 'anything', skipInDev: false })).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('does not bypass under NODE_ENV=test', () => {
    // The suite runs under NODE_ENV=test; a garbage token must still fail.
    expect(verifySignedToken({ secret, token: 'garbage.token' })).toBe(false);
  });
});
