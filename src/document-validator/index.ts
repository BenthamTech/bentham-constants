// Wire contracts for the bentham-document-validator-api HTTP service.
//
// This is the single source of truth for the request/response shapes and
// endpoint paths shared between the validator (server) and its clients
// (e.g. bentham-app). Both repos import from here so the contract can never
// drift. Validator-internal shapes (Zod schemas, captcha interfaces, Gemini
// prompt internals, user-facing failure copy) deliberately do NOT live here.

// --- DSC ---
export type DscCertificateStatus =
  | 'TRUSTED'
  | 'UNTRUSTED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'NOT_VERIFIED'
  | 'UNKNOWN';

export interface DscSignature {
  fieldName: string;
  signerName: string;
  signingTime: string | null;
  hashAlgorithm: string | null;
  isValid: boolean; // integrity AND certificate trusted
  signatureIntegrityValid: boolean;
  certificateStatus: DscCertificateStatus;
  certificateStatusText: string | null;
}

export interface DscVerificationResult {
  isSigned: boolean;
  signatures: DscSignature[];
}

// --- Address proof ---
export interface AddressProofAddress {
  addressLine1: string | null;
  addressLine2: string | null;
  areaOrLocality: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pinCode: string | null;
  country: string | null;
}

export type AddressProofFailureReason =
  | 'NOT_ADDRESS_PROOF'
  | 'UNREADABLE_DATE'
  | 'STALE'
  | 'NO_PERSON_NAME'
  | 'NO_ADDRESS'
  | null;

export interface AddressProofValidationResponse {
  isValid: boolean;
  message?: string;
  failureReason?: AddressProofFailureReason;
  extractedData?: {
    personName?: string;
    address?: AddressProofAddress;
    issueDate?: string;
    documentType?: string;
    ageInDays?: number;
  };
}

// --- Geotag ---
export interface GeotagValidationResponse {
  isValid: boolean;
  extractedData: {
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  };
  message?: string;
}

// --- PAN / Aadhaar extraction ---
export interface PanExtractedData {
  panNumber: string | null;
  name: string | null;
  fathersName: string | null;
  dob: string | null;
}

export interface AadhaarExtractedData {
  name: string | null;
  aadhaarNumber: string | null;
  dob: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  phone: string | null;
  address: AddressProofAddress;
}

// --- COI (Certificate of Incorporation) extraction ---
export interface CoiExtractedData {
  registrationNumber: string | null; // CIN or LLPIN, normalised
  companyName: string | null;
  incorporationDate: string | null; // YYYY-MM-DD; null unless it passed the validator's date checks
}

export type CoiWarning =
  | 'DATE_INVALID' // date unparseable, in the future or before 1850
  | 'DATE_UNVERIFIED'; // no valid CIN/LLPIN, or the CIN year doesn't match the date

export type CoiRejection =
  | 'UNSUPPORTED_FILE_TYPE' // not a PDF, JPEG or PNG
  | 'PASSWORD_PROTECTED'
  | 'UNREADABLE' // corrupt PDF
  | 'NOT_COI';

export interface CoiValidationResult {
  isValid: boolean;
  rejection?: CoiRejection; // when isValid === false
  extractedData?: CoiExtractedData; // when isValid === true
  warnings?: CoiWarning[];
}

// --- Endpoint paths (single source of truth) ---
export const DOCUMENT_VALIDATOR_PATHS = {
  verifyDsc: '/api/v1/validate/verify-dsc',
  coi: '/api/v1/validate/coi',
  geotag: '/api/v1/validate/geotag',
  pan: '/api/v1/validate/pan',
  aadhaar: '/api/v1/validate/aadhaar',
  addressProof: '/api/v1/validate/utility-bill',
} as const;
