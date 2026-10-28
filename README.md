# bentham-constants

Shared constants and utilities for all Bentham services.

## Install

```bash
npm install @bentham/constants
```

## Constants

```ts
import { COMPANY_STATUSES, TRADEMARK_STATUSES, MCA_DEFAULTS } from '@bentham/constants';
```

## Logger

Structured JSON logging with automatic request context via AsyncLocalStorage.

### Setup (once per service)

```ts
import { requestContext } from '@bentham/constants/logger';

// Express
app.use(requestContext({
  service: 'bentham-mca-api',
  extractors: {
    userId: (req) => req.user?.id,
    applicationId: (req) => req.params.id,
  }
}));
```

### Usage (anywhere — no function signature changes)

```ts
import { logger, addContext } from '@bentham/constants/logger';

logger.info('Filing started');
logger.info({ applicationId: 'cmq3...' }, 'With extra context');
logger.error({ error: { message: 'fail', code: 'X' } }, 'Something broke');

// Enrich context mid-request
addContext({ applicationId: 'cmq3...' });
```

### Next.js API Routes

```ts
import { withRequestContext } from '@bentham/constants/logger';

const wrapped = withRequestContext({ service: 'bentham-app' });
export default wrapped(async (req, res) => { ... });
```

### Log Schema

| Field | Auto | Description |
|-------|------|-------------|
| `timestamp` | ✓ | ISO 8601 UTC |
| `level` | ✓ | debug/info/warn/error |
| `requestId` | ✓ | UUID from x-request-id or auto-generated |
| `service` | ✓ | From middleware config |
| `api` | ✓ | HTTP method + path |
| `msg` | ✓ | Log message |
| `userId` | extractor | User identifier |
| `applicationId` | manual | Business entity ID |
| `durationMs` | manual | Request duration |
| `error` | manual | `{ message, stack, code }` |

### Environment

- `LOG_LEVEL` — `debug`, `info` (default), `warn`, `error`
- Pretty output locally: `node app.js | npx pino-pretty`

## Architecture

```
data/           ← JSON constants (language-agnostic)
src/index.ts    ← constants exports
src/logger/     ← structured logging module
src/service-auth/ ← outbound HMAC auth factory
```

## Service Auth

Factory for outbound service-to-service HMAC authentication. Wraps `generateHmacHeaders` with env-var-based secret resolution.

### Env Keys

Shared HMAC env-var **key names** (not secrets) live in one place so a rename happens once, not at every call site:

```ts
import { HMAC_ENV_KEYS } from '@bentham/constants/env-keys';
import { createServiceAuth } from '@bentham/constants/service-auth';

const storageAuth = createServiceAuth(HMAC_ENV_KEYS.STORAGE, 'bentham-mca-api');
const notificationAuth = createServiceAuth(HMAC_ENV_KEYS.NOTIFICATION, 'bentham-mca-api');
```

Available: `STORAGE`, `NOTIFICATION`, `TRADEMARK`, `DOCUMENT_VALIDATOR`.

### Usage

```ts
import { createServiceAuth } from '@bentham/constants/service-auth';

// Create auth instances per target service
const storageAuth = createServiceAuth('BENTHAM_STORAGE_API_HMAC', 'bentham-mca-api');
const notificationAuth = createServiceAuth('BENTHAM_NOTIFICATION_API_HMAC', 'bentham-mca-api');

// Generate headers for a request
const headers = storageAuth('POST', '/api/v1/files/signed_url', { url: fileUrl });
// → { 'x-service-id': 'bentham-mca-api', 'x-timestamp': '...', 'x-signature': '...' }

// Use with fetch
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ url: fileUrl }),
});
```

### Parameters

| Param | Description |
|-------|-------------|
| `envVarName` | Name of the env var holding the HMAC shared secret |
| `serviceName` | Calling service identifier (sent as `x-service-id`) |

The returned function accepts `(method, path, body?)` where body can be a string or object (auto-serialized to JSON).

## Storage uploads

Every upload goes straight to GCS through a signed URL, so no request body passes through a service. storage-api runs the file checks and files the result.

1. `upload_url`: storage-api signs a PUT into `bentham_storage_uploads`, binding the exact size and the content type for the extension.
2. The caller PUTs the bytes to that URL with exactly the signed headers.
3. `promote` (after an optional `check`): storage-api checks the file against the caller's rules and copies it to `{folderPath}/{timestamp}-{fileName}` in the documents bucket.

From a service, `uploadFile` does all three:

```ts
import { StorageClient, StorageClientError } from '@bentham/constants/storage';
import { FileExtension } from '@bentham/constants/file-kinds';

const storage = new StorageClient({ serviceName: 'bentham-mca-api' });

// A Buffer, or a file path (streamed, so large files aren't held in memory).
const url = await storage.uploadFile('/tmp/artifacts.zip', 'artifacts.zip', `incorporation/${id}/artifacts`);

// Optional rules: accept defaults to the file's own extension, maxSize to SERVICE_MAX_UPLOAD_BYTES.
await storage.uploadFile(pdf, 'form.pdf', folder, { accept: [FileExtension.PDF], maxSize: 10 * 1024 * 1024 });
```

A `StorageClientError` with `code` set means the file was refused (`EMPTY`, `TOO_LARGE`, `TYPE_NOT_ALLOWED`, `CONTENT_MISMATCH` or `PASSWORD_PROTECTED_PDF`). Retrying won't help. Without `code`, the failure may be temporary.

| Subpath | Contents |
|---|---|
| `./storage` | `StorageClient` (`uploadFile`, `createUploadUrl`, `checkUpload`, `promoteUpload`, downloads, deletes) and everything in `./storage-contract` |
| `./storage-contract` | Limits, bucket, paths, refusal codes and messages, request and response types. No Node imports, so browser code can use it. |
| `./file-kinds` | `FileExtension` (use it instead of `'.pdf'` literals), `FILE_KINDS` with the content type for each, `accept` helpers (`acceptAllows`, `acceptLabel`, `toAcceptAttribute` for `<input accept>`) and the magic-byte check. No Node imports. |

The signed URL is a credential: don't log it.
