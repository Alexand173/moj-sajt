## Changes Made

### 1. Added the official OpenAI SDK import
- **File:** `lib/ai-news.ts`
- **Change:** Added `OpenAI` from the installed `openai` package.
- **Reason:** Use the official TypeScript/JavaScript SDK in the server-side provider path.
- **Revert:** Remove the `OpenAI` import.

### 2. Migrated OpenAI generation to the Responses API
- **File:** `lib/ai-news.ts`
- **Change:** Replaced the raw `fetch('https://api.openai.com/v1/chat/completions')` implementation with `client.responses.create()`.
- **Configuration:** Uses `OPENAI_API_KEY`, `OPENAI_MODEL` or `gpt-4.1-mini`, `instructions`, `input`, `temperature`, `max_output_tokens`, and JSON output formatting.
- **Safety:** Preserved the existing request timeout, disabled SDK retries to stay within the application retry budget, validates non-empty output, and enforces the existing model response character limit.
- **Revert:** Restore the previous raw Chat Completions fetch adapter.

### 3. Installed the OpenAI SDK dependency
- **Files:** `package.json`, `package-lock.json`
- **Change:** Added `openai` version `^6.49.0`.
- **Reason:** Required for the official Responses API integration.
- **Revert:** Remove the `openai` dependency using the package manager and restore the lockfile.

## Validation

- `npx tsc --noEmit`: passed
- `npx eslint lib/ai-news.ts`: passed
- `npm run build`: passed
- Official SDK live request: reached OpenAI and returned the sanitized, classified response:
  - HTTP status: `429`
  - Error type/code: `insufficient_quota`
  - Meaning: the API project has no available quota/credits; this is not an SDK or model-format error.

## Revert Status

- [ ] Change 1 - SDK import
- [ ] Change 2 - Responses API adapter
- [ ] Change 3 - OpenAI SDK dependency
