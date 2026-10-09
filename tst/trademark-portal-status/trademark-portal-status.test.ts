import {
  TrademarkPortalStatusValue,
  TRADEMARK_PORTAL_STATUSES,
  normalizeTrademarkPortalStatus,
  type TrademarkPortalStatusRow,
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

describe('TrademarkPortalStatusRow addressed-tracking contract', () => {
  // Compile-time guard: the served row carries the addressed/addressedAt/addressedBy
  // triple both halves of the "track addressed status changes" feature depend on. A
  // regression that drops a field (or changes its type) fails `tsc` here, before it
  // can silently diverge the app and the digest.
  it('carries addressed (boolean) + addressedAt / addressedBy (string | null)', () => {
    const addressed: TrademarkPortalStatusRow = {
      applicationNumber: 'TM-1',
      temporaryApplicationNumber: null,
      formType: 'TM-A',
      classNumber: 9,
      filingDate: '01/01/2026',
      applicationType: 'Fresh',
      applicationReferenceNumber: null,
      applicationStatus: 'Objected',
      normalizedStatus: 'objected',
      previousStatus: 'Under Examination',
      statusChangedAt: '2026-01-02T00:00:00.000Z',
      applicationDoc: null,
      lastSyncedAt: '2026-01-02T00:00:00.000Z',
      addressed: true,
      addressedAt: '2026-01-02T10:00:00.000Z',
      addressedBy: 'admin-user-id',
    };
    const unaddressed: TrademarkPortalStatusRow = {
      ...addressed,
      addressed: false,
      addressedAt: null,
      addressedBy: null,
    };

    expect(addressed.addressed).toBe(true);
    expect(addressed.addressedAt).toBe('2026-01-02T10:00:00.000Z');
    expect(addressed.addressedBy).toBe('admin-user-id');
    expect(unaddressed.addressed).toBe(false);
    expect(unaddressed.addressedAt).toBeNull();
    expect(unaddressed.addressedBy).toBeNull();
  });
});
