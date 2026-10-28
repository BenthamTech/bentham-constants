// The file types Bentham stores, keyed by extension.
//
// One table for every repo: the app's pickers and start route, the content type
// signed into an upload URL, and storage-api's content check all read it, so
// they can't drift apart. A type that isn't listed here can't be uploaded.
//
// Pure TypeScript with no Node or zod imports: browser bundles use it too.

export interface FileKind {
  /** Lowercase, with the leading dot. */
  readonly extension: string;
  /** Signed into the upload URL and stored on the object. */
  readonly contentType: string;
  /** For messages: "PDF", "JPG". */
  readonly label: string;
}

export const FILE_KINDS = {
  '.pdf': { extension: '.pdf', contentType: 'application/pdf', label: 'PDF' },
  '.jpg': { extension: '.jpg', contentType: 'image/jpeg', label: 'JPG' },
  '.jpeg': { extension: '.jpeg', contentType: 'image/jpeg', label: 'JPEG' },
  '.png': { extension: '.png', contentType: 'image/png', label: 'PNG' },
  '.xlsx': {
    extension: '.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'XLSX',
  },
  '.xls': { extension: '.xls', contentType: 'application/vnd.ms-excel', label: 'XLS' },
  '.csv': { extension: '.csv', contentType: 'text/csv', label: 'CSV' },
  /** Service uploads only (mca-api artifacts). No user flow accepts it. */
  '.zip': { extension: '.zip', contentType: 'application/zip', label: 'ZIP' },
} as const satisfies Record<string, FileKind>;

export type FileExtension = keyof typeof FILE_KINDS;

export const FILE_EXTENSIONS = Object.keys(FILE_KINDS) as FileExtension[];

/** How many leading bytes {@link sniffMatches} needs. */
export const SNIFF_BYTES = 4096;

export function isFileExtension(value: string): value is FileExtension {
  return Object.prototype.hasOwnProperty.call(FILE_KINDS, value);
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
 * Parse an accept string, as used by `<input accept>` and `UploadRules.accept`:
 * `".pdf, .JPG"` → `['.pdf', '.jpg']`.
 *
 * @throws Error when it's empty or names a type that isn't in {@link FILE_KINDS}.
 *   Accept strings are code, not user input, so that's a bug to surface.
 */
export function parseAccept(accept: string): FileExtension[] {
  const entries = accept
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) throw new Error('accept is empty');
  for (const entry of entries) {
    if (!isFileExtension(entry)) throw new Error(`accept lists "${entry}", which is not in FILE_KINDS`);
  }
  return [...new Set(entries)] as FileExtension[];
}

/** True when {@link parseAccept} would accept it. */
export function isValidAccept(accept: string): boolean {
  try {
    parseAccept(accept);
    return true;
  } catch {
    return false;
  }
}

/** True when the file name's extension is one that `accept` lists. Throws like {@link parseAccept}. */
export function acceptAllows(accept: string, fileName: string): boolean {
  return (parseAccept(accept) as string[]).includes(extensionOf(fileName));
}

/** `".pdf,.jpg"` → `"PDF, JPG"`, for messages. Throws like {@link parseAccept}. */
export function acceptLabel(accept: string): string {
  return parseAccept(accept)
    .map((ext) => FILE_KINDS[ext].label)
    .join(', ');
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
 * - `.xlsx`, `.zip`: a ZIP local file header
 * - `.xls`: an OLE compound file header
 * - `.csv`: no NUL bytes. Any 8-bit encoding passes, since banks export Windows-1252.
 *
 * Returns false for an unknown extension or an empty head.
 */
export function sniffMatches(head: Uint8Array, extension: string): boolean {
  if (head.length === 0) return false;
  switch (extension.toLowerCase()) {
    case '.pdf': {
      const last = Math.min(head.length, PDF_SIGNATURE_WINDOW) - PDF_SIGNATURE.length;
      for (let i = 0; i <= last; i++) {
        if (startsWithBytes(head, PDF_SIGNATURE, i)) return true;
      }
      return false;
    }
    case '.jpg':
    case '.jpeg':
      return startsWithBytes(head, JPEG_SIGNATURE);
    case '.png':
      return startsWithBytes(head, PNG_SIGNATURE);
    case '.xlsx':
    case '.zip':
      return startsWithBytes(head, ZIP_SIGNATURE);
    case '.xls':
      return startsWithBytes(head, OLE_SIGNATURE);
    case '.csv':
      return !head.subarray(0, SNIFF_BYTES).includes(0);
    default:
      return false;
  }
}
