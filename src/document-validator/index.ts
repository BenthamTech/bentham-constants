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

// --- Endpoint paths (single source of truth) ---
export const DOCUMENT_VALIDATOR_PATHS = {
  verifyDsc: '/api/v1/validate/verify-dsc',
  geotag: '/api/validate/geotag',
  pan: '/api/validate/pan',
  aadhaar: '/api/validate/aadhaar',
  addressProof: '/api/validate/utility-bill',
} as const;
