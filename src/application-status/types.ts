/**
 * Shared output schema (contract) for the application status API.
 *
 * A pure type definition shared between the service that produces the status data and the
 * app that consumes it, so both code against one interface and the contract can't drift —
 * a shape change on either side becomes a compile error on the other.
 */
import type { ApplicationStatusTabType } from './tabs';

/**
 * One application status entry. The same shape is used for every tab. Values are strings
 * as provided by the source; `srn` may be an empty string, and `submissionDate` is a
 * pre-formatted `DD/MM/YYYY` display string.
 */
export interface ApplicationStatusRow {
  /** Application reference number. */
  referenceNumber: string;
  /** Integration id. */
  integrationId: string;
  /** Form name. */
  formName: string;
  /** Proposed / entity name. */
  proposedName: string;
  /** SRN (may be ""). */
  srn: string;
  /** Current status label, e.g. "Approved" | "Under Processing". */
  status: string;
  /** Purpose field. */
  purpose: string;
  /** Identification number / identifier. */
  identificationNo: string;
  /** Submission / last-modified date as a display string ("DD/MM/YYYY"). */
  submissionDate: string;
  /** Contact who filed the entry. */
  filedBy: string;
  /** Which tab this entry belongs to. */
  tab: ApplicationStatusTabType;
}

/**
 * The API response: entries keyed by tab. Partial because the response contains only the
 * tabs that were requested.
 */
export type ApplicationStatusResponse = Partial<
  Record<ApplicationStatusTabType, ApplicationStatusRow[]>
>;
