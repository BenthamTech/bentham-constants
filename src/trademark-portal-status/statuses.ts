/**
 * Trademark portal status vocabulary — the shared, API-facing set of normalized
 * statuses derived from the upstream source's raw status labels. Used by the job that
 * produces the data and the read API / admin dashboard that consume it, so both code
 * against one vocabulary and the shape can't drift.
 */

/** Normalized, API-facing status values. */
export const TrademarkPortalStatusValue = {
  UNDER_EXAMINATION: 'under_examination',
  OBJECTED: 'objected',
  READY_FOR_EXAMINATION: 'ready_for_examination',
} as const;

export type TrademarkPortalStatusType =
  (typeof TrademarkPortalStatusValue)[keyof typeof TrademarkPortalStatusValue];

/** All normalized status values. */
export const TRADEMARK_PORTAL_STATUSES = Object.values(
  TrademarkPortalStatusValue,
) as TrademarkPortalStatusType[];

/**
 * Raw source label → normalized status. Keyed on the lowercased, whitespace-collapsed
 * label so lookups are case-insensitive and tolerant of surrounding/internal whitespace.
 * Extend this map as new raw labels appear.
 */
const RAW_LABEL_TO_STATUS: Record<string, TrademarkPortalStatusType> = {
  'under examination': TrademarkPortalStatusValue.UNDER_EXAMINATION,
  objected: TrademarkPortalStatusValue.OBJECTED,
  'ready for examination': TrademarkPortalStatusValue.READY_FOR_EXAMINATION,
};

/**
 * Normalize a raw status label to a {@link TrademarkPortalStatusType}.
 * Case-insensitive and whitespace-tolerant (leading/trailing and collapsed internal
 * whitespace). Returns `null` for any unrecognized label — never throws.
 */
export function normalizeTrademarkPortalStatus(
  raw: string,
): TrademarkPortalStatusType | null {
  if (!raw) return null;
  const key = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  return RAW_LABEL_TO_STATUS[key] ?? null;
}
