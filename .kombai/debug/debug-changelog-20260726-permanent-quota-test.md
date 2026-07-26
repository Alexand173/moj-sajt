## Changes Made

### 1. Added Vitest test tooling
- **Files:** `package.json`, `package-lock.json`
- **Change:** Added `vitest@^4.1.10` as a development dependency and added the `npm test` script (`vitest run`).
- **Why:** Provides a permanent automated test runner with deterministic module mocking for the OpenAI SDK.
- **Revert:** Remove the `vitest` dev dependency and the `test` script, then restore the lockfile.

### 2. Added Vitest configuration
- **File:** `vitest.config.ts`
- **Change:** Configured Node test execution, the existing `@/*` alias, and a focused `tests/**/*.test.ts` test pattern.
- **Why:** Keeps server-side AI tests isolated from browser APIs and avoids accidentally collecting temporary or unrelated files.
- **Revert:** Delete `vitest.config.ts`.

### 3. Added permanent OpenAI quota fallback test
- **File:** `tests/ai-news-fallback.test.ts`
- **Change:** Mocks the `openai` module and makes `responses.create` reject with a synthetic `429 insufficient_quota` error. It invokes the real `generateAiNewsArticle` fallback path with synthetic source material.
- **Assertions:** Verifies one provider call, `isAiGenerated: false`, `similarityCheckPassed: false`, `similarityScore: 0`, `retryCount: 0`, no source marker leakage, publisher attribution, and the safe non-reproduction message.
- **Why:** Prevents future changes from accidentally publishing scraped publisher prose when OpenAI quota is exhausted.
- **Revert:** Delete `tests/ai-news-fallback.test.ts`.

## Validation

- `npm test`: passed, 1 test passed
- `npx tsc --noEmit`: passed
- `npx eslint lib/ai-news.ts vitest.config.ts tests/ai-news-fallback.test.ts`: passed
- `npm run build`: passed
- The test does not make a network request; the OpenAI SDK is mocked entirely.

## Revert Status

- [ ] Change 1 - Vitest dependency and npm script
- [ ] Change 2 - Vitest configuration
- [ ] Change 3 - Permanent quota fallback test
