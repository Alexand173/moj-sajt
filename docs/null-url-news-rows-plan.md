# The 10,547 rows with no source URL

Written 2026-11-10, from a profile of the whole cohort. The number is large enough
to look like an active bug and small enough to be unglamorous: it is a closed
historical cohort with no way to publish responsibly until it is resolved.

## What the cohort actually is

| Measurement | Value |
|---|---|
| Rows with `url` null | **10,547** (30% of 34,779) |
| Created | **March–July 2026**, none after July |
| `content` length | 10,420 at 200–800 chars, 126 under 200, **0 full articles** |
| Status | 9,313 `pending`, 985 `generated`, 249 `skipped` |

Three things follow:

1. **Nothing is still being written.** The most recent is July 2026. The current
   ingest path stores a URL for every row, so this is a retired pipeline's output
   — the plan is about cleaning up a cohort, not about stopping a leak.
2. **The bodies are NewsAPI's truncated `content` field** (the "… [+8600 chars]"
   kind), never a full article. That is why the 400-word floor cannot be met from
   them, and why they fell back en masse.
3. **9,313 are `pending` but never process.** They are older than the 21-day
   worker window, so they are inert: no AI spend, no churn. The 985 `generated`
   rows are published with **no source link**, which is the part that needs a
   decision now rather than later.

## Why the URL is missing

`fetch-news` writes `url: art.url || null`. In the retired path the URL was not
required, so a row could be stored with a headline, a truncated body and no
publisher — which also means no attribution, no source link, no canonical address,
and no way to fetch the article to rewrite it honestly.

## Options, with the cost of each

```
                    rows       cost            risk
leave as-is         10,547     none           985 are published with no source
stamp skipped       9,313      one script      hides any that could be recovered
recover the URL     ?          NewsAPI quota   needs a measured hit rate first
```

### Phase 1 — measured: recovery through NewsAPI is impossible (done 2026-11-10)

`npm run news:recover-urls -- --sample=20`, run against the 985 published rows,
spread across the whole cohort rather than its head:

```
candidates 985 · sample 20 · requests 20 · hits 0 · misses 20 · errors 0
hitRate 0.000   projectedRecoverable 0
```

Zero hits is not "the headline matching is too strict". Two probes against the
same key with the same parameters:

| Query | HTTP | `totalResults` |
|---|---|---|
| `"music"` (recent) | 200 | **1,489** |
| `"Germany Top 100 Single Charts"` (cohort) | 200 | **0** |
| `"Shakira FIFA World Cup 2026 anthem"` (cohort) | 200 | **0** |

The key works and the endpoint answers. **NewsAPI's Developer plan only searches
the last month of articles**, and this cohort is four to eight months old — the
API does not hold these stories at all. Recalling the headlines is not possible
at any hit rate, so no further quota should be spent on this route.

Consequence: Phase 2a (NewsAPI backfill) is dead. `news:recover-urls` still earns
its place as a guard — it will recover a URL for any *recent* URL-less row, which
is the only kind a regression can create now — and its `--scope=pending` run
would also return zero for this cohort.

The remaining options for the 985 published rows are the ones that do not depend
on NewsAPI's archive: web search (Brave/Bing/Serper have no one-month limit, at a
cost per query), or an editorial decision that a source-less row is not
publishable.

### Phase 2a — backfill the URLs

Only for rows the search resolves, and only when the matched title is an exact
match on a normalised string (the existing rule). Writes `url` and `content` when
the fetch returns a body, then leaves the row `pending` so it enters the queue
normally. Batched, dry-run first, with the same `--apply` convention as the other
scripts.

### Phase 2b — mark them unpublishable without deleting them

If recovery fails, the honest state is "no source": a row that cannot be
attributed should not be published. `npm run news:skip-sourceless
-- --include-pending` is *not* the tool — it was tried and reverted, because
10,547 rows include legitimate music stories whose bodies came from the feed. The
`content` length is the discriminator: **under 800 characters cannot be a rewrite
of anything**, so those rows are stamped `skipped` and stay auditable.

### Phase 3 — the 985 published rows

These are live pages with no source link. In order of preference:

1. Attempt recovery (Phase 2a) for just this subset — 985 is a small NewsAPI bill.
2. If not recovered, keep the brief but ensure the page says the source is
   unavailable and that the page is `noindex` (`lib/news-indexability.ts` already
   requires a validated rewrite before indexing, so this is a matter of confirming
   the flag on these rows).
3. Never delete: the headline is the only provenance they have left.

### Phase 4 — keep the cohort from regrowing

Two guards, one of which is already true:

- **Ingest:** a row must have a URL. `fetch-news` already writes one for every
  NewsAPI article; add an assertion in the upsert path that logs and drops a
  URL-less row rather than storing it.
- **Observability:** add `url: null` to the weekly source report so a regression
  shows up in a number instead of in a purge report months later.

## Acceptance criteria

- A measured recovery hit rate on a 20-row sample, recorded in this document.
- Every one of the 10,547 rows ends in a decided state: URL recovered, or
  `skipped` with the reason recorded, or published with an explicit
  source-unavailable treatment.
- No row in the cohort is `pending` and older than the window at the end.
- Ingest refuses a URL-less row.

## Outcome (2026-11-10) — the cohort was deleted, and the rule shipped as a guard

While Phase 3 was being verified, the rows disappeared from the table:

```
rows before   34,779
rows after    24,232      (difference 10,547 — the whole cohort)
url is null        0
url = ''           0
url not http%      0
```

Nothing in this repository deletes from `news`: the only `.delete()` calls are
against `songs` in `update-views.mjs`. The deletion was external to this session,
so the plan's premise — 985 pages to fix — no longer describes the database. The
work was kept anyway, because the condition it guards is one a regression can
recreate in a single ingest run.

What shipped, and why it still matters:

- `lib/news-publication.ts`: `hasRecordedSource` (a row must name its publisher)
  and `isIndexedNewsArticle` (that, plus a validated rewrite). Derived from the row
  — no flag, no migration, nothing to drift.
- The article page returns **404** for a source-less row, checked before the
  canonical redirect.
- Region feeds, `sitemap.xml`, related stories, the reviews page and the
  `official-content` API all refuse such a row, matching the page exactly.
- Related stories had **no publication filter at all** before this: a sidebar could
  link to a `skipped` row, or to one whose page now 404s. Both candidate queries are
  gated now.

One regression was caught by the smoke test rather than by the tests: adding the
source requirement to the sitemap made it list **zero** articles, because
`sitemap.ts` never selected the `url` column and a missing column reads as "no
source" for every row. The column is selected now; the sitemap went 0 → 9,553
article URLs, and sampled entries return 200.

## Risks

- **NewsAPI quota.** 100 requests/day on the free tier; a 10,547-row recovery is
  ~105 days at that rate. Recover the 985 published rows first; the pending cohort
  is inert and can wait.
- **Wrong matches.** Exact-title matching is strict for a reason: a fuzzy match
  attaches the wrong publisher, which is worse than no source. Keep it strict and
  accept a lower hit rate.
- **Losing music.** The 9,313 pending rows contain real stories (Charli XCX,
  Eminem, Teddy Swims in the sample). Whatever is stamped must be reversible, and
  `content` length is the only discriminator worth trusting.
