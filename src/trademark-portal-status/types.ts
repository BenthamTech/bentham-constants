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
  /** Trademark class. */
  classNumber: number;
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
  classNumber: number;
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
}

/** The read API response served to the read side. */
export interface TrademarkPortalStatusResponse {
  rows: TrademarkPortalStatusRow[];
  /** When the underlying data was last synced (ISO 8601), or null if never. */
  syncedAt: string | null;
}
