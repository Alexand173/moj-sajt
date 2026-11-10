import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { lookupArticleByTitle, normalizeArticleTitle } from '../lib/news-url-recovery';

loadEnvConfig(process.cwd());

/**
 * Measures how many URL-less news rows can get their original source back.
 *
 * 10,547 rows were stored without a `url` — a closed cohort from March to July
 * 2026 whose `content` is NewsAPI's truncated snippet, so the article cannot be
 * fetched and the publisher cannot be cited. Before stamping them unpublishable,
 * this asks NewsAPI for each headline and accepts an exact title match, which is
 * the same rule enrichment uses when it has no URL.
 *
 * The sample exists because NewsAPI's free plan is 100 requests a day: measuring
 * twenty rows answers "is recovery worth doing at scale" for a fifth of a day's
 * quota, and measuring all 985 published rows would answer it by spending the
 * quota and stopping ingest.
 *
 *   npm run news:recover-urls -- --sample=20
 *   npm run news:recover-urls -- --sample=20 --apply   # write the URLs found
 *
 * Scopes:
 *   published (default)  the 985 rows that are live with no source link
 *   pending              the 9,313 rows waiting outside the worker window
 *   all                  everything with a null url
 */

const PAGE_SIZE = 1_000;
const MAX_ROWS = 60_000;
/** Matches the supabase-js write cost; a per-row URL update cannot be batched. */
const UPDATE_CHUNK = 100;
/** Free plan is 100 requests a day, and the ingest spends most of it. */
const DEFAULT_MAX_REQUESTS = 25;
const DEFAULT_DELAY_MS = 250;

interface CandidateRow {
  id: string | number;
  title: string | null;
  ai_status: string | null;
  created_at: string | null;
}

interface Hit {
  id: string | number;
  title: string;
  url: string;
  publisher: string;
  aiStatus: string | null;
}

function argumentValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function intArgument(name: string, fallback: number): number {
  const raw = argumentValue(name);
  if (raw === null) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} expects a non-negative integer, got "${raw}".`);
  }

  return parsed;
}

/**
 * Spread the sample across the cohort instead of taking the first N.
 *
 * The cohort spans five months, and the oldest rows are the ones most likely to
 * have fallen out of NewsAPI's index — sampling the head would report a hit rate
 * for March as if it described the whole table.
 */
function strideSample<T>(rows: T[], size: number): T[] {
  if (size <= 0 || rows.length <= size) return rows;

  const step = rows.length / size;
  const picked: T[] = [];
  for (let index = 0; index < size; index += 1) {
    picked.push(rows[Math.min(rows.length - 1, Math.floor((index + 0.5) * step))]);
  }

  return picked;
}

async function loadCandidates(supabase: SupabaseClient, scope: string): Promise<CandidateRow[]> {
  const rows: CandidateRow[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = supabase
      .from('news')
      .select('id, title, ai_status, created_at')
      .is('url', null)
      .not('title', 'is', null)
      .order('id', { ascending: true });

    if (scope === 'published') query = query.eq('ai_status', 'generated');
    if (scope === 'pending') query = query.eq('ai_status', 'pending');

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read news rows: ${error.message}`);

    const page = (data || []) as CandidateRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // A title of only punctuation normalises to nothing, so it can never match.
  return rows.filter((row) => normalizeArticleTitle(row.title).length > 0);
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  if (!process.env.NEWS_API_KEY?.trim()) throw new Error('Missing NEWS_API_KEY.');

  const apply = process.argv.includes('--apply');
  const scope = argumentValue('scope') || 'published';
  const sampleSize = intArgument('sample', 20);
  const maxRequests = intArgument('max-requests', DEFAULT_MAX_REQUESTS);
  const delayMs = intArgument('delay', DEFAULT_DELAY_MS);

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const candidates = await loadCandidates(supabase, scope);
  const selected = strideSample(candidates, sampleSize);

  const hits: Hit[] = [];
  const misses: Array<{ id: string | number; title: string }> = [];
  const errors: Array<{ code: string; message?: string }> = [];
  let requests = 0;
  let abortedReason: string | null = null;

  for (const row of selected) {
    if (requests >= maxRequests) {
      abortedReason = `Stopped at the --max-requests=${maxRequests} cap.`;
      break;
    }

    requests += 1;
    const lookup = await lookupArticleByTitle({ title: String(row.title || '') });

    if (lookup.error) {
      errors.push({ code: lookup.error, message: lookup.message });

      // A bad key or an exhausted quota would make every remaining row look like
      // a miss, which would understate the hit rate and condemn the cohort.
      if (lookup.error === 'rate-limited' || lookup.error === 'unauthorized') {
        abortedReason = `Stopped after ${lookup.error}: the remaining rows cannot be judged.`;
        break;
      }
    } else if (lookup.match?.url) {
      hits.push({
        id: row.id,
        title: String(row.title || ''),
        url: lookup.match.url,
        publisher: lookup.match.source?.name || 'unknown',
        aiStatus: row.ai_status,
      });
    } else {
      misses.push({ id: row.id, title: String(row.title || '') });
    }

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const judged = hits.length + misses.length;
  const hitRate = judged > 0 ? Number((hits.length / judged).toFixed(3)) : 0;
  const projectedRecoverable = Math.round(hitRate * candidates.length);

  const publishers: Record<string, number> = {};
  for (const hit of hits) publishers[hit.publisher] = (publishers[hit.publisher] || 0) + 1;

  console.log(JSON.stringify({
    event: 'news_url_recovery',
    apply,
    scope,
    candidates: candidates.length,
    sample: selected.length,
    requests,
    judged,
    hits: hits.length,
    misses: misses.length,
    errors: errors.length,
    hitRate,
    projectedRecoverable,
    byPublisher: publishers,
    abortedReason,
  }, null, 2));

  for (const hit of hits) {
    console.log(`- [${hit.aiStatus ?? 'null'}] ${hit.title.slice(0, 70)}  ->  ${hit.url.slice(0, 90)}`);
  }
  for (const miss of misses.slice(0, 10)) {
    console.log(`- no match: ${miss.title.slice(0, 90)}`);
  }

  if (!apply) {
    console.log('Measurement only. Re-run with --apply to write the URLs found.');
    return;
  }

  let updated = 0;
  for (let start = 0; start < hits.length; start += UPDATE_CHUNK) {
    for (const hit of hits.slice(start, start + UPDATE_CHUNK)) {
      // The URL only. `ai_status` is left alone: a published row does not become
      // unpublished because it gained a source, and a pending row still has to
      // pass the rewrite before it is published.
      const { error, count } = await supabase
        .from('news')
        .update({ url: hit.url }, { count: 'exact' })
        .eq('id', hit.id);

      if (error) throw new Error(`Could not write the URL for news ${hit.id}: ${error.message}`);
      updated += count ?? 1;
    }
  }

  console.log(JSON.stringify({ event: 'news_url_recovered', updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error('URL recovery failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
