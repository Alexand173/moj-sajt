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

### Phase 1 — measure recovery (cheap, do first)

`resolveNewsSource` already searches NewsAPI by exact headline when no URL is
stored, and returns a match only on an exact title comparison. Run that over a
sample of 20 pending rows, with the existing key, and count hits:

- **Hit rate ≥ 40%** → Phase 2a.
- **Hit rate lower** → Phase 2b.

Deliverable: `npm run news:recover-urls --sample=20` printing hit rate, plus the
matched publishers, without writing anything. NewsAPI's free tier is 100
requests/day, so the sample size is chosen to leave room for ingestion.

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
