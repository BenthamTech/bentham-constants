# bentham-constants

Language-agnostic constants shared across all Bentham services.

## Architecture

```
data/           ← JSON source of truth (language-agnostic)
ts/             ← npm package: @bentham/constants
go/             ← Go module: github.com/BenthamTech/bentham-constants/go
```

## Usage

### Node.js / TypeScript

```bash
npm install @bentham/constants
```

```ts
import { STATES, COMPANY_STATUSES, MCA_DEFAULTS } from '@bentham/constants';
```

### Go

```go
import constants "github.com/BenthamTech/bentham-constants/go"

states, _ := constants.States()
```

### Raw JSON (any language)

```bash
# Direct import from data/ directory
cat data/states.json
```

## Adding Constants

1. Add/edit the JSON file in `data/`
2. TS wrapper auto-imports via `resolveJsonModule`
3. Go wrapper uses `embed.FS` — no codegen needed
4. Tag a new version: `git tag v1.x.x && git push --tags`
