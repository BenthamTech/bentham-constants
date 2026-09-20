import { FilingMode, FILING_MODES_CONFIG, isSanityMode } from '../../src/incorporation';

describe('FilingMode', () => {
  it('exposes the office-address-update sanity variant', () => {
    expect(FilingMode.SANITY_FILING_OFFICE_ADDRESS_UPDATE).toBe('SANITY_FILING_OFFICE_ADDRESS_UPDATE');
  });

  it('has a UI config entry for every mode', () => {
    for (const mode of Object.values(FilingMode)) {
      expect(FILING_MODES_CONFIG[mode]).toBeDefined();
      expect(FILING_MODES_CONFIG[mode].label).toBeTruthy();
      expect(FILING_MODES_CONFIG[mode].description).toBeTruthy();
    }
  });
});

describe('isSanityMode', () => {
  it('is true for both sanity variants', () => {
    expect(isSanityMode(FilingMode.SANITY_FILING)).toBe(true);
    expect(isSanityMode(FilingMode.SANITY_FILING_OFFICE_ADDRESS_UPDATE)).toBe(true);
  });

  it('is false for non-sanity modes', () => {
    expect(isSanityMode(FilingMode.FORCE_REFILL)).toBe(false);
    expect(isSanityMode(FilingMode.FORCE_FILE_AGILE_PRO)).toBe(false);
  });

  it('is false for null, undefined, and unknown strings', () => {
    expect(isSanityMode(null)).toBe(false);
    expect(isSanityMode(undefined)).toBe(false);
    expect(isSanityMode('SANITY_FILING_SOMETHING_ELSE')).toBe(false);
    expect(isSanityMode('')).toBe(false);
  });

  it('does NOT match on prefix (guards against startsWith regression)', () => {
    // A future/typo mode that merely starts with the sanity prefix must not be swept in.
    expect(isSanityMode('SANITY_FILING_DIRECTORS_UPDATE')).toBe(false);
  });
});
