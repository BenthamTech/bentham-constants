/**
 * DSC (Digital Signature Certificate) form constants.
 * Shared between bentham-app (UI rendering, metadata persistence) and
 * bentham-mca-api (request validation, response values).
 */

/**
 * Valid form names for DSC upload to MCA portal.
 * Note: Spice+ Part A is excluded — it does not require DSC upload to MCA.
 */
export const DSC_FORM_NAMES = [
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
