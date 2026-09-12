"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageClientError = exports.StorageClient = void 0;
exports.createStorageClient = createStorageClient;
exports.validateFileContent = validateFileContent;
exports.withTempDownload = withTempDownload;
exports.withTempDownloads = withTempDownloads;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_stream_1 = require("node:stream");
const promises_1 = require("node:stream/promises");
const crypto = __importStar(require("node:crypto"));
const http_1 = require("../http");
const config_1 = require("../config");
const fetch_1 = require("../fetch");
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
class StorageClient extends http_1.BaseServiceClient {
    constructor(opts) {
        super({
            baseUrl: opts.baseUrl ?? config_1.serviceUrls.storage,
            auth: {
                secretEnvVar: opts.secretEnvVar ?? 'BENTHAM_STORAGE_API_HMAC',
                serviceName: opts.serviceName,
            },
            timeout: opts.timeout ?? 30000,
        });
    }
    /**
     * Get a signed download URL for a GCS file.
     * @param gcsUrl - The GCS URL (gs:// or https://storage.googleapis.com/...) stored in the database
     * @returns Signed download URL (valid for ~15 minutes)
     */
    async getSignedUrl(gcsUrl) {
        try {
            const res = await this.post('/api/v1/files/signed_url', { url: gcsUrl });
            return res.data.url;
        }
        catch (err) {
            if (err instanceof http_1.ServiceClientError) {
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
    async uploadFile(buffer, fileName, folderPath, contentType) {
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
        const json = await response.json();
        return json.data.url;
    }
    /**
     * Delete a file from GCS.
     * @param gcsUrl - The GCS URL of the file to delete
     */
    async deleteFile(gcsUrl) {
        try {
            await this.post('/api/v1/files/delete', { url: gcsUrl });
        }
        catch (err) {
            if (err instanceof http_1.ServiceClientError) {
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
    async downloadToFile(gcsUrl, opts) {
        const signedUrl = await this.getSignedUrl(gcsUrl);
        const ext = extractExtension(gcsUrl);
        const tempDir = opts?.tempDir ?? os.tmpdir();
        const tempPath = path.join(tempDir, `bentham_dl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
        const timeoutMs = opts?.timeoutMs ?? 60000;
        const response = await (0, fetch_1.fetchExternal)(signedUrl, { redirect: 'follow' }, timeoutMs);
        if (!response.ok) {
            throw new StorageClientError('download', response.status, `HTTP ${response.status} downloading file`);
        }
        if (!response.body) {
            throw new StorageClientError('download', 0, 'Response body is null');
        }
        const fileStream = fs.createWriteStream(tempPath);
        try {
            await (0, promises_1.pipeline)(node_stream_1.Readable.fromWeb(response.body), fileStream);
        }
        catch (err) {
            // Clean up partial file on stream failure
            if (fs.existsSync(tempPath))
                fs.unlinkSync(tempPath);
            throw err;
        }
        if (opts?.validate !== false) {
            validateFileContent(tempPath, ext);
        }
        return tempPath;
    }
}
exports.StorageClient = StorageClient;
/**
 * Error thrown when a storage operation fails.
 */
class StorageClientError extends Error {
    constructor(operation, status, responseBody) {
        super(`Storage ${operation} failed: ${status}`);
        this.operation = operation;
        this.status = status;
        this.responseBody = responseBody;
        this.name = 'StorageClientError';
    }
}
exports.StorageClientError = StorageClientError;
/**
 * Factory function to create a StorageClient instance.
 * @param serviceName - The calling service name for HMAC auth
 */
function createStorageClient(serviceName) {
    return new StorageClient({ serviceName });
}
/**
 * MIME type lookup table -- hoisted to module scope to avoid re-allocation per call.
 */
const MIME_MAP = {
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
function inferMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return (ext && MIME_MAP[ext]) || 'application/octet-stream';
}
/**
 * Extract file extension from a GCS URL or path.
 * Falls back to '.pdf' when no extension can be determined.
 */
function extractExtension(gcsUrl) {
    try {
        const pathname = new URL(gcsUrl).pathname;
        const ext = path.extname(pathname);
        return ext || '.pdf';
    }
    catch {
        const ext = path.extname(gcsUrl);
        return ext || '.pdf';
    }
}
/**
 * Validate downloaded file content. Rejects empty files, HTML error pages,
 * and invalid PDF headers.
 * @throws StorageClientError if validation fails
 */
function validateFileContent(filePath, ext) {
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
async function withTempDownload(client, gcsUrl, callback, opts) {
    const localPath = await client.downloadToFile(gcsUrl, opts);
    try {
        return await callback(localPath);
    }
    finally {
        if (fs.existsSync(localPath))
            fs.unlinkSync(localPath);
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
async function withTempDownloads(client, entries, callback, opts) {
    const paths = {};
    const downloadedPaths = [];
    try {
        // Use allSettled so all downloads resolve/reject before cleanup —
        // prevents orphaned temp files from in-flight downloads completing after
        // finally runs (race condition with Promise.all on partial failure)
        const settled = await Promise.allSettled(entries.map(async (entry) => {
            const localPath = await client.downloadToFile(entry.url, opts);
            downloadedPaths.push(localPath);
            return { key: entry.key, localPath };
        }));
        const failed = settled.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
            throw failed[0].reason;
        }
        for (const result of settled) {
            if (result.status === 'fulfilled') {
                paths[result.value.key] = result.value.localPath;
            }
        }
        return await callback(paths);
    }
    finally {
        for (const p of downloadedPaths) {
            if (fs.existsSync(p))
                fs.unlinkSync(p);
        }
    }
}
