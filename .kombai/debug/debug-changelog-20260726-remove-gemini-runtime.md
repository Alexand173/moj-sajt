## Changes Made

### 1. Removed the Gemini runtime import and provider selection
- **File:** `lib/ai-news.ts`
- **Change:** Removed the `GoogleGenerativeAI` import, Gemini model constant, `AI_PROVIDER` environment switch, and Gemini-specific API key/model selection.
- **Why:** OpenAI is now the only supported article-generation provider at runtime.
- **Revert:** Restore the Gemini import, model constant, `AI_PROVIDER` configuration, and provider-specific key/model selection.

### 2. Kept OpenAI as the only generation path
- **File:** `lib/ai-news.ts`
- **Change:** `generateAiNewsArticle` now reads only `OPENAI_API_KEY` and `OPENAI_MODEL` and always calls the official OpenAI Responses SDK adapter. The provider timeout and quota log now identify OpenAI directly.
- **Why:** Prevents an environment value such as `AI_PROVIDER=gemini` from routing requests to an unsupported provider.
- **Revert:** Restore the provider branching and Gemini generation branch.

### 3. Updated provider documentation comment
- **File:** `lib/ai-news.ts`
- **Change:** Changed the source-material comment from Gemini to OpenAI.
- **Why:** Keeps runtime source documentation accurate.
- **Revert:** Restore the previous comment text.

## Intentionally Unchanged

- `@google/generative-ai` remains in `package.json` and `package-lock.json` because the approved scope was to remove only runtime provider code, not dependency/config cleanup.
- Any existing Gemini environment variables can remain configured, but they are no longer read by the application.

## Validation

- `npx tsc --noEmit`: passed
- `npx eslint lib/ai-news.ts app/api/cron/fetch-news/route.ts`: passed
- `npm run build`: passed
- Runtime scan of `lib/`, `app/`, and `components/`: no Gemini references found

## Revert Status

- [ ] Change 1 - Removed Gemini runtime import/provider selection
- [ ] Change 2 - OpenAI-only generation path
- [ ] Change 3 - Updated provider documentation comment
