## Changes Made

### 1. Added a shared pending-news AI enrichment pipeline
- **File:** `lib/news-ai-enrichment.ts`
- **Change:** Added `enrichPendingNews()` to load a bounded batch of `news` rows whose `ai_status` is `NULL` or `pending`, call the existing OpenAI article generator, and persist `ai_content`, `ai_similarity_score`, `ai_generated`, and `ai_status`.
- **Status behavior:** Validated rewrites use `generated`; safe attribution fallbacks use `fallback`; rows remain `pending` when `OPENAI_API_KEY` is unavailable.
- **Budget protection:** Defaults to five rows per run and clamps `AI_NEWS_BATCH_SIZE` to a maximum of 20.
- **Reason:** The database columns were present, but no active ingestion path populated them.
- **Revert:** Delete `lib/news-ai-enrichment.ts` and remove its imports/calls from the affected routes and page.

### 2. Connected the active NewsAPI workflow to AI enrichment
- **File:** `app/api/fetch-news/route.ts`
- **Change:** New NewsAPI rows now receive `ai_status: 'pending'`; the route invokes `enrichPendingNews()` after upsert and includes the AI summary in its JSON response. Pending rows are also processed when no new NewsAPI rows are returned.
- **Reason:** `.github/workflows/update.yml` executes this route directly, so the previous AI cron route was bypassed.
- **Revert:** Remove the pending status field and enrichment calls/response metadata.

### 3. Persisted AI fields in the dedicated cron route
- **File:** `app/api/cron/fetch-news/route.ts`
- **Change:** Mapped the generated article result directly to `ai_content`, `ai_similarity_score`, `ai_generated`, and `ai_status`; also runs the shared pending-row processor.
- **Reason:** Keep direct cron/API execution consistent with the scheduled workflow.
- **Revert:** Remove the AI column mappings and shared enrichment call.

### 4. Enriched official scraper rows
- **File:** `app/api/scrape-official/route.ts`
- **Change:** Newly scraped rows are marked `pending`, then the scraper processes a bounded pending batch before returning. Duplicate URL upserts now use `ignoreDuplicates: true`.
- **Reason:** The same GitHub Actions job inserts official rows after the NewsAPI route and those rows also need AI column values.
- **Revert:** Remove `ai_status`, the enrichment call, and restore the previous duplicate-upsert behavior.

### 5. Reused persisted AI content on article pages
- **File:** `app/news/[regionName]/[id]/page.tsx`
- **Change:** Added the AI columns to the article record type. The detail page now renders stored `ai_content` instead of regenerating on every request; legacy rows are generated once and their AI fields are persisted.
- **Reason:** Prevent repeated OpenAI calls and ensure the database is populated when an article is opened directly.
- **Revert:** Remove the AI fields from the record type and restore request-time generation for every page request.

### 6. Passed OpenAI configuration to scheduled jobs
- **File:** `.github/workflows/update.yml`
- **Change:** Added `OPENAI_API_KEY` and `AI_NEWS_BATCH_SIZE: 5` to both news-processing steps.
- **Reason:** GitHub Actions does not automatically receive local `.env.local` values.
- **Revert:** Remove the two environment variables from both workflow steps.

### 7. Added persistence regression tests
- **File:** `tests/news-ai-enrichment.test.ts`
- **Change:** Added deterministic tests for generated-status mapping, persistence of all four AI columns, and leaving rows pending when the OpenAI key is missing.
- **Reason:** Prevent the AI result from being generated successfully but lost before the Supabase update.
- **Revert:** Delete `tests/news-ai-enrichment.test.ts`.

## Validation

- `npm test`: passed, 7 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Focused ESLint on changed AI files: passed with one pre-existing `no-img-element` warning in the article page.
- Full `npm run lint`: blocked by existing lint errors in `app/api/scrape-official/route.ts` and generated `.next` output exhausting Node memory; those errors are unrelated to the AI persistence implementation.
- No live NewsAPI/OpenAI sync was executed automatically, so no additional API credits were spent during validation.

## Revert Status

- [ ] Change 1 - Shared AI enrichment pipeline
- [ ] Change 2 - Active NewsAPI route integration
- [ ] Change 3 - Dedicated cron route integration
- [ ] Change 4 - Official scraper integration
- [ ] Change 5 - Persisted article-page rendering
- [ ] Change 6 - Scheduled-job environment variables
- [ ] Change 7 - Regression tests
