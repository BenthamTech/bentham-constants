export const FilingMode = {
  SANITY_FILING: 'SANITY_FILING',
  SANITY_FILING_OFFICE_ADDRESS_UPDATE: 'SANITY_FILING_OFFICE_ADDRESS_UPDATE',
  FORCE_REFILL: 'FORCE_REFILL',
  FORCE_FILE_AGILE_PRO: 'FORCE_FILE_AGILE_PRO',
} as const;

export type FilingModeType = (typeof FilingMode)[keyof typeof FilingMode];

/**
 * Modes that run the full sanity pipeline (SPICe-A → SPICe-B → INC → Agile Pro)
 * with per-form filed-skip guards. Membership is EXPLICIT, not a name-prefix check —
 * do not switch this to `startsWith('SANITY_FILING')`, which would silently sweep in
 * any future SANITY_* mode regardless of whether that behaviour is correct for it.
 */
const SANITY_MODES: ReadonlySet<string> = new Set([
  FilingMode.SANITY_FILING,
  FilingMode.SANITY_FILING_OFFICE_ADDRESS_UPDATE,
]);

/** True when the mode should run the full sanity pipeline. */
export function isSanityMode(mode: string | null | undefined): boolean {
  return mode != null && SANITY_MODES.has(mode);
}

/** Rich config for UI rendering — keyed by FilingMode values */
export const FILING_MODES_CONFIG = {
  [FilingMode.SANITY_FILING]: {
    label: 'Sanity Filing',
    description:
      'Runs the full filing pipeline as a pre-submission sanity check before the client call.',
  },
  [FilingMode.SANITY_FILING_OFFICE_ADDRESS_UPDATE]: {
    label: 'Sanity Filing — Office Address Update',
    description:
      'Same as Sanity Filing, but always re-edits the SPICe-B Address of Company step in full (even if already filled) to correct the registered/correspondence office address.',
  },
  [FilingMode.FORCE_REFILL]: {
    label: 'Force Refill',
    description:
      'Re-fills all forms from scratch, ignoring filed status. Used to correct data in already-submitted forms.',
  },
  [FilingMode.FORCE_FILE_AGILE_PRO]: {
    label: 'Force File Agile Pro',
    description:
      'Skip all other steps and directly edit/re-file the final form, even if already submitted.',
  },
} as const;
