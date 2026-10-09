/**
 * Shared output/input schemas (contract) for the Trademark Portal Status Sync.
 *
 * Pure type definitions shared between the job that produces the status snapshot and the
 * app that persists/serves it, so both code against one interface and the contract can't
 * drift — a shape change on either side becomes a compile error on the other.
 */
import type { TrademarkPortalStatusType } from './statuses';

/**
 * One status row as pushed by the job that produces the data. Raw shape as provided by
 * the source; `applicationStatus` is the raw label (normalized on the read side).
 */
export interface TrademarkPortalStatusIngestRow {
  /** Permanent application number (the stable key). */
  applicationNumber: string;
  /** Temporary application number used before the permanent one is issued. */
  temporaryApplicationNumber: string | null;
  /** Form type. */
  formType: string;
  /**
   * Trademark class, or null for non-class-bearing forms (e.g. TM-M, MIS-R):
   * request/reply forms filed against an existing application carry no class of
   * their own.
   */
  classNumber: number | null;
  /** Filing date as a display string ("DD/MM/YYYY"). */
  filingDate: string;
  /** Application type. */
  applicationType: string;
  /** Application reference number, when present. */
  applicationReferenceNumber: string | null;
  /** Raw status label, e.g. "Under Examination". */
  applicationStatus: string;
  /** Reserved for the application document URL; always null in v1. */
  applicationDoc: string | null;
}

/** The ingest push payload from the job that produces the data. */
export interface TrademarkPortalStatusIngestRequest {
  /** When the sync ran (ISO 8601). */
  syncedAt: string;
  rows: TrademarkPortalStatusIngestRow[];
}

/**
 * One persisted+served status row served to the read side. Extends the ingested
 * shape with the normalized status and change-tracking fields the app maintains.
 */
export interface TrademarkPortalStatusRow {
  applicationNumber: string;
  temporaryApplicationNumber: string | null;
  formType: string;
  /** Trademark class, or null for non-class-bearing forms (e.g. TM-M, MIS-R). */
  classNumber: number | null;
  filingDate: string;
  applicationType: string;
  applicationReferenceNumber: string | null;
  /** Raw status label. */
  applicationStatus: string;
  /** Normalized status, or null if the raw label is unrecognized. */
  normalizedStatus: TrademarkPortalStatusType | null;
  /** Previous raw status label before the most recent change, if any. */
  previousStatus: string | null;
  /** When the status last changed (ISO 8601), if ever. */
  statusChangedAt: string | null;
  /** Application document URL; null in v1. */
  applicationDoc: string | null;
  /** When this row was last synced (ISO 8601). */
  lastSyncedAt: string;
  /**
   * Whether the legal team has handled the row's CURRENT status. A row is
   * unaddressed when first discovered and auto-resets to unaddressed on every
   * subsequent status change (Option A), so "addressed" always refers to the
   * status currently shown — never a stale earlier one. Maintained by the app
   * (the ingest resets it on a real transition; an admin sets it via the
   * mark-as-addressed endpoint); the sync job never produces it, so it is absent
   * from the ingest row.
   */
  addressed: boolean;
  /** When the row was last marked addressed (ISO 8601), or null while unaddressed. */
  addressedAt: string | null;
  /** The id of the admin who last marked it addressed, or null while unaddressed. */
  addressedBy: string | null;
}

/** The read API response served to the read side. */
export interface TrademarkPortalStatusResponse {
  rows: TrademarkPortalStatusRow[];
  /** When the underlying data was last synced (ISO 8601), or null if never. */
  syncedAt: string | null;
}
