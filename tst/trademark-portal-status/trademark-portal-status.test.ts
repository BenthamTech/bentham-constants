import {
  TrademarkPortalStatusValue,
  TRADEMARK_PORTAL_STATUSES,
  normalizeTrademarkPortalStatus,
} from '../../src/trademark-portal-status';

describe('TrademarkPortalStatusValue', () => {
  it('has the three v1 normalized values', () => {
    expect(TrademarkPortalStatusValue.UNDER_EXAMINATION).toBe('under_examination');
    expect(TrademarkPortalStatusValue.OBJECTED).toBe('objected');
    expect(TrademarkPortalStatusValue.READY_FOR_EXAMINATION).toBe('ready_for_examination');
  });

  it('TRADEMARK_PORTAL_STATUSES lists every value', () => {
    expect(TRADEMARK_PORTAL_STATUSES).toEqual([
      'under_examination',
      'objected',
      'ready_for_examination',
    ]);
  });
});

describe('normalizeTrademarkPortalStatus', () => {
  it('maps each known raw label to its normalized value', () => {
    expect(normalizeTrademarkPortalStatus('Under Examination')).toBe('under_examination');
    expect(normalizeTrademarkPortalStatus('Objected')).toBe('objected');
    expect(normalizeTrademarkPortalStatus('Ready for Examination')).toBe('ready_for_examination');
  });

  it('is case-insensitive', () => {
    expect(normalizeTrademarkPortalStatus('under examination')).toBe('under_examination');
    expect(normalizeTrademarkPortalStatus('UNDER EXAMINATION')).toBe('under_examination');
    expect(normalizeTrademarkPortalStatus('ObJeCtEd')).toBe('objected');
    expect(normalizeTrademarkPortalStatus('READY FOR EXAMINATION')).toBe('ready_for_examination');
  });

  it('tolerates surrounding whitespace', () => {
    expect(normalizeTrademarkPortalStatus('  Objected  ')).toBe('objected');
    expect(normalizeTrademarkPortalStatus('\tUnder Examination\n')).toBe('under_examination');
  });

  it('tolerates collapsed internal whitespace', () => {
    expect(normalizeTrademarkPortalStatus('Under   Examination')).toBe('under_examination');
    expect(normalizeTrademarkPortalStatus('Ready  for  Examination')).toBe('ready_for_examination');
  });

  it('returns null for unrecognized labels', () => {
    expect(normalizeTrademarkPortalStatus('Registered')).toBeNull();
    expect(normalizeTrademarkPortalStatus('Abandoned')).toBeNull();
    expect(normalizeTrademarkPortalStatus('Refused')).toBeNull();
  });

  it('returns null for empty / whitespace-only input, never throws', () => {
    expect(normalizeTrademarkPortalStatus('')).toBeNull();
    expect(normalizeTrademarkPortalStatus('   ')).toBeNull();
    // @ts-expect-error — guard against a nullish label reaching the normalizer at runtime
    expect(normalizeTrademarkPortalStatus(undefined)).toBeNull();
  });
});
