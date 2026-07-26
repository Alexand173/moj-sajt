## Changes Made

### 1. Added a permanent malformed AI-response fallback test
- **File:** `tests/ai-news-fallback.test.ts`
- **Change:** Added a test that mocks `openai.responses.create()` to return non-JSON text: `This is not valid JSON from the model.`.
- **Assertions:** Verifies exactly two provider attempts, `isAiGenerated: false`, `similarityCheckPassed: false`, `similarityScore: 0`, `retryCount: 2`, no source marker leakage, no malformed model text leakage, publisher attribution, and the safe non-reproduction message.
- **Why:** Protects the retry-then-fallback behavior when OpenAI returns malformed output instead of the requested JSON object.
- **Revert:** Remove the malformed-response test case from `tests/ai-news-fallback.test.ts`.

## Validation

- `npm test`: passed, 3 tests passed
- `npx tsc --noEmit`: passed
- `npx eslint tests/ai-news-fallback.test.ts vitest.config.ts lib/ai-news.ts`: passed
- `npm run build`: passed
- The malformed-response test uses a mocked SDK response and makes no network request.

## Revert Status

- [ ] Change 1 - Permanent malformed AI-response fallback test
