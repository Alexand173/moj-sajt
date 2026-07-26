## Changes Made

### 1. Added OpenAI as the default provider
- **File:** `lib/ai-news.ts`
- **Change:** Added `AI_PROVIDER` selection with `openai` as the default, `OPENAI_API_KEY` for authentication, `OPENAI_MODEL` override, and `gpt-4.1-mini` as the default OpenAI model.
- **Reason:** Allow article generation to continue while the Gemini project quota is unavailable.
- **Revert:** Restore Gemini as the sole provider and remove the OpenAI provider constants and environment-variable selection.

### 2. Added an OpenAI Chat Completions adapter
- **File:** `lib/ai-news.ts`
- **Change:** Added `generateWithOpenAi()` using the OpenAI HTTPS Chat Completions API with request timeout, bounded response reading, JSON response mode, structured error handling, and no API-key logging.
- **Reason:** No OpenAI SDK was installed, so direct HTTPS avoids an unnecessary dependency change.
- **Revert:** Remove `generateWithOpenAi()` and restore the previous Gemini model generation function.

### 3. Preserved Gemini as an explicit opt-in provider
- **File:** `lib/ai-news.ts`
- **Change:** Gemini remains available only when `AI_PROVIDER=gemini`; the obsolete `gemini-2.5-flash-lite` fallback was removed from the active model chain.
- **Reason:** Flash-Lite returned HTTP 404 for this API key and Flash returned HTTP 429 quota exhaustion.
- **Revert:** Restore the previous Gemini default/fallback model chain if Gemini is re-enabled as the primary provider.

### 4. Generalized provider quota fallback logging
- **File:** `lib/ai-news.ts`
- **Change:** Renamed the quota detector to `isProviderQuotaError()` and included the active provider in the fallback event.
- **Reason:** Keep safe attribution fallback behavior consistent across OpenAI and Gemini.
- **Revert:** Restore the Gemini-specific quota detector and log event fields.

## Validation

- `npx tsc --noEmit`: passed
- `npm run build`: passed
- `npx eslint lib/ai-news.ts`: passed
- `npm run lint`: did not complete because ESLint traversed generated `.next` output and Node ran out of memory; this is unrelated to the provider adapter.
- Isolated OpenAI provider check: not executed against the network because `OPENAI_API_KEY` is not configured in `.env.local`.

## Revert Status

- [ ] Change 1 - OpenAI default provider
- [ ] Change 2 - OpenAI adapter
- [ ] Change 3 - Gemini opt-in behavior
- [ ] Change 4 - Generalized quota fallback logging
