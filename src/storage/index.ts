import { BaseServiceClient, ServiceClientError } from '../http';
import { serviceUrls } from '../config';
import { fetchExternal } from '../fetch';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

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

export interface DownloadOptions {
  /** Request timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Validate file content after download (default: true) */
  validate?: boolean;
  /** Custom temp directory (default: os.tmpdir()) */
  tempDir?: string;
}

/**
 * Pre-built HMAC-authenticated client for bentham-storage-api.
 * Provides typed methods for all storage operations: getSignedUrl, uploadFile, deleteFile.
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
        secretEnvVar: opts.secretEnvVar ?? 'BENTHAM_STORAGE_API_HMAC',
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
   * Upload a file buffer to GCS via the storage API.
   * @param buffer - File contents as a Buffer or Uint8Array
   * @param fileName - Filename to store as (e.g. 'document.pdf')
   * @param folderPath - GCS folder path (e.g. 'applications/123/documents')
   * @param contentType - MIME type (e.g. 'application/pdf'). If omitted, inferred from fileName extension.
   * @returns The stored file's GCS URL
   */
  async uploadFile(buffer: Buffer | Uint8Array, fileName: string, folderPath: string, contentType?: string): Promise<string> {
    const mime = contentType || inferMimeType(fileName);
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mime }), fileName);
    formData.append('folderPath', folderPath);
    formData.append('fileName', fileName);

    const hmacBody = JSON.stringify({ folderPath, fileName });
    const response = await this.requestRaw('POST', '/api/v1/files/store', formData, hmacBody);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new StorageClientError('upload', response.status, errorBody);
    }

    const json = await response.json() as { data: { url: string } };
    return json.data.url;
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
   * Download a GCS file to a temporary local file via signed URL.
   * The caller is responsible for deleting the temp file when done —
   * prefer `withTempDownload()` for automatic cleanup.
   *
   * @param gcsUrl - The GCS URL (gs:// or https://storage.googleapis.com/...) to download
   * @param opts - Download options (timeout, validation, temp directory)
   * @returns Absolute path to the downloaded temp file
   */
  async downloadToFile(gcsUrl: string, opts?: DownloadOptions): Promise<string> {
    const signedUrl = await this.getSignedUrl(gcsUrl);
    const ext = path.extname(new URL(gcsUrl.replace('gs://', 'https://')).pathname) || '.pdf';
    const suffix = crypto.randomBytes(8).toString('hex');
    const tempDir = opts?.tempDir ?? os.tmpdir();
    const tempPath = path.join(tempDir, `bentham_dl_${Date.now()}_${suffix}${ext}`);

    const response = await fetchExternal(signedUrl, { redirect: 'follow' }, opts?.timeoutMs ?? 60_000);
    if (!response.ok) {
      throw new StorageClientError('download', response.status, '');
    }

    const body = response.body;
    if (!body) {
      throw new StorageClientError('download', 0, 'Response body is null');
    }

    const fileStream = fs.createWriteStream(tempPath);
    try {
      await pipeline(Readable.fromWeb(body as any), fileStream);
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
  ) {
    super(`Storage ${operation} failed: ${status}`);
    this.name = 'StorageClientError';
  }
}

/**
 * Validate downloaded file content. Rejects:
 * - Empty files (0 bytes)
 * - HTML error pages (starts with <!DOCTYPE or <html)
 * - Invalid PDF headers when extension is .pdf (must start with %PDF-)
 *
 * @throws StorageClientError if validation fails
 */
function validateFileContent(filePath: string, ext: string): void {
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    fs.unlinkSync(filePath);
    throw new StorageClientError('download', 0, 'Downloaded file is empty (0 bytes)');
  }

  // Read first 16 bytes for magic byte checking
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);

  const headerStr = header.toString('utf8').trim();

  // Reject HTML error pages
  if (headerStr.startsWith('<!DOCTYPE') || headerStr.startsWith('<html') || headerStr.startsWith('<HTML')) {
    fs.unlinkSync(filePath);
    throw new StorageClientError('download', 0, 'Downloaded file is an HTML error page');
  }

  // Validate PDF magic bytes
  if (ext.toLowerCase() === '.pdf' && !headerStr.startsWith('%PDF-')) {
    fs.unlinkSync(filePath);
    throw new StorageClientError('download', 0, 'Downloaded file has invalid PDF header');
  }
}

/**
 * Download a GCS file to a temp location, run a callback with the local path,
 * and automatically clean up the temp file in `finally` regardless of success/failure.
 *
 * @example
 * ```ts
 * const text = await withTempDownload(storageClient, 'gs://bucket/doc.pdf', async (localPath) => {
 *   return fs.readFileSync(localPath, 'utf8');
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
 * Download multiple GCS files to temp locations, run a callback with a map of key→localPath,
 * and automatically clean up all temp files in `finally`.
 *
 * @example
 * ```ts
 * const result = await withTempDownloads(storageClient, [
 *   { key: 'pan', url: 'gs://bucket/pan.pdf' },
 *   { key: 'aadhar', url: 'gs://bucket/aadhar.pdf' },
 * ], async (paths) => {
 *   // paths.pan → '/tmp/bentham_dl_..._abc.pdf'
 *   // paths.aadhar → '/tmp/bentham_dl_..._def.pdf'
 *   return processBoth(paths.pan, paths.aadhar);
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
  try {
    // Download all files in parallel
    const results = await Promise.all(
      entries.map(async (entry) => ({
        key: entry.key,
        path: await client.downloadToFile(entry.url, opts),
      })),
    );
    for (const { key, path: localPath } of results) {
      paths[key] = localPath;
    }
    return await callback(paths);
  } finally {
    for (const localPath of Object.values(paths)) {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  }
}

/**
 * Factory function to create a StorageClient instance.
 * @param serviceName - The calling service name for HMAC auth
 */
export function createStorageClient(serviceName: string): StorageClient {
  return new StorageClient({ serviceName });
}

/**
 * MIME type lookup table -- hoisted to module scope to avoid re-allocation per call.
 */
const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
};

/**
 * Infer MIME type from file extension. Falls back to application/octet-stream.
 */
function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return (ext && MIME_MAP[ext]) || 'application/octet-stream';
}
