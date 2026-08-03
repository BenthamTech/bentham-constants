/**
 * DSC (Digital Signature Certificate) form constants.
 * Shared between bentham-app (UI rendering, metadata persistence) and
 * bentham-mca-api (request validation, response values).
 */

/**
 * Valid form names for DSC upload/download on MCA portal.
 * Note: "Spice+ Part A" has a dynamic suffix on MCA (e.g. "Spice+ Part A(Name Reservation Valid till: 27-JUL-26)")
 * but we store/display the base name. The mca-api uses startsWith matching for Part A.
 */
export const DSC_FORM_NAMES = [
  'Spice+ Part A',
  'SPICE + Part B',
  'INC-9',
  'INC-33',
  'INC-34',
  'AGILE PRO',
] as const;

export type DscFormName = (typeof DSC_FORM_NAMES)[number];

/** MCA upload status for each DSC form — used in metadata persistence and API responses. */
export enum DscMcaUploadStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}
