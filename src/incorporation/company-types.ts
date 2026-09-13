/**
 * Company type constants.
 * Shared across services for UI rendering, form selection, and filing logic.
 */

export enum CompanyType {
  PRIVATE_LIMITED = 'PRIVATE_LIMITED',
  LLP = 'LLP',
}

export interface CompanyTypeConfig {
  label: string;
  suffix: string;
  description: string;
}

export const COMPANY_TYPE_CONFIG: Record<CompanyType, CompanyTypeConfig> = {
  [CompanyType.PRIVATE_LIMITED]: {
    label: 'Private Limited Company',
    suffix: 'PRIVATE LIMITED',
    description: 'Best for startups planning to raise funding. Limited liability, 2-200 shareholders.',
  },
  [CompanyType.LLP]: {
    label: 'Limited Liability Partnership',
    suffix: 'LLP',
    description: 'Best for professional services and small businesses. Lower compliance, no audit below ₹40L turnover.',
  },
};
