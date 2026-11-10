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

---

# Tier 1: shipped 2026-11-10

`lib/source-fetch.ts` now owns the reader, the failure taxonomy and the per-run host
circuit; `lib/ai-news.ts` and `npm run news:source-fetch` both use it, so the probe
measures what ingestion does instead of approximating it.

Before and after, measured with the same probe:

| Host and URL | Before (2 MB cap, throw) | After (4 MB cap, parse partial) |
|---|---|---|
| npr.org article | 0 bytes, 15,011 ms, fallback brief | 0 bytes, 15,016 ms, **`host-blocked`, no retry, host skipped for the run** |
| decider.com article | 2,015,232 bytes, killed by the cap | **3,167,553 bytes, 1,327 ms, 2,915 words — usable** |
| pitchfork.com section | 1,966,234 bytes, marginal | 1,968,516 bytes, 209 ms, 1,781 words |
| decider.com fake slug | — | 404 → `invalid`, no retry (was one wasted retry per run) |

Regressions covered by `tests/source-fetch.test.ts`: a capped read keeps its
document, a mid-body stall keeps what arrived, a stall before the first byte still
fails, the cap is clamped, the circuit opens on a refusal and on two transient
faults, a refused host is requested once rather than once per article, a 503 is
retried once, and a page with no article body stops being requested after the second
try.

The JSON line per fetch (`{"event":"source_fetch",...}`) is the audit trail: host,
outcome, kind, status, bytes, words, ms.

## NPR and Decider: the feed evidence

Both publishers do publish feeds, so the "use feeds where possible" half of the
decision is answerable with numbers rather than assumption:

| Feed | Items | `content:encoded` on first item | What it actually contains |
|---|---|---|---|
| `decider.com/feed/` | 10 | present | **66 characters** — an excerpt, not an article; the first item is television, not music |
| `feeds.npr.org/1008/rss.xml` (NPR Music) | 10 | present | **941 characters** (~140 words) — a teaser that links back to the blocked article |
| `www.npr.org/rss/rss.php?id=1008` (legacy) | — | — | times out, same edge block as the articles |

So a feed does not by itself solve this. A 941-character teaser cannot support the
400-word floor the brief has to clear, and the article behind it is the thing that
is blocked. The feed also does not remove the licence question: syndication via RSS
is not permission to rewrite.

Proposed decision, ready to implement as a host policy setting:

- **Decider — keep in the rewrite path.** Tier 1 already fixed it: the article body
  reads in 1.3 s and yields 2,915 words. No feed needed, and the feed would only
  make it worse by handing us 66 characters.
- **NPR — stop rewriting it, stop spending the stall.** 0 bytes in 15 s at the edge,
  and its feed carries nothing a 400-word brief can be built from. Rows keep their
  headline and link, publish as a plain summary instead of a fallback brief, or wait.
  Re-enable only with the NPR Story API key (full text, under their terms), which is
  also the only route that settles the licence question.
- **Any future host** is judged by the same measurement: if `news:source-fetch`
  reports `host-blocked` twice on the same host, it belongs on the deny-list.

## Decision implemented 2026-11-10

`DEFAULT_REWRITE_DENY_HOSTS = ['npr.org']` in `lib/source-fetch.ts`, matched by host
and subdomain (`www.npr.org` yes, `npr.org.evil.example` and `my-npr.org` no).
`SOURCE_REWRITE_DENY_HOSTS` extends it with a comma-separated list, or empties it
with `none`, so the decision is reversible without a deploy. Decider is absent and
stays in the rewrite path.

What a denylisted publisher costs now: the fetcher returns before the circuit and
before any socket, logs `{"outcome":"denied"}`, and the brief is built as a link-out
instead of an apology — `failureReason: 'source-unavailable'` rather than
`insufficient-source`, so a deliberate skip is never counted as a failed rewrite.
The article page renders the same neutral copy for those rows rather than the
"could not complete an editorial rewrite" message, which read like an outage readers
were meant to wait out. Runs report the count as `publisherDenied`.

Verified against a stored row: `generateAiNewsArticle` returned in **1 ms** with
`source-unavailable` and no model call, where the row previously spent 15 s on a
stall and then wrote a fallback brief. Existing NPR rows keep their `fallback`
status, so the six-hour cooldown re-stamps them with the new copy with no network
cost; a `publisher_denied` flag on the row would make that permanent, and is the
follow-up if the repeated cooldown write bothers the queue metrics.

One thing the sample turned up, outside this task's scope: the row we sampled is an
NPR politics newsletter ("up-first-newsletter-canada-tariffs-visa-revocations…"),
which means it cleared the relevance gate at some point. That turned into the
section below.

## What the official batch actually reported

`npm run ai:enrich:official -- --batches=1 --limit=4` returned `inspected: 0`,
`stopReason: 'queue-empty'`, `publisherDenied: 0` in 239 ms. The LATEST run was
equally empty. That is not a broken counter — it is the queue:

| Queue | Depth | Why it never reached a denylisted row |
|---|---|---|
| OFFICIAL | 0 rows | every source in the curated list is finished |
| LATEST pending | 1,000+ | oldest is from April; the window is 21 days |
| LATEST fallback (repair path) | 175 | the first denylisted row sits behind 43 others |

Every npr.org row is `LATEST` and dates from August, so it is outside the
processing window and never enters a normal run. **The 6-hour cooldown therefore
does not touch these rows at all**, which settles the migration question harder
than the arithmetic did: a per-row flag would save writes that are not happening.

**Decision: no migration.** Revisit only if denylisted publishers become a daily
source, where a fresh row would re-stamp itself up to 84 times across the window.

## Closing the digest hole

`lib/news-relevance.ts` gains a `digest` hard block on format markers — `. And, `
clause joins, "Up First", `morning/evening/daily briefing`, `top stories`, `news
round-up` — not on the word "newsletter", so "Band's newsletter confirms reunion
tour" survives. The August newsletter scores 1 vs 0 today and would already be
dropped; the hole was the version with one strong music term in it.

The dry run then exposed a second, live gate bug: **console brand names in the
video-game block**. "Stormzy's Glastonbury stab-proof vest goes on display in
landmark exhibition of Black British music" was blocked as a video-game story
because its copy mentions the Nintendo in JME's early tunes — the console is part
of the exhibit. Brands were removed from the block; the subject words (gameplay,
esports, patch notes, game review) stayed. Both are pinned by tests.

## The purge, and the line it must not cross

`npm run news:purge-offtopic` judges all 34,779 rows with the policy their
category uses at ingest. Full-table dry run:

```
clear           379   rows it can stamp unattended
needs-judgement 4,205 held (4,584 refused in total, after the gate fix)
```

The held rows are not slack: the same bucket contains "Xiu Xiu – Xiu Mutha
Fuckin' Xiu", "Blackpink – Go", an Asha Bhosle interview and a Rock Hall piece,
all with `url: null`, so there is no publisher to check them against either.
Vocabulary cannot separate those from a car review, so `--apply` stamps only the
clear set and `--include-ambiguous` is required to go further. Audio-gear
headlines are held too, because this codebase already treats headphones and
turntables as music news.

Applied: 379 rows stamped `skipped`; 4,205 held for a human. `--restore` reverses
it, and `--restore --include-ambiguous` is the repair path if a run over-reaches.

One correction worth recording: the first version of `--apply` stamped `refused`
instead of the filtered set and unpublished 4,588 rows, including the held music
reviews. The restore path put 4,423 of them back within minutes, and the code now
passes `selected` with a comment saying why. That is the argument for the tiered
design: the safe set is small enough that a mistake in it is recoverable.
