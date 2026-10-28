import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as crypto from 'node:crypto';

import { BaseServiceClient, ServiceClientError } from '../http';
import { serviceUrls } from '../config';
import { fetchExternal } from '../fetch';
import { HMAC_ENV_KEYS } from '../env-keys';
import { acceptAllows, kindForFileName } from '../file-kinds';
import {
  SERVICE_MAX_UPLOAD_BYTES,
  StorageUploadPath,
  UPLOAD_REFUSAL_MESSAGES,
  UPLOAD_REFUSAL_STATUS,
  UploadRefusalCode,
  isUploadRefusal,
  type CheckUploadRequest,
  type CheckUploadResponse,
  type PromoteUploadRequest,
  type PromoteUploadResponse,
  type SignedPut,
  type StorageApiSuccess,
  type UploadUrlRequest,
  type UploadUrlResponse,
} from '../storage-contract';

export * from '../storage-contract';

export interface StorageClientOptions {
  /** Calling service name (sent as x-service-id in HMAC headers) */
  serviceName: string;
  /** Override the storage API base URL (defaults to serviceUrls.storage) */
  baseUrl?: string;
  /** Override the HMAC secret env var name (defaults to 'BENTHAM_STORAGE_API_HMAC') */
  secretEnvVar?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface UploadFileOptions {
  /**
   * Extensions this upload may have, as in `<input accept>`: `'.pdf'`.
   * Defaults to the file name's own extension, which must be in FILE_KINDS.
   */
  accept?: string;
  /** Largest allowed size in bytes. Defaults to SERVICE_MAX_UPLOAD_BYTES. */
  maxSize?: number;
  /** Timeout for the PUT to GCS. Defaults to 60 s plus 2 s per MiB. */
  putTimeoutMs?: number;
}

export interface DownloadOptions {
  /** Request timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Validate file content after download (default: true) */
  validate?: boolean;
  /** Custom temp directory (default: os.tmpdir()) */
  tempDir?: string;
  /**
   * Name the temp file after the source object's friendly name (derived via
   * {@link friendlyNameFromStorageUrl}). Falls back to the `bentham_dl_` name
   * when no friendly name can be derived. Default: false.
   */
  preserveName?: boolean;
}

/**
 * Pre-built HMAC-authenticated client for bentham-storage-api.
 * Provides typed methods for all storage operations: getSignedUrl, uploadFile, deleteFile,
 * and the direct-upload steps (createUploadUrl, checkUpload, promoteUpload).
 *
 * @example
 * ```ts
 * import { StorageClient } from '@bentham/constants/storage';
 *
 * const storage = new StorageClient({ serviceName: 'bentham-mca-api' });
 * const signedUrl = await storage.getSignedUrl('gs://bucket/path/file.pdf');
 * ```
 */
export class StorageClient extends BaseServiceClient {
  constructor(opts: StorageClientOptions) {
    super({
      baseUrl: opts.baseUrl ?? serviceUrls.storage,
      auth: {
        secretEnvVar: opts.secretEnvVar ?? HMAC_ENV_KEYS.STORAGE,
        serviceName: opts.serviceName,
      },
      timeout: opts.timeout ?? 30_000,
    });
  }

  /**
   * Get a signed download URL for a GCS file.
   * @param gcsUrl - The GCS URL (gs:// or https://storage.googleapis.com/...) stored in the database
   * @returns Signed download URL (valid for ~15 minutes)
   */
  async getSignedUrl(gcsUrl: string): Promise<string> {
    try {
      const res = await this.post<{ data: { url: string } }>(
        '/api/v1/files/signed_url',
        { url: gcsUrl },
      );
      return res.data.url;
    } catch (err) {
      if (err instanceof ServiceClientError) {
        throw new StorageClientError('getSignedUrl', err.status, err.responseBody);
      }
      throw err;
    }
  }

  /**
   * Store a file from this service. Asks storage-api for a signed upload URL,
   * PUTs the bytes straight to GCS, then promotes the file into `folderPath`.
   *
   * The content type comes from the file name's extension, which must be in
   * FILE_KINDS. A file path is streamed, so a large file isn't held in memory.
   *
   * @param content - The bytes, or the path of a local file
   * @param fileName - Name to store as (e.g. 'incorporation_artifacts.zip')
   * @param folderPath - Folder in the documents bucket (e.g. 'applications/123/documents')
   * @returns The stored file's URL
   * @throws StorageClientError. When `code` is set the file was refused: retrying won't help.
   */
  async uploadFile(
    content: Buffer | Uint8Array | string,
    fileName: string,
    folderPath: string,
    options: UploadFileOptions = {},
  ): Promise<string> {
    const kind = kindForFileName(fileName);
    const accept = options.accept ?? kind?.extension ?? '';
    if (!kind || !acceptAllows(accept, fileName)) {
      throw refusal(UploadRefusalCode.TYPE_NOT_ALLOWED);
    }

    const maxSize = options.maxSize ?? SERVICE_MAX_UPLOAD_BYTES;
    const size =
      typeof content === 'string' ? (await fs.promises.stat(content)).size : content.byteLength;
    if (size === 0) throw refusal(UploadRefusalCode.EMPTY);
    if (size > maxSize) throw refusal(UploadRefusalCode.TOO_LARGE);

    const target = await this.createUploadUrl({ fileName, size });
    await putToSignedUrl(target.upload, content, size, options.putTimeoutMs ?? defaultPutTimeoutMs(size));
    const stored = await this.promoteUpload({
      objectUrl: target.objectUrl,
      folderPath,
      timestamp: Date.now(),
      rules: { accept, maxSize },
      expectedSize: size,
    });
    return stored.url;
  }

  /**
   * Get a signed PUT into the uploads bucket. Send the bytes with exactly
   * `upload.headers`; the URL is a credential, so never log it.
   */
  async createUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResponse> {
    return this.postData('createUploadUrl', StorageUploadPath.UPLOAD_URL, request);
  }

  /**
   * Run the shared file checks on a staged object without moving it.
   * @throws StorageClientError with `code` set when the file is refused (422)
   */
  async checkUpload(request: CheckUploadRequest): Promise<CheckUploadResponse> {
    return this.postData('checkUpload', StorageUploadPath.CHECK, request);
  }

  /**
   * Run the shared file checks, then move a staged object into the documents
   * bucket as `{folderPath}/{timestamp}-{fileName}`. Safe to retry with the same request.
   * @throws StorageClientError with `code` set when the file is refused (422)
   */
  async promoteUpload(request: PromoteUploadRequest): Promise<PromoteUploadResponse> {
    return this.postData('promoteUpload', StorageUploadPath.PROMOTE, request);
  }

  private async postData<T>(operation: string, apiPath: string, payload: unknown): Promise<T> {
    try {
      const res = await this.post<StorageApiSuccess<T>>(apiPath, payload);
      return res.data;
    } catch (err) {
      if (err instanceof ServiceClientError) {
        throw new StorageClientError(
          operation,
          err.status,
          err.responseBody,
          refusalCodeOf(err.status, err.responseBody),
        );
      }
      throw err;
    }
  }

  /**
   * Delete a file from GCS.
   * @param gcsUrl - The GCS URL of the file to delete
   */
  async deleteFile(gcsUrl: string): Promise<void> {
    try {
      await this.post('/api/v1/files/delete', { url: gcsUrl });
    } catch (err) {
      if (err instanceof ServiceClientError) {
        throw new StorageClientError('deleteFile', err.status, err.responseBody);
      }
      throw err;
    }
  }

  /**
   * Download a GCS file to a local temp file using streaming.
   * Gets a signed URL via the storage API, then downloads the file content.
   *
   * @param gcsUrl - The GCS URL (gs:// or https://storage.googleapis.com/...) stored in the database
   * @param opts - Download options (timeout, validation, temp directory)
   * @returns Absolute path to the downloaded temp file
   */
  async downloadToFile(gcsUrl: string, opts?: DownloadOptions): Promise<string> {
    const signedUrl = await this.getSignedUrl(gcsUrl);
    const ext = extractExtension(gcsUrl);
    const tempDir = opts?.tempDir ?? os.tmpdir();
    const tempPath = path.join(tempDir, buildTempFileName(gcsUrl, ext, opts?.preserveName));

    const timeoutMs = opts?.timeoutMs ?? 60_000;
    const response = await fetchExternal(signedUrl, { redirect: 'follow' }, timeoutMs);

    if (!response.ok) {
      throw new StorageClientError('download', response.status, `HTTP ${response.status} downloading file`);
    }

    if (!response.body) {
      throw new StorageClientError('download', 0, 'Response body is null');
    }

    const fileStream = fs.createWriteStream(tempPath);
    try {
      await pipeline(Readable.fromWeb(response.body as any), fileStream);
    } catch (err) {
      // Clean up partial file on stream failure
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw err;
    }

    if (opts?.validate !== false) {
      validateFileContent(tempPath, ext);
    }

    return tempPath;
  }
}

/**
 * Error thrown when a storage operation fails.
 */
export class StorageClientError extends Error {
  constructor(
    public readonly operation: string,
    public readonly status: number,
    public readonly responseBody: string,
    /** Set when the file was refused. A refusal is permanent: don't retry. */
    public readonly code?: UploadRefusalCode,
  ) {
    super(`Storage ${operation} failed: ${status}`);
    this.name = 'StorageClientError';
  }
}

/**
 * Factory function to create a StorageClient instance.
 * @param serviceName - The calling service name for HMAC auth
 */
export function createStorageClient(serviceName: string): StorageClient {
  return new StorageClient({ serviceName });
}

/** A refusal decided before anything is sent. It looks the same as one from storage-api. */
function refusal(code: UploadRefusalCode): StorageClientError {
  const body = JSON.stringify({ success: false, code, message: UPLOAD_REFUSAL_MESSAGES[code] });
  return new StorageClientError('upload', UPLOAD_REFUSAL_STATUS, body, code);
}

function refusalCodeOf(status: number, responseBody: string): UploadRefusalCode | undefined {
  if (status !== UPLOAD_REFUSAL_STATUS) return undefined;
  try {
    const body: unknown = JSON.parse(responseBody);
    return isUploadRefusal(body) ? body.code : undefined;
  } catch {
    return undefined;
  }
}

function defaultPutTimeoutMs(size: number): number {
  return 60_000 + 2_000 * Math.ceil(size / (1024 * 1024));
}

/**
 * PUT bytes to a signed URL. Uses plain fetch, not fetchExternal, so the
 * signed URL never reaches the logs.
 */
async function putToSignedUrl(
  upload: SignedPut,
  content: Buffer | Uint8Array | string,
  size: number,
  timeoutMs: number,
): Promise<void> {
  // fetch can't know a stream's length, so state it; GCS needs it to check the signed size.
  const fromPath = typeof content === 'string';
  const init: RequestInit & { duplex?: 'half' } = {
    method: upload.method,
    headers: fromPath ? { ...upload.headers, 'Content-Length': String(size) } : upload.headers,
    body: fromPath
      ? (Readable.toWeb(fs.createReadStream(content)) as ReadableStream<Uint8Array>)
      : new Blob([content]),
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (fromPath) init.duplex = 'half';

  const response = await fetch(upload.url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new StorageClientError('upload', response.status, gcsErrorSummary(text));
  }
  await response.body?.cancel();
}

/** `<Code>` and `<Message>` from a GCS XML error, without the rest of the request it echoes. */
function gcsErrorSummary(xml: string): string {
  const code = /<Code>([^<]*)<\/Code>/.exec(xml)?.[1];
  const message = /<Message>([^<]*)<\/Message>/.exec(xml)?.[1];
  return [code, message].filter(Boolean).join(': ');
}

/**
 * Extract file extension from a GCS URL or path.
 * Falls back to '.pdf' when no extension can be determined.
 */
function extractExtension(gcsUrl: string): string {
  try {
    const pathname = new URL(gcsUrl).pathname;
    const ext = path.extname(pathname);
    return ext || '.pdf';
  } catch {
    const ext = path.extname(gcsUrl);
    return ext || '.pdf';
  }
}

/**
 * Derive the original friendly filename from a Bentham storage URL.
 *
 * Bentham storage objects are named `<timestamp>-<friendly_name>.<ext>`
 * (e.g. `.../documents/1789471578253-udyam_certificate.pdf`), so the friendly
 * name is the object basename with the leading `<timestamp>-` prefix removed.
 *
 * @param url - A Bentham storage URL (gs:// or https://...) or a bare path.
 * @returns The friendly filename, or `null` when none can be derived
 *   (empty basename, a bare extension like `.pdf`, or an unparseable input).
 *
 * @example
 * friendlyNameFromStorageUrl('gs://b/docs/1789471578253-udyam_certificate.pdf')
 *   // => 'udyam_certificate.pdf'
 * friendlyNameFromStorageUrl('gs://b/docs/.pdf') // => null
 */
export function friendlyNameFromStorageUrl(url: string): string | null {
  if (!url) return null;

  let basename: string;
  try {
    basename = path.posix.basename(new URL(url).pathname);
  } catch {
    basename = path.posix.basename(url);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(basename);
  } catch {
    decoded = basename;
  }

  // Strip a leading `<timestamp>-` prefix (Bentham storage naming convention).
  const stripped = decoded.replace(/^\d+-/, '');

  // Reject empty names and bare extensions (e.g. '.pdf' — no actual name).
  // A bare extension is a leading dot followed by a single extension segment
  // with nothing before it (path.parse('.pdf') => { name: '.pdf', ext: '' }).
  if (!stripped || /^\.[^.]*$/.test(stripped)) return null;

  return stripped;
}

/**
 * Build the temp file basename for a download. When `preserveName` is set and a
 * friendly name is derivable from the URL, uses it (preserving the validated
 * extension); otherwise falls back to the opaque `bentham_dl_<ts>_<hash><ext>`
 * name.
 */
function buildTempFileName(gcsUrl: string, ext: string, preserveName?: boolean): string {
  if (preserveName) {
    const friendly = friendlyNameFromStorageUrl(gcsUrl);
    if (friendly) {
      // Preserve the extension we validated against; strip any extension the
      // friendly name already carries so we don't double it up.
      return `${path.parse(friendly).name}${ext}`;
    }
  }
  return `bentham_dl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
}

/**
 * Validate downloaded file content. Rejects empty files, HTML error pages,
 * and invalid PDF headers.
 * @throws StorageClientError if validation fails
 */
export function validateFileContent(filePath: string, ext: string): void {
  const stat = fs.statSync(filePath);

  // Reject empty files
  if (stat.size === 0) {
    fs.unlinkSync(filePath);
    throw new StorageClientError('download', 0, 'Downloaded file is empty (0 bytes)');
  }

  // Read first 16 bytes for magic byte checks
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);

  const headerStr = header.toString('utf8', 0, Math.min(16, stat.size));

  // Reject HTML error pages (GCS returns HTML for 4xx/5xx when accessed as browser)
  if (headerStr.startsWith('<!DOCTYPE') || headerStr.startsWith('<html') || headerStr.startsWith('<HTML')) {
    fs.unlinkSync(filePath);
    throw new StorageClientError('download', 0, 'Downloaded file is an HTML error page');
  }

  // Validate PDF magic bytes when extension is .pdf
  if (ext.toLowerCase() === '.pdf' && !headerStr.startsWith('%PDF')) {
    fs.unlinkSync(filePath);
    throw new StorageClientError('download', 0, 'Downloaded file has invalid PDF header');
  }
}

/**
 * Download a GCS file to a temp path, execute a callback with the local path,
 * and clean up the temp file in `finally` regardless of success/failure.
 *
 * @example
 * ```ts
 * const result = await withTempDownload(storageClient, 'gs://bucket/doc.pdf', async (localPath) => {
 *   // use localPath...
 *   return processedData;
 * });
 * ```
 */
export async function withTempDownload<T>(
  client: StorageClient,
  gcsUrl: string,
  callback: (localPath: string) => Promise<T>,
  opts?: DownloadOptions,
): Promise<T> {
  const localPath = await client.downloadToFile(gcsUrl, opts);
  try {
    return await callback(localPath);
  } finally {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }
}

/**
 * Download multiple GCS files to temp paths, execute a callback with a record
 * of key→localPath mappings, and clean up all temp files in `finally`.
 *
 * @example
 * ```ts
 * const result = await withTempDownloads(storageClient, [
 *   { key: 'photo', url: 'gs://bucket/photo.jpg' },
 *   { key: 'signature', url: 'gs://bucket/sig.png' },
 * ], async (paths) => {
 *   // paths.photo, paths.signature are local file paths
 *   return processedData;
 * });
 * ```
 */
export async function withTempDownloads<T>(
  client: StorageClient,
  entries: Array<{ key: string; url: string }>,
  callback: (paths: Record<string, string>) => Promise<T>,
  opts?: DownloadOptions,
): Promise<T> {
  const paths: Record<string, string> = {};
  const downloadedPaths: string[] = [];

  try {
    // Use allSettled so all downloads resolve/reject before cleanup —
    // prevents orphaned temp files from in-flight downloads completing after
    // finally runs (race condition with Promise.all on partial failure)
    const settled = await Promise.allSettled(
      entries.map(async (entry) => {
        const localPath = await client.downloadToFile(entry.url, opts);
        downloadedPaths.push(localPath);
        return { key: entry.key, localPath };
      }),
    );

    const failed = settled.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failed.length > 0) {
      throw failed[0].reason;
    }

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        paths[result.value.key] = result.value.localPath;
      }
    }

    return await callback(paths);
  } finally {
    for (const p of downloadedPaths) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}
