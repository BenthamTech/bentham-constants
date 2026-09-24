/**
 * Shared output/input schemas (contract) for the Trademark Portal Status Sync.
 *
 * Pure type definitions shared between the daily sync job (trademark-api) that pushes the
 * scraped Filing History snapshot and the app that persists/serves it, so both code
 * against one interface and the contract can't drift — a shape change on either side
 * becomes a compile error on the other.
 */
import type { TrademarkPortalStatusType } from './statuses';

/**
 * One scraped Filing History row as pushed by the daily sync job (trademark-api →
 * bentham-app). Raw shape straight off the portal; `applicationStatus` is the raw portal
 * label (normalized on the read side).
 */
export interface TrademarkPortalStatusIngestRow {
  /** Permanent IP India application number (the stable key). */
  applicationNumber: string;
  /** Temporary application number used before the permanent one is issued. */
  temporaryApplicationNumber: string | null;
  /** Portal form type. */
  formType: string;
  /** Trademark class. */
  classNumber: number;
  /** Filing date as a display string ("DD/MM/YYYY"). */
  filingDate: string;
  /** Portal application type. */
  applicationType: string;
  /** Application reference number, when present. */
  applicationReferenceNumber: string | null;
  /** Raw portal status label, e.g. "Under Examination". */
  applicationStatus: string;
  /** Reserved for the application document URL; always null in v1. */
  applicationDoc: string | null;
}

/** The ingest push payload (trademark-api → bentham-app). */
export interface TrademarkPortalStatusIngestRequest {
  /** When the sync ran (ISO 8601). */
  syncedAt: string;
  rows: TrademarkPortalStatusIngestRow[];
}

/**
 * One persisted+served status row (bentham-app → admin dashboard). Extends the ingested
 * shape with the normalized status and change-tracking fields the app maintains.
 */
export interface TrademarkPortalStatusRow {
  applicationNumber: string;
  temporaryApplicationNumber: string | null;
  formType: string;
  classNumber: number;
  filingDate: string;
  applicationType: string;
  applicationReferenceNumber: string | null;
  /** Raw portal status label. */
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
}

/** The read API response (bentham-app → admin dashboard). */
export interface TrademarkPortalStatusResponse {
  rows: TrademarkPortalStatusRow[];
  /** When the underlying data was last synced (ISO 8601), or null if never. */
  syncedAt: string | null;
}
