/**
 * Company type constants.
 * Shared between bentham-app (UI rendering, form selection) and
 * bentham-mca-api (filing logic, fee enquiry).
 */
export declare enum CompanyType {
    PRIVATE_LIMITED = "PRIVATE_LIMITED",
    LLP = "LLP"
}
export interface CompanyTypeConfig {
    label: string;
    suffix: string;
    description: string;
}
export declare const COMPANY_TYPE_CONFIG: Record<CompanyType, CompanyTypeConfig>;
