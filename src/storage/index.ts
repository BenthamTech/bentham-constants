import { BaseServiceClient } from '../http';
import { serviceUrls } from '../config';

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
    const res = await this.post<{ data: { url: string } }>(
      '/api/v1/files/signed_url',
      { url: gcsUrl },
    );
    return res.data.url;
  }

  /**
   * Upload a file buffer to GCS via the storage API.
   * @param buffer - File contents as a Buffer or Uint8Array
   * @param fileName - Filename to store as (e.g. 'document.pdf')
   * @param folderPath - GCS folder path (e.g. 'applications/123/documents')
   * @returns The stored file's GCS URL
   */
  async uploadFile(buffer: Buffer | Uint8Array, fileName: string, folderPath: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', new Blob([buffer]), fileName);
    formData.append('folderPath', folderPath);

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
    await this.post('/api/v1/files/delete', { url: gcsUrl });
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
 * Factory function to create a StorageClient instance.
 * @param serviceName - The calling service name for HMAC auth
 */
export function createStorageClient(serviceName: string): StorageClient {
  return new StorageClient({ serviceName });
}
