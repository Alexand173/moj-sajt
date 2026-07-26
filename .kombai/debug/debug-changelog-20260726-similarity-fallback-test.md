## Changes Made

### 1. Added a permanent similarity-validation fallback test
- **File:** `tests/ai-news-fallback.test.ts`
- **Change:** Added a test that mocks OpenAI with valid JSON whose `articleContent` is the complete supplied source article.
- **Assertions:** Verifies exactly two provider attempts, `isAiGenerated: false`, `similarityCheckPassed: false`, `retryCount: 2`, a similarity score greater than `0.9`, no source marker or model headline leakage, publisher attribution, and safe non-reproduction messaging.
- **Why:** Protects the originality gate from regressions that could publish source-copying AI output.
- **Revert:** Remove the similarity-validation test case from `tests/ai-news-fallback.test.ts`.

## Observed Similarity Metrics

The test logged the expected failed validation metrics on both attempts:

- Jaccard similarity: `0.9744`
- Longest consecutive sentence match: `5`
- Shared phrase ratio: `1`
- Validation result: `passed: false`

## Validation

- `npm test`: passed, 4 tests passed
- `npx tsc --noEmit`: passed
- `npx eslint tests/ai-news-fallback.test.ts vitest.config.ts lib/ai-news.ts`: passed
- `npm run build`: passed
- The test uses a mocked SDK response and makes no network request.

## Revert Status

- [ ] Change 1 - Permanent similarity-validation fallback test
