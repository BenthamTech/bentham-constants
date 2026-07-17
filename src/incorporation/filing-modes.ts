export const FilingMode = {
  SANITY_FILING: 'SANITY_FILING',
} as const;

export type FilingModeType = (typeof FilingMode)[keyof typeof FilingMode];

/** Rich config for UI rendering — keyed by FilingMode values */
export const FILING_MODES_CONFIG = {
  [FilingMode.SANITY_FILING]: {
    label: 'Sanity Filing',
    description:
      'Full pipeline (SPICe-B → INC → Agile Pro) skipping OTP. Used for automated sanity checks before the client call.',
  },
} as const;
