import { HMAC_ENV_KEYS } from '../../src/env-keys';

describe('HMAC_ENV_KEYS', () => {
  it('exports the canonical HMAC env-var key names', () => {
    expect(HMAC_ENV_KEYS.STORAGE).toBe('BENTHAM_STORAGE_API_HMAC');
    expect(HMAC_ENV_KEYS.NOTIFICATION).toBe('BENTHAM_NOTIFICATION_API_HMAC');
    expect(HMAC_ENV_KEYS.TRADEMARK).toBe('BENTHAM_TRADEMARK_API_HMAC');
    expect(HMAC_ENV_KEYS.DOCUMENT_VALIDATOR).toBe('BENTHAM_DOCUMENT_VALIDATOR_API_HMAC');
  });

  it('all keys follow the BENTHAM_*_API_HMAC naming contract', () => {
    for (const key of Object.values(HMAC_ENV_KEYS)) {
      expect(key).toMatch(/^BENTHAM_[A-Z_]+_HMAC$/);
    }
  });

  it('has no duplicate values', () => {
    const values = Object.values(HMAC_ENV_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
