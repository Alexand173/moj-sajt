# Publisher source retrieval: failures and strategy

Written 2026-11-10 after measuring the two failing hosts during a live ingest run.
The goal is to turn "the rewrite fell back" into either a brief or a deliberate,
logged decision, and to stop one dead host from spending the run's budget.

## What was measured

`npm run news:source-fetch -- <url…>` probes a URL with the production bot
User-Agent, a 2,000,000-byte cap and a 15 s timeout, and reports status, bytes
read, wall time and readable words.

| Host | Status | Bytes read | Time | Outcome |
|---|---|---|---|---|
| npr.org (article) | — | **0** | **15,011 ms** | `TimeoutError`, nothing received |
| decider.com (article) | 200 | **2,015,232** (capped) | **214 ms** | killed by the byte cap |
| pitchfork.com (section) | 200 | 1,966,234 | 262 ms | just under the cap |

Two different failures that the current code treats as one:

1. **NPR stalls.** Not slow transfer — zero bytes in fifteen seconds. External
   scans report Akamai in front of npr.org, so an edge bot decision holding the
   response open is the likely cause. Raising the timeout does not fix a stall;
   it only buys a longer one, twice, because the retry re-runs it.
2. **Decider is large.** The body arrives in 214 ms and the cap aborts a read that
   had already succeeded in fetching the page. Sampled Decider articles carry
   ~1.6 MB of inline player scripts, so multi-megabyte HTML is expected there.
   Pitchfork at 1.97 MB shows the 2 MB cap is marginal for ordinary music sites,
   not just for outliers.

Consequence in the pipeline: both classes become `insufficient-source` fallbacks,
the row is stamped `fallback`, and the six-hour cooldown re-runs the same dead
fetch. In the last full ingest, 50 of 138 scraper sources also failed, many
permanently (403/404), and each one still costs a request per run.

## Strategy

Four tiers, ordered by risk and by how much they remove rather than hide.

### Tier 1 — degrade instead of aborting (low risk, do first)

1. **Partial document instead of an exception.** Read up to 4 MiB
   (`AI_NEWS_SOURCE_MAX_BYTES`, default 4,000,000), stop the stream at the cap, and
   parse what arrived. If the extraction yields fewer than `MIN_SOURCE_WORDS_FOR_AI`
   (20) words, treat it as a failure. Decider and Pitchfork-shaped pages then
   produce text instead of a fallback; memory stays bounded because only the cap is
   buffered.
2. **Classify the failure, not just log it.**
   - `timeout, 0 bytes` → `host-blocked`: no retry, and the host is skipped for the
     rest of the run.
   - `timeout after bytes` / `5xx` → transient: one retry, as today.
   - `403 / 429` → `host-refused`: no retry, host skipped for the run.
   - `oversize after cap` → `partial`: accepted if the extraction clears the word
     floor.
3. **Per-run host circuit breaker.** After one `host-blocked`/`host-refused` or two
   transient failures, that host is skipped for the remainder of the run. This is
   the single biggest wall-clock saving: a blocked host currently costs up to
   2 × 15 s per article, and the run has 20–30 articles at concurrency 3.

Expected effect: Decider-class pages recover outright; NPR-class hosts cost one
15 s stall per run rather than one per article; a run's spent time becomes
predictable.

### Tier 2 — a fallback ladder with named outcomes (medium)

When the body is unavailable, resolve in this order and record which rung was used:

1. Publisher body ≥ 400 words → current behaviour.
2. Feed fields already stored (`content`, `excerpt`) if together ≥ 20 words → rewrite
   from the summary, and say so in the brief (`seoDescription` stays factual; the
   article page already links the source).
3. Nothing usable → **do not publish a fallback brief**. Leave the row pending and
   record the host as blocked, so the next run retries only when that host is
   healthy. A published "could not rewrite this" page is worse than a story that
   appears a cycle later.

This needs no schema change: the outcome lives in the log and in the existing
`ai_status`, and the host-blocked set is per-run state.

### Tier 3 — stop fetching HTML where a feed exists (structural)

The most reliable source is the one that is never scraped. NPR publishes feeds and an
API; most outlets in the scraper list expose RSS with `content:encoded`. Add an
optional `feedUrl` per source, prefer feed entries for both the headline list and
the article body, and keep HTML retrieval only as the fallback. That removes the
NPR class of failure entirely instead of detecting it well.

### Tier 4 — observability and governance

- **One structured event per fetch**: host, status, bytes, ms, outcome class. Then a
  weekly `news:source-report` listing hosts by failure rate, so dead sources are
  pruned from the list rather than silently costing a request every six hours
  (50 of 138 failed in the last run, several with 403/404).
- **Compliance check before any of the above is tuned further.** NPR's terms
  restrict automated collection and AI use of its content, and Decider's terms
  restrict automated collection; a proxy or a friendlier User-Agent does not change
  that. Either obtain permission, use the publisher's API/feeds under their terms,
  or drop those hosts from the rewrite path. This is a product decision, not a
  parsing problem, and it should be settled before investing in per-host tricks.

## Acceptance criteria

- ≥ 90% of selected rows produce either a ≥ 400-word body or a deliberate
  summary-basis brief, with the basis recorded.
- A fully blocked host costs at most one 15 s stall per run.
- `insufficient-source` fallbacks fall below 2% of processed rows.
- No published brief whose only source is a stub (`Music update from …`).

## Test plan

- Unit tests for failure classification and for the capped-read path, using a
  synthetic > 4 MiB HTML fixture and mocked timeouts (no network).
- A `news:source-fetch` probe run against the five highest-failure hosts before and
  after Tier 1, recorded in this document.
