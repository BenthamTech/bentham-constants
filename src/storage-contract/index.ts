// Wire contract for uploads through bentham-storage-api.
//
// Every upload, from a browser or a service, takes the same three steps:
//   1. upload_url: storage-api signs a PUT into the uploads bucket.
//   2. The caller PUTs the bytes straight to GCS with exactly the signed headers.
//   3. promote (after an optional check): storage-api runs the shared file checks
//      and copies the object into the documents bucket under today's naming.
//
// Plain consts and types only, with no Node or zod imports, so browser bundles
// and the JS services can import it. storage-api's request schemas are typed
// against these interfaces, so a renamed field breaks its build.
//
// A change here needs a coordinated update in storage-api, the app, mca-api
// and trademark-api.

/** Largest file a user can upload in any flow. Each flow sets its own lower limit. */
export const PLATFORM_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Largest file storage-api accepts from any caller. Sized for mca-api's ZIPs (up to 60 MB). */
export const SERVICE_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Staging bucket. Objects are deleted after a day; nothing should link to them. */
export const UPLOADS_BUCKET = 'bentham_storage_uploads';

/** Lifetime of a signed upload URL. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/** Longest file name storage-api accepts. */
export const MAX_UPLOAD_FILE_NAME_LENGTH = 200;

export const StorageUploadPath = {
  UPLOAD_URL: '/api/v1/files/upload_url',
  CHECK: '/api/v1/files/check',
  PROMOTE: '/api/v1/files/promote',
} as const;

// --- Refusals ---
// check and promote answer 422 with an UploadRefusal when the file fails a
// check. A refusal is permanent: retrying the same file gets the same answer.

export const UploadRefusalCode = {
  EMPTY: 'EMPTY',
  TOO_LARGE: 'TOO_LARGE',
  TYPE_NOT_ALLOWED: 'TYPE_NOT_ALLOWED',
  CONTENT_MISMATCH: 'CONTENT_MISMATCH',
  PASSWORD_PROTECTED_PDF: 'PASSWORD_PROTECTED_PDF',
} as const;
export type UploadRefusalCode = (typeof UploadRefusalCode)[keyof typeof UploadRefusalCode];
export const UPLOAD_REFUSAL_CODES = Object.values(UploadRefusalCode);

export const UPLOAD_REFUSAL_STATUS = 422;

export const PASSWORD_PROTECTED_PDF_MESSAGE =
  'This PDF is password-protected. Open it, save or print it as a PDF without a password, and upload it again.';

/** The message storage-api sends with each code. Safe to show to users. */
export const UPLOAD_REFUSAL_MESSAGES: Record<UploadRefusalCode, string> = {
  EMPTY: 'This file is empty. Check the file and upload it again.',
  TOO_LARGE: 'This file is larger than this upload allows.',
  TYPE_NOT_ALLOWED: "This type of file can't be uploaded here.",
  CONTENT_MISMATCH:
    "This file's contents don't match its extension. Save it in the right format and upload it again.",
  PASSWORD_PROTECTED_PDF: PASSWORD_PROTECTED_PDF_MESSAGE,
};

export interface UploadRefusal {
  success: false;
  code: UploadRefusalCode;
  message: string;
}

export function isUploadRefusalCode(value: unknown): value is UploadRefusalCode {
  return typeof value === 'string' && (UPLOAD_REFUSAL_CODES as string[]).includes(value);
}

/** True for a 422 body from check or promote. */
export function isUploadRefusal(body: unknown): body is UploadRefusal {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as UploadRefusal).success === false &&
    isUploadRefusalCode((body as UploadRefusal).code)
  );
}

// --- Shapes ---
// Success responses keep storage-api's envelope: { success: true, message, data }.
// The *Response types below are `data`.

export interface StorageApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
}

/** What a flow allows. The caller sends it with check and promote, and storage-api enforces exactly that. */
export interface UploadRules {
  /** Allowed extensions, as in `<input accept>`: `".pdf,.jpg"`. Each must be in FILE_KINDS. */
  accept: string;
  /** Bytes. At most SERVICE_MAX_UPLOAD_BYTES; user flows stay within PLATFORM_MAX_UPLOAD_BYTES. */
  maxSize: number;
}

/** POST upload_url. storage-api derives the content type from the extension and refuses types not in FILE_KINDS (400). */
export interface UploadUrlRequest {
  /** A plain file name, no path: at most MAX_UPLOAD_FILE_NAME_LENGTH characters. */
  fileName: string;
  /** Exact size in bytes, 1 to SERVICE_MAX_UPLOAD_BYTES. The signature binds it. */
  size: number;
}

export interface SignedPut {
  method: 'PUT';
  url: string;
  /**
   * Send exactly these: Content-Type, x-goog-content-length-range and
   * x-goog-if-generation-match. GCS refuses the PUT if any differs.
   */
  headers: Record<string, string>;
}

export interface UploadUrlResponse {
  uploadId: string;
  /** `https://storage.googleapis.com/bentham_storage_uploads/{uploadId}/{fileName}`, with the extension lowercased. */
  objectUrl: string;
  contentType: string;
  /** A credential: never log `upload.url`. */
  upload: SignedPut;
  /** ISO 8601. */
  expiresAt: string;
}

/**
 * POST check: runs the shared file checks on a staged object without moving it.
 * Use it before reading the staged file elsewhere (the document validator).
 * 404 when the staged object doesn't exist.
 */
export interface CheckUploadRequest {
  /** A staged object, from UploadUrlResponse.objectUrl. */
  objectUrl: string;
  rules: UploadRules;
  /** The size the caller declared when it asked for the upload URL. */
  expectedSize: number;
}

export interface CheckUploadResponse {
  size: number;
  contentType: string;
}

/**
 * POST promote: runs the same checks, copies the staged object to
 * `{folderPath}/{timestamp}-{fileName}` in the documents bucket, and deletes
 * the staged copy.
 *
 * Idempotent: the destination name is deterministic, so a retry after a
 * success returns the stored object. 404 when neither exists.
 */
export interface PromoteUploadRequest extends CheckUploadRequest {
  /** Folder in the documents bucket, e.g. `incorporation/{appId}/attachments`. */
  folderPath: string;
  /** Epoch milliseconds for the name prefix. Reuse the same value on retries. */
  timestamp: number;
}

export interface PromoteUploadResponse {
  /** The stored file: `https://storage.googleapis.com/{documents bucket}/{folderPath}/{timestamp}-{fileName}`. */
  url: string;
  size: number;
  contentType: string;
}
