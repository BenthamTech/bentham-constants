import { BaseServiceClient } from '../http';
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
export declare class StorageClient extends BaseServiceClient {
    constructor(opts: StorageClientOptions);
    /**
     * Get a signed download URL for a GCS file.
     * @param gcsUrl - The GCS URL (gs:// or https://storage.googleapis.com/...) stored in the database
     * @returns Signed download URL (valid for ~15 minutes)
     */
    getSignedUrl(gcsUrl: string): Promise<string>;
    /**
     * Upload a file buffer to GCS via the storage API.
     * @param buffer - File contents as a Buffer or Uint8Array
     * @param fileName - Filename to store as (e.g. 'document.pdf')
     * @param folderPath - GCS folder path (e.g. 'applications/123/documents')
     * @param contentType - MIME type (e.g. 'application/pdf'). If omitted, inferred from fileName extension.
     * @returns The stored file's GCS URL
     */
    uploadFile(buffer: Buffer | Uint8Array, fileName: string, folderPath: string, contentType?: string): Promise<string>;
    /**
     * Delete a file from GCS.
     * @param gcsUrl - The GCS URL of the file to delete
     */
    deleteFile(gcsUrl: string): Promise<void>;
    /**
     * Download a GCS file to a local temp file using streaming.
     * Gets a signed URL via the storage API, then downloads the file content.
     *
     * @param gcsUrl - The GCS URL (gs:// or https://storage.googleapis.com/...) stored in the database
     * @param opts - Download options (timeout, validation, temp directory)
     * @returns Absolute path to the downloaded temp file
     */
    downloadToFile(gcsUrl: string, opts?: DownloadOptions): Promise<string>;
}
/**
 * Error thrown when a storage operation fails.
 */
export declare class StorageClientError extends Error {
    readonly operation: string;
    readonly status: number;
    readonly responseBody: string;
    constructor(operation: string, status: number, responseBody: string);
}
/**
 * Factory function to create a StorageClient instance.
 * @param serviceName - The calling service name for HMAC auth
 */
export declare function createStorageClient(serviceName: string): StorageClient;
/**
 * Validate downloaded file content. Rejects empty files, HTML error pages,
 * and invalid PDF headers.
 * @throws StorageClientError if validation fails
 */
export declare function validateFileContent(filePath: string, ext: string): void;
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
export declare function withTempDownload<T>(client: StorageClient, gcsUrl: string, callback: (localPath: string) => Promise<T>, opts?: DownloadOptions): Promise<T>;
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
export declare function withTempDownloads<T>(client: StorageClient, entries: Array<{
    key: string;
    url: string;
}>, callback: (paths: Record<string, string>) => Promise<T>, opts?: DownloadOptions): Promise<T>;
