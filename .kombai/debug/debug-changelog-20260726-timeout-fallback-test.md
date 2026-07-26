## Changes Made

### 1. Added a permanent OpenAI timeout fallback test
- **File:** `tests/ai-news-fallback.test.ts`
- **Change:** Added a test that mocks `openai.responses.create()` to reject with `OpenAI request timed out after 20000ms.`.
- **Assertions:** Verifies exactly two provider attempts, `isAiGenerated: false`, `similarityCheckPassed: false`, `similarityScore: 0`, `retryCount: 2`, no source marker leakage, publisher attribution, and the safe non-reproduction message.
- **Why:** Protects the existing retry-then-fallback behavior for transient OpenAI timeout failures.
- **Revert:** Remove the timeout test case from `tests/ai-news-fallback.test.ts`.

## Validation

- `npm test`: passed, 2 tests passed
- `npx tsc --noEmit`: passed
- `npx eslint tests/ai-news-fallback.test.ts vitest.config.ts lib/ai-news.ts`: passed
- `npm run build`: passed
- The timeout test uses a mocked SDK rejection and makes no network request.

## Revert Status

- [ ] Change 1 - Permanent OpenAI timeout fallback test
