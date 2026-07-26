## Changes Made

### 1. Restricted AI enrichment to latest NewsAPI rows
- **File:** `lib/news-ai-enrichment.ts`
- **Change:** Replaced the `source_name` selection with the existing `category` column, added `.eq('category', 'LATEST')`, and derived the publisher name from the article URL.
- **Why:** The production `news` table does not contain `source_name`, and official source-link rows must never enter the AI pipeline.
- **Revert:** Restore `source_name` in `PendingNewsArticle`, restore it in the select list, remove the `LATEST` filter, and pass `article.source_name` to `getNewsSourceName`.

### 2. Removed unsupported source metadata from latest-news writes
- **Files:** `app/api/fetch-news/route.ts`, `app/api/cron/fetch-news/route.ts`
- **Change:** Stopped writing `source_name`; latest rows continue to use `category: 'LATEST'`, `ai_status: 'pending'`, and AI enrichment fields.
- **Why:** Prevents Supabase errors against the current schema while preserving AI processing for NewsAPI content.
- **Revert:** Re-add `source_name` to the NewsAPI record payloads and cron upsert.

### 3. Kept official scraper rows source-link-only
- **File:** `app/api/scrape-official/route.ts`
- **Change:** Removed `ai_status: 'pending'`, removed the enrichment call, and returned a success message stating that only `LATEST` NewsAPI rows are AI-enriched.
- **Why:** Official scraped items are links to publishers and must remain untouched by the AI writer.
- **Revert:** Restore the pending status and `enrichPendingNews` call.

### 4. Prevented detail-page AI generation for official rows
- **File:** `app/news/[regionName]/[id]/page.tsx`
- **Change:** Derived source names from URLs, gated stored/generative AI work behind `category === 'LATEST'`, and rendered official rows as source-link-only content. Metadata now identifies official publisher links separately.
- **Why:** Direct access to an official article URL must not trigger OpenAI or persist AI columns.
- **Revert:** Restore `source_name` reads and unconditional `generateAiNewsArticle` execution.

### 5. Added regression coverage for category filtering
- **File:** `tests/news-ai-enrichment.test.ts`
- **Change:** Updated the Supabase mock for the current schema and added an assertion that enrichment requests `category = LATEST`.
- **Why:** Locks the official/latest separation into the permanent test suite.
- **Revert:** Remove the category-aware mock and filtering assertion.

## Verification
- `npm test` — passed, 8 tests.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `git diff --check` — passed; only line-ending normalization warnings were reported.

## Revert Status
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3
- [ ] Change 4
- [ ] Change 5
