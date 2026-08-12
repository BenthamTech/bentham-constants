import {
  PAN_REGEX,
  MOBILE_REGEX,
  PINCODE_REGEX,
  DIN_REGEX,
  EMAIL_REGEX,
  REF_ID_REGEX,
} from '../../src/validation';

describe('PAN_REGEX', () => {
  it('matches valid PAN', () => {
    expect(PAN_REGEX.test('ABCDE1234F')).toBe(true);
    expect(PAN_REGEX.test('DDXPM2173K')).toBe(true);
  });

  it('rejects lowercase letters', () => {
    expect(PAN_REGEX.test('abcde1234f')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(PAN_REGEX.test('ABCDE1234')).toBe(false);
    expect(PAN_REGEX.test('ABCDE12345F')).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(PAN_REGEX.test('12345ABCDE')).toBe(false);
    expect(PAN_REGEX.test('ABCDE1234')).toBe(false);
    expect(PAN_REGEX.test('ABCDEABCDF')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(PAN_REGEX.test('')).toBe(false);
  });
});

describe('MOBILE_REGEX', () => {
  it('matches valid Indian mobile numbers', () => {
    expect(MOBILE_REGEX.test('9876543210')).toBe(true);
    expect(MOBILE_REGEX.test('6000000000')).toBe(true);
    expect(MOBILE_REGEX.test('7123456789')).toBe(true);
    expect(MOBILE_REGEX.test('8999999999')).toBe(true);
  });

  it('rejects numbers starting with 0-5', () => {
    expect(MOBILE_REGEX.test('0123456789')).toBe(false);
    expect(MOBILE_REGEX.test('1234567890')).toBe(false);
    expect(MOBILE_REGEX.test('5555555555')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(MOBILE_REGEX.test('987654321')).toBe(false);
    expect(MOBILE_REGEX.test('98765432100')).toBe(false);
  });

  it('rejects non-digits', () => {
    expect(MOBILE_REGEX.test('98765abcde')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(MOBILE_REGEX.test('')).toBe(false);
  });
});

describe('PINCODE_REGEX', () => {
  it('matches valid Indian PIN codes', () => {
    expect(PINCODE_REGEX.test('560093')).toBe(true);
    expect(PINCODE_REGEX.test('110001')).toBe(true);
    expect(PINCODE_REGEX.test('999999')).toBe(true);
  });

  it('rejects leading zero', () => {
    expect(PINCODE_REGEX.test('000000')).toBe(false);
    expect(PINCODE_REGEX.test('012345')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(PINCODE_REGEX.test('56009')).toBe(false);
    expect(PINCODE_REGEX.test('5600930')).toBe(false);
  });

  it('rejects non-digits', () => {
    expect(PINCODE_REGEX.test('56009A')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(PINCODE_REGEX.test('')).toBe(false);
  });
});

describe('DIN_REGEX', () => {
  it('matches valid 8-digit DINs', () => {
    expect(DIN_REGEX.test('01234567')).toBe(true);
    expect(DIN_REGEX.test('99999999')).toBe(true);
    expect(DIN_REGEX.test('00000000')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(DIN_REGEX.test('0123456')).toBe(false);
    expect(DIN_REGEX.test('012345678')).toBe(false);
  });

  it('rejects non-digits', () => {
    expect(DIN_REGEX.test('0123456A')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(DIN_REGEX.test('')).toBe(false);
  });
});

describe('EMAIL_REGEX', () => {
  it('matches valid emails', () => {
    expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
    expect(EMAIL_REGEX.test('test.user@domain.co.in')).toBe(true);
    expect(EMAIL_REGEX.test('a@b.c')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(EMAIL_REGEX.test('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(EMAIL_REGEX.test('user@')).toBe(false);
  });

  it('rejects missing local part', () => {
    expect(EMAIL_REGEX.test('@domain.com')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(EMAIL_REGEX.test('user @example.com')).toBe(false);
    expect(EMAIL_REGEX.test('user@ example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(EMAIL_REGEX.test('')).toBe(false);
  });
});

describe('REF_ID_REGEX', () => {
  it('matches valid reference IDs', () => {
    expect(REF_ID_REGEX.test('123-456')).toBe(true);
    expect(REF_ID_REGEX.test('1-2')).toBe(true);
    expect(REF_ID_REGEX.test('999999-000001')).toBe(true);
  });

  it('rejects missing hyphen', () => {
    expect(REF_ID_REGEX.test('123456')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(REF_ID_REGEX.test('abc-def')).toBe(false);
    expect(REF_ID_REGEX.test('123-abc')).toBe(false);
  });

  it('rejects multiple hyphens', () => {
    expect(REF_ID_REGEX.test('1-2-3')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(REF_ID_REGEX.test('')).toBe(false);
  });
});
