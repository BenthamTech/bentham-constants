"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILING_MODES_CONFIG = exports.FilingMode = void 0;
exports.FilingMode = {
    SANITY_FILING: 'SANITY_FILING',
    FORCE_REFILL: 'FORCE_REFILL',
    FORCE_FILE_AGILE_PRO: 'FORCE_FILE_AGILE_PRO',
};
/** Rich config for UI rendering — keyed by FilingMode values */
exports.FILING_MODES_CONFIG = {
    [exports.FilingMode.SANITY_FILING]: {
        label: 'Sanity Filing',
        description: 'Full pipeline (SPICe-B → INC → Agile Pro) skipping OTP. Used for automated sanity checks before the client call.',
    },
    [exports.FilingMode.FORCE_REFILL]: {
        label: 'Force Refill',
        description: 'Re-fills all forms (SPICe-B → INC → Agile Pro) from scratch, ignoring filed status. Used to correct data in already-submitted forms.',
    },
    [exports.FilingMode.FORCE_FILE_AGILE_PRO]: {
        label: 'Force File Agile Pro',
        description: 'Skip all other steps and directly edit/re-file Agile Pro, even if already submitted.',
    },
};
