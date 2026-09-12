/**
 * Entity types supported by the fee enquiry form.
 */
export type FeeEnquiryEntityType = 'Company' | 'LLP';

/**
 * Response shape for a company fee enquiry.
 * Guaranteed fields (normalFee, additionalFee, total) are always present.
 * Company-specific fields are optional — only returned for Company enquiries.
 *
 * BREAKING: Company-specific fields changed from required to optional.
 * Consumers accessing MoARegFee, AoARegFee, etc. must add null checks.
 * See consumer PRs linked in this PR description.
 */
export interface FeeEnquiryData {
  normalFee: string;
  additionalFee: string;
  total: string;
  // Company-specific (present only for Company enquiries)
  MoARegFee?: string;
  AoARegFee?: string;
  panTanFees?: string;
  stampDutyMoA?: string;
  stampDutyAoA?: string;
  stampDutySpicePlusPartB?: string;
  stampDuty?: string;
}

/**
 * Input fields for a Company fee enquiry.
 * Non-varying provider fields are set internally by the handler.
 */
export interface CompanyFeeEnquiryInput {
  enquireFeeFor: 'Company';
  state: McaFeeEnquiryState;
  hasAuthorisedCapital: boolean;
  authorisedCapital?: number;
  isOpcSmallCompany?: boolean;
  isSection8Company?: boolean;
}

/**
 * Input fields for an LLP fee enquiry.
 * Non-varying provider fields are set internally by the handler —
 * only contribution varies per query.
 */
export interface LlpFeeEnquiryInput {
  enquireFeeFor: 'LLP';
  contribution: number;
}

/**
 * Discriminated union of fee enquiry inputs.
 */
export type FeeEnquiryInput = CompanyFeeEnquiryInput | LlpFeeEnquiryInput;

/**
 * State names accepted by the fee enquiry provider.
 * Uses the provider's legacy spellings (ORISSA not ODISHA, PONDICHERRY not
 * PUDUCHERRY, CHATTISGARH not CHHATTISGARH) which differ from INCORPORATION_STATES.
 */
export const MCA_FEE_ENQUIRY_STATES = [
  'ANDHRA PRADESH',
  'ARUNACHAL PRADESH',
  'ASSAM',
  'BIHAR',
  'CHATTISGARH',
  'GOA',
  'GUJARAT',
  'HARYANA',
  'HIMACHAL PRADESH',
  'JHARKHAND',
  'KARNATAKA',
  'KERALA',
  'MADHYA PRADESH',
  'MAHARASHTRA',
  'MANIPUR',
  'MEGHALAYA',
  'MIZORAM',
  'NAGALAND',
  'ORISSA',
  'PUNJAB',
  'RAJASTHAN',
  'SIKKIM',
  'TAMIL NADU',
  'TELANGANA',
  'TRIPURA',
  'UTTAR PRADESH',
  'UTTARAKHAND',
  'WEST BENGAL',
  'ANDAMAN AND NICOBAR ISLANDS',
  'CHANDIGARH',
  'DADRA & NAGAR HAVELI',
  'DAMAN AND DIU',
  'DELHI',
  'JAMMU & KASHMIR',
  'LADAKH',
  'LAKSHADWEEP',
  'PONDICHERRY',
] as const;

export type McaFeeEnquiryState = typeof MCA_FEE_ENQUIRY_STATES[number];
