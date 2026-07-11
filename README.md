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
