// The file types Bentham stores.
//
// One table for every repo: the app's pickers and start route, the content type
// signed into an upload URL, and storage-api's content check all read it, so
// they can't drift apart. A type that isn't listed here can't be uploaded.
//
// Pure TypeScript with no Node or zod imports: browser bundles use it too.

/** Every extension Bentham stores. Use these instead of string literals. */
export const FileExtension = {
  PDF: '.pdf',
  JPG: '.jpg',
  JPEG: '.jpeg',
  PNG: '.png',
  XLSX: '.xlsx',
  XLS: '.xls',
  CSV: '.csv',
  /** Service uploads only (mca-api artifacts). No user flow accepts it. */
  ZIP: '.zip',
} as const;
export type FileExtension = (typeof FileExtension)[keyof typeof FileExtension];

export const FILE_EXTENSIONS: readonly FileExtension[] = Object.values(FileExtension);

export interface FileKind {
  readonly extension: FileExtension;
  /** Signed into the upload URL and stored on the object. */
  readonly contentType: string;
  /** For messages: "PDF", "JPG". */
  readonly label: string;
}

/** `satisfies` makes adding an extension without a kind a compile error. */
export const FILE_KINDS = {
  [FileExtension.PDF]: { extension: FileExtension.PDF, contentType: 'application/pdf', label: 'PDF' },
  [FileExtension.JPG]: { extension: FileExtension.JPG, contentType: 'image/jpeg', label: 'JPG' },
  [FileExtension.JPEG]: { extension: FileExtension.JPEG, contentType: 'image/jpeg', label: 'JPEG' },
  [FileExtension.PNG]: { extension: FileExtension.PNG, contentType: 'image/png', label: 'PNG' },
  [FileExtension.XLSX]: {
    extension: FileExtension.XLSX,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'XLSX',
  },
  [FileExtension.XLS]: { extension: FileExtension.XLS, contentType: 'application/vnd.ms-excel', label: 'XLS' },
  [FileExtension.CSV]: { extension: FileExtension.CSV, contentType: 'text/csv', label: 'CSV' },
  [FileExtension.ZIP]: { extension: FileExtension.ZIP, contentType: 'application/zip', label: 'ZIP' },
} as const satisfies Record<FileExtension, FileKind>;

/** How many leading bytes {@link sniffMatches} needs. */
export const SNIFF_BYTES = 4096;

export function isFileExtension(value: unknown): value is FileExtension {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FILE_KINDS, value);
}

/**
 * The lowercase extension of a file name, with the dot: `"Report.PDF"` → `".pdf"`.
 * Returns `''` when there is none (`"README"`, `".env"`, `"name."`).
 */
export function extensionOf(fileName: string): string {
  const base = fileName.slice(Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot).toLowerCase();
}

/** The kind for a file name's extension, or `null` when Bentham doesn't store that type. */
export function kindForFileName(fileName: string): FileKind | null {
  const ext = extensionOf(fileName);
  return isFileExtension(ext) ? FILE_KINDS[ext] : null;
}

/** The content type to sign and store for a file name, or `null` when the type isn't allowed. */
export function contentTypeForFileName(fileName: string): string | null {
  return kindForFileName(fileName)?.contentType ?? null;
}

/**
 * True when the file name's extension is in `accept`.
 * @throws TypeError when `accept` isn't an array (for JS callers still passing `".pdf,.png"`)
 */
export function acceptAllows(accept: readonly FileExtension[], fileName: string): boolean {
  assertAcceptList(accept);
  return (accept as readonly string[]).includes(extensionOf(fileName));
}

/** `[PDF, JPG]` → `"PDF, JPG"`, for messages. */
export function acceptLabel(accept: readonly FileExtension[]): string {
  assertAcceptList(accept);
  return accept.map((ext) => FILE_KINDS[ext].label).join(', ');
}

/** `[PDF, PNG]` → `".pdf,.png"`, for an `<input accept>` attribute. */
export function toAcceptAttribute(accept: readonly FileExtension[]): string {
  assertAcceptList(accept);
  return accept.join(',');
}

function assertAcceptList(accept: unknown): asserts accept is readonly FileExtension[] {
  if (!Array.isArray(accept) || !accept.every(isFileExtension)) {
    throw new TypeError('accept must be an array of FileExtension values');
  }
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PDF_SIGNATURE_WINDOW = 1024;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // also .xlsx
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .xls

function startsWithBytes(head: Uint8Array, signature: number[], offset = 0): boolean {
  if (head.length < offset + signature.length) return false;
  return signature.every((byte, i) => head[offset + i] === byte);
}

/**
 * Whether a file's leading bytes look like the type its extension claims.
 * Pass at least the first {@link SNIFF_BYTES} bytes (or the whole file if it's shorter).
 *
 * - `.pdf`: `%PDF-` within the first 1 KB (some generators put junk before it)
 * - `.jpg`/`.jpeg`, `.png`: their signatures
 * - `.xlsx`, `.zip`: a ZIP local file header. Any ZIP passes, so a renamed
 *   `.docx` or `.xlsm` does too; Excel refuses to open those as `.xlsx`.
 * - `.xls`: an OLE compound file header
 * - `.csv`: no NUL bytes. Any 8-bit encoding passes, since banks export Windows-1252.
 *
 * Returns false for an unknown extension or an empty head.
 */
export function sniffMatches(head: Uint8Array, extension: string): boolean {
  if (head.length === 0) return false;
  switch (extension.toLowerCase()) {
    case FileExtension.PDF: {
      const last = Math.min(head.length, PDF_SIGNATURE_WINDOW) - PDF_SIGNATURE.length;
      for (let i = 0; i <= last; i++) {
        if (startsWithBytes(head, PDF_SIGNATURE, i)) return true;
      }
      return false;
    }
    case FileExtension.JPG:
    case FileExtension.JPEG:
      return startsWithBytes(head, JPEG_SIGNATURE);
    case FileExtension.PNG:
      return startsWithBytes(head, PNG_SIGNATURE);
    case FileExtension.XLSX:
    case FileExtension.ZIP:
      return startsWithBytes(head, ZIP_SIGNATURE);
    case FileExtension.XLS:
      return startsWithBytes(head, OLE_SIGNATURE);
    case FileExtension.CSV:
      return !head.subarray(0, SNIFF_BYTES).includes(0);
    default:
      return false;
  }
}
