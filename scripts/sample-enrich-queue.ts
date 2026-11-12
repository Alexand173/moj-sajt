import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildArtistNameIndex, loadKnownArtistNames } from '../lib/news-artists';
import { assessNewsRelevance, isPublishableMusicNews } from '../lib/news-relevance';
import { getPublisherTrust, isRefusedPublisherUrl } from '../lib/news-sources';

loadEnvConfig(process.cwd());

/**
 * Shows what the pipeline is about to publish, before it publishes it.
 *
 * Two questions, one tool, because after a gate change they are different:
 *
 * `--queue` (default) reads the same queue the AI worker reads — same window,
 * same status filter, same oldest-first order, judged with the same function the
 * feed and the article page use.
 *
 *   npm run news:enrich-sample
 *   npm run news:enrich-sample -- --sample=100
 *   npm run news:enrich-sample -- --category=OFFICIAL
 *
 * `--held` reads the rows a previous, stricter gate stamped `skipped` and lists
 * the ones the rule accepts today — the restore candidates. This is the sample to
 * read before running `news:purge-offtopic -- --restore`, because restoring is what
 * puts a row back on a region feed and in the sitemap.
 *
 *   npm run news:enrich-sample -- --held
 *   npm run news:enrich-sample -- --held --sample=80
 *
 * Read-only in both modes: nothing is written, nothing is rewritten, no AI call is
 * made. A `fallback` row is a rewrite that failed the similarity gate and is
 * retried after a cooldown, so it is excluded from the queue view (it was judged
 * once already) but included in the held view (it is still on the site).
 */

const DEFAULT_SAMPLE = 40;
const DEFAULT_SINCE_DAYS = 21;
const PAGE_SIZE = 500;
/** The skipped pile is ~3,600 rows; the cap only guards against a runaway table. */
const MAX_HELD_ROWS = 40_000;

type Category = 'LATEST' | 'OFFICIAL';

interface NewsRow {
  id: string | number;
  title: string | null;
  excerpt: string | null;
  content: string | null;
  url: string | null;
  category: string | null;
  ai_content?: string | null;
  created_at?: string | null;
}

type Verdict = {
  row: NewsRow;
  host: string;
  publisherTrust: string;
  refundedPublisher: boolean;
  accepted: boolean;
  reason: string;
  matchedMusic: string[];
  hasBrief: boolean;
};

function readNumberFlag(flag: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) return undefined;

  const parsed = Number.parseInt(argument.slice(flag.length + 1), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readCategory(): Category[] {
  const argument = process.argv.find((value) => value.startsWith('--category='));
  const wanted = argument?.slice('--category='.length).toUpperCase();

  if (wanted === 'OFFICIAL' || wanted === 'LATEST') return [wanted];
  return ['OFFICIAL', 'LATEST'];
}

function hostOf(url: string | null): string {
  if (!url) return 'no source url';

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unparseable url';
  }
}

function requireSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * The verdict, from the same call the reader makes. `publisherTrust` is resolved
 * from the row's own URL, so a refuse-list host is judged as a general newsroom
 * here exactly as it is at ingest and at read time.
 */
function judgeRow(row: NewsRow, knownArtists: ReturnType<typeof buildArtistNameIndex>): Verdict {
  const publisherTrust = getPublisherTrust(row.url);
  const input = { title: row.title, excerpt: row.excerpt, content: row.content, url: row.url };
  const accepted = isPublishableMusicNews(input, { knownArtists, publisherTrust });
  const verdict = assessNewsRelevance(
    input,
    publisherTrust === 'music' ? 'music-publication' : 'news-api',
    { knownArtists, publisherTrust },
  );

  return {
    row,
    host: hostOf(row.url),
    publisherTrust,
    refundedPublisher: isRefusedPublisherUrl(row.url),
    accepted,
    reason: verdict.hardBlock
      ? `blocked:${verdict.hardBlock}`
      : `score ${verdict.musicScore} vs ${verdict.offTopicScore}`,
    matchedMusic: verdict.matchedMusic,
    hasBrief: Boolean(row.ai_content?.trim()),
  };
}

async function loadQueue(supabase: SupabaseClient, categories: Category[], sample: number, sinceDays: number): Promise<NewsRow[]> {
  const windowStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('news')
    .select('id, title, excerpt, content, url, category, ai_content, created_at')
    .in('category', categories)
    .gte('created_at', windowStart)
    .or('ai_status.is.null,ai_status.eq.pending')
    // Identical to `enrichPendingNews`: oldest first, so the sample is the head of
    // the queue rather than a random slice of it.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(sample);

  if (error) throw new Error(`Could not load the enrichment queue: ${error.message}`);

  return (data || []) as NewsRow[];
}

async function loadHeld(supabase: SupabaseClient, categories: Category[]): Promise<NewsRow[]> {
  const rows: NewsRow[] = [];

  for (let offset = 0; offset < MAX_HELD_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, excerpt, content, url, category, ai_content, created_at')
      .in('category', categories)
      .eq('ai_status', 'skipped')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read held rows: ${error.message}`);

    const page = (data || []) as NewsRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function printRow(entry: Verdict, index: number): void {
  console.log(
    `${String(index + 1).padStart(3)}. ${entry.accepted ? 'KEEP  ' : 'REFUSE'} `
    + `[${entry.row.category ?? '?'}] ${entry.host} (${entry.publisherTrust})`
    + `${entry.refundedPublisher ? ' [refuse-list]' : ''} — ${entry.reason}`
    + `\n     ${String(entry.row.title || 'untitled').slice(0, 150)}`
    + (entry.matchedMusic.length ? `\n     terms: ${entry.matchedMusic.join(', ')}` : ''),
  );
}

function rankHosts(entries: Verdict[]): Array<{ host: string; kept: number; refused: number }> {
  const byHost = new Map<string, { kept: number; refused: number }>();

  for (const entry of entries) {
    const tally = byHost.get(entry.host) ?? { kept: 0, refused: 0 };
    if (entry.accepted) tally.kept += 1;
    else tally.refused += 1;
    byHost.set(entry.host, tally);
  }

  return Array.from(byHost.entries())
    .sort((a, b) => (b[1].kept + b[1].refused) - (a[1].kept + a[1].refused))
    .map(([host, tally]) => ({ host, ...tally }));
}

async function main(): Promise<void> {
  const sample = readNumberFlag('--sample') ?? DEFAULT_SAMPLE;
  const sinceDays = readNumberFlag('--since-days') ?? DEFAULT_SINCE_DAYS;
  const categories = readCategory();
  const heldMode = process.argv.includes('--held');
  const supabase = requireSupabase();
  const knownArtists = buildArtistNameIndex(await loadKnownArtistNames(supabase));

  if (!heldMode) {
    const rows = await loadQueue(supabase, categories, sample, sinceDays);
    if (rows.length === 0) {
      console.log(JSON.stringify({
        event: 'news_enrich_sample',
        mode: 'queue',
        sampled: 0,
        note: 'nothing pending — try --held for the rows an older gate set aside',
      }, null, 2));
      return;
    }

    const judged = rows.map((row) => judgeRow(row, knownArtists));
    judged.forEach(printRow);

    console.log(JSON.stringify({
      event: 'news_enrich_sample',
      mode: 'queue',
      sampled: judged.length,
      categories,
      sinceDays,
      kept: judged.filter((entry) => entry.accepted).length,
      refused: judged.filter((entry) => !entry.accepted).length,
      fromRefuseList: judged.filter((entry) => entry.refundedPublisher).length,
      hosts: rankHosts(judged),
    }, null, 2));
    return;
  }

  const held = await loadHeld(supabase, categories);
  const judged = held.map((row) => judgeRow(row, knownArtists));
  const restorable = judged.filter((entry) => entry.accepted);
  const stillRefused = judged.filter((entry) => !entry.accepted);

  restorable.slice(0, sample).forEach(printRow);

  console.log(JSON.stringify({
    event: 'news_enrich_sample',
    mode: 'held',
    heldRows: judged.length,
    restorable: restorable.length,
    stillRefused: stillRefused.length,
    restorableWithBrief: restorable.filter((entry) => entry.hasBrief).length,
    restorableWithoutBrief: restorable.filter((entry) => !entry.hasBrief).length,
    restorableFromRefuseList: restorable.filter((entry) => entry.refundedPublisher).length,
    printed: Math.min(sample, restorable.length),
    hosts: rankHosts(restorable).slice(0, 20),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Enrichment queue sample failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
