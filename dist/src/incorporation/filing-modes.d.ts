export declare const FilingMode: {
    readonly SANITY_FILING: "SANITY_FILING";
    readonly FORCE_REFILL: "FORCE_REFILL";
    readonly FORCE_FILE_AGILE_PRO: "FORCE_FILE_AGILE_PRO";
};
export type FilingModeType = (typeof FilingMode)[keyof typeof FilingMode];
/** Rich config for UI rendering — keyed by FilingMode values */
export declare const FILING_MODES_CONFIG: {
    readonly SANITY_FILING: {
        readonly label: "Sanity Filing";
        readonly description: "Full pipeline (SPICe-B → INC → Agile Pro) skipping OTP. Used for automated sanity checks before the client call.";
    };
    readonly FORCE_REFILL: {
        readonly label: "Force Refill";
        readonly description: "Re-fills all forms (SPICe-B → INC → Agile Pro) from scratch, ignoring filed status. Used to correct data in already-submitted forms.";
    };
    readonly FORCE_FILE_AGILE_PRO: {
        readonly label: "Force File Agile Pro";
        readonly description: "Skip all other steps and directly edit/re-file Agile Pro, even if already submitted.";
    };
};
