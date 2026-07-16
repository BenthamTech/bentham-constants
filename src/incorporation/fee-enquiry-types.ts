/**
 * Response shape from POST /api/v1/mca/company/fee
 * All values are strings as returned by the MCA portal DOM parsing.
 */
export interface FeeEnquiryData {
  normalFee: string;
  additionalFee: string;
  MoARegFee: string;
  AoARegFee: string;
  panTanFees: string;
  total: string;
  stampDutyMoA: string;
  stampDutyAoA: string;
  stampDutySpicePlusPartB: string;
  stampDuty: string;
}

/**
 * States accepted by the MCA fee enquiry portal.
 * Uses MCA's legacy naming (ORISSA not ODISHA, PONDICHERRY not PUDUCHERRY,
 * CHATTISGARH not CHHATTISGARH) which differs from INCORPORATION_STATES.
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
