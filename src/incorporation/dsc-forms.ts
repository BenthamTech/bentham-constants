/**
 * DSC (Digital Signature Certificate) form constants.
 * Shared across services for UI rendering, request validation, and metadata persistence.
 */

/**
 * Valid form names that accept a Digital Signature Certificate.
 * Note: the name-reservation form is excluded — it does not require a DSC.
 */
export const DSC_FORM_NAMES = [
  'SPICE + Part B',
  'INC-9',
  'INC-33',
  'INC-34',
  'AGILE PRO',
] as const;

export type DscFormName = (typeof DSC_FORM_NAMES)[number];

/** Upload status for each DSC form — used in metadata persistence and API responses. */
export enum DscMcaUploadStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}
