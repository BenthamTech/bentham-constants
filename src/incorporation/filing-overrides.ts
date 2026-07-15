/**
 * Defines override actions for the filing pipeline that take precedence over standard status-driven logic.
 */
export enum FilingOverrides {
    /**
     * Instructs the orchestrator to skip OTP collection and force the submission of forms,
     * proceeding directly through the full pipeline (SPICe-B -> INC -> Agile Pro)
     * using the God Mode OTP bypass, primarily for automated sanity checks.
     */
    SANITY_FILING = 'SANITY_FILING'
}
