// Wire contract for the filing-callback webhooks that the filing services
// (bentham-mca-api, bentham_trademark_api) send to bentham-app.
//
// bentham-app owns these routes. Senders import the paths and payload types
// from here, and the app derives its request schemas from the same types, so a
// renamed path or field breaks the build instead of failing at runtime as a
// swallowed 400/404 (the senders are fire-and-forget).
//
// A path or field change here needs a coordinated update in every consumer:
//   - BenthamTech/bentham-mca-api#803
//   - BenthamTech/bentham_trademark_api#502
//   - BenthamTech/bentham-app#2191
//
// Plain consts and types only: the JS services `require` this module, so it
// must not pull in zod or any other runtime dependency.

export const FilingWebhookPath = {
  COMPANY_STATUS: '/api/webhooks/company-filing/status',
  COMPANY_REFERENCE_ID: '/api/webhooks/company-filing/reference-id',
  COMPANY_OTP_PROGRESS: '/api/webhooks/company-filing/otp-progress',
  TRADEMARK_STATUS: '/api/webhooks/trademark-filing/status',
} as const;

export const MarkType = { WORD: 'WORD', LOGO: 'LOGO' } as const;
export type MarkType = (typeof MarkType)[keyof typeof MarkType];
export const MARK_TYPES = Object.values(MarkType);

/** Receiver-enforced limits, so senders can truncate before sending. */
export const FILING_WEBHOOK_LIMITS = { ERROR_MAX: 1000, FAILED_STEP_MAX: 100 } as const;

export interface FilingErrorFields {
  error: string;
  failedStep?: string;
}

// --- company-filing/status ---
// `status` stays `string`: this package's COMPANY_STATUSES and the app's
// CompanyStatus enum don't agree yet, and the app validates it against its own enum.
export type CompanyFilingStatusPayload =
  | { applicationId: string; status: string; reason?: string; message?: string }
  | ({ applicationId: string } & FilingErrorFields);

// --- company-filing/reference-id ---
export interface CompanyFilingReferenceIdPayload {
  applicationId: string;
  filingApplicationReferenceId: string;
}

// --- company-filing/otp-progress ---
export type OtpRoundState = 'verified' | 'pending';

export interface CompanyOtpProgressPayload {
  applicationId: string;
  otpProgress: {
    address: OtpRoundState;
    /** Keyed by director identifier. */
    directors: Record<string, OtpRoundState>;
    totalDirectors: number;
    /** ISO 8601. */
    lastAttemptAt: string;
  };
}

// --- trademark-filing/status ---
export type TrademarkFilingStatusPayload =
  | { applicationId: string; applicationNumber: string; markType: MarkType }
  | ({ applicationId: string; markType: MarkType } & FilingErrorFields);
