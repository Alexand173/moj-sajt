import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assessNewsRelevance, type RelevancePolicy } from '../lib/news-relevance';
import { isMusicPublicationUrl } from '../lib/news-sources';

loadEnvConfig(process.cwd());

/**
 * Takes non-music stories off the news feed without deleting them.
 *
 * The relevance rule only guards new arrivals, so everything it would refuse
 * today that was stored before it was tightened is still published: an audit of
 * the last 120 days found 78 published LATEST rows the gate refuses now — hockey
 * report cards, World of Warcraft, MCU sequels, F1 practice, a divorce ruling, a
 * shooting report, a Vatican document, and "Canada to hit U.S. with retaliatory
 * tariffs. And, remembering music legend Dolly Parton".
 *
 * Each row is judged with the policy its own category uses at ingest, so the
 * verdict here is the verdict the row would get today:
 *
 *   LATEST    -> 'news-api'          (a general firehose must prove it is music)
 *   OFFICIAL  -> 'music-publication' (a curated music outlet is trusted)
 *
 * Nothing is deleted. The failure state is `ai_status = 'skipped'`, which is what
 * removes a row from its region feed and from the sitemap; `--restore` puts a row
 * back based on whether it still has a brief.
 *
 *   npm run news:purge-offtopic              # report only
 *   npm run news:purge-offtopic -- --apply   # stamp them skipped
 *   npm run news:purge-offtopic -- --restore # undo, for rows the rule keeps
 */

const PAGE_SIZE = 500;
/**
 * The table held 34,779 rows when this was written, so a cap below that would
 * have reported a clean bill of health for the oldest 20,000 only.
 */
const MAX_ROWS = 60_000;
/** A rule bug must not be able to empty the feed in one command. */
const MAX_APPLY_RATIO = 0.5;

/**
 * How sure the rule is, which decides whether a row may be stamped by default.
 *
 * `clear` — a blocked subject (a game, a patch note, a digest), or no music
 * evidence at all alongside off-topic evidence. Applying these is routine.
 *
 * `needs-judgement` — the row has no music words *and* no off-topic words, which
 * covers most junk but also every review whose headline is just an artist and a
 * title: a dry run put "Xiu Xiu – Xiu Mutha Fuckin' Xiu", "Blackpink – Go" and an
 * Asha Bhosle interview in this bucket, and those rows have no URL to check the
 * publisher against either. Nothing here is stamped unless `--include-ambiguous`
 * is passed, because vocabulary cannot tell those apart from a car review.
 */
type Confidence = 'clear' | 'needs-judgement';

/**
 * Audio hardware is music news in this codebase — the relevance rule says so
 * explicitly when it keeps headphones and turntables out of the consumer-product
 * block. A gear piece often carries no music vocabulary at all ("I traded my Sonos
 * Era 300 for Denon's new home speaker"), so it lands in the off-topic bucket and
 * would be stamped by the clear rule. Held for that reason.
 */
const AUDIO_GEAR_PATTERN = /\b(headphones?|earbuds?|in-ear monitors?|speakers?|soundbars?|turntables?|amplifiers?|preamps?|synthesi[sz]ers?|audio interfaces?)\b/i;

function looksLikeAudioGear(title: string | null): boolean {
  return AUDIO_GEAR_PATTERN.test(title || '');
}

/** The publisher, for grouping. Rows with no URL report as a single bucket. */
function hostOf(url: string | null): string {
  if (!url?.trim()) return '(no url)';

  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '(bad url)';
  }
}

interface NewsRow {
  id: string | number;
  title: string | null;
  excerpt: string | null;
  content: string | null;
  url: string | null;
  category: string | null;
  ai_status: string | null;
  ai_content: string | null;
}

interface JudgedRow {
  row: NewsRow;
  refused: boolean;
  reason: string;
  confidence: Confidence;
  /** Published by a music outlet, so the gate's silence is not evidence. */
  trustedPublisher: boolean;
  /** Would have been refused on vocabulary alone, and the publisher rescues it. */
  rescuedByPublisher: boolean;
}

function policyFor(row: NewsRow): RelevancePolicy {
  return row.category === 'OFFICIAL' ? 'music-publication' : 'news-api';
}

function judge(row: NewsRow): JudgedRow {
  const verdict = assessNewsRelevance(
    { title: row.title, excerpt: row.excerpt, content: row.content, url: row.url },
    policyFor(row),
  );

  /**
   * Only two shapes are unambiguous enough to stamp without a human:
   *
   * - a blocked subject, which names something that is never music;
   * - no music evidence at all, plus off-topic evidence.
   *
   * Everything else that the gate refuses is held. That deliberately includes the
   * "one weak music word, nothing against" bucket: a dry run showed it holding
   * both "How to Choose the Right City After College" and "Rethinking European
   * music exports", so a single soft term — often just the word "live" — is noise
   * in either direction.
   */
  const confidence: Confidence = !looksLikeAudioGear(row.title)
    && (verdict.hardBlock || (verdict.musicScore === 0 && verdict.offTopicScore >= 2))
    ? 'clear'
    : 'needs-judgement';

  /**
   * A music publication is trusted the way the scraper trusts its curated list:
   * "Blackpink – Go" and "Xiu Xiu – Xiu Mutha Fuckin' Xiu" carry no music
   * vocabulary, and the host is the only signal that resolves them. Such a row is
   * never candidate junk, whatever the words score.
   */
  const trustedPublisher = isMusicPublicationUrl(row.url);

  return {
    row,
    refused: !verdict.relevant && !trustedPublisher,
    reason: verdict.hardBlock || `score ${verdict.musicScore} vs ${verdict.offTopicScore}`,
    confidence,
    trustedPublisher,
    rescuedByPublisher: trustedPublisher && !verdict.relevant,
  };
}

async function loadRows(supabase: SupabaseClient): Promise<NewsRow[]> {
  const rows: NewsRow[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, excerpt, content, url, category, ai_status, ai_content')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read news rows: ${error.message}`);

    const page = (data || []) as NewsRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function setStatus(
  supabase: SupabaseClient,
  ids: Array<string | number>,
  status: string,
): Promise<number> {
  const CHUNK = 100;
  let updated = 0;

  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    const { error, count } = await supabase
      .from('news')
      .update({ ai_status: status }, { count: 'exact' })
      .in('id', chunk);

    if (error) throw new Error(`Could not set ${status} on news rows: ${error.message}`);
    updated += count ?? chunk.length;
  }

  return updated;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const apply = process.argv.includes('--apply');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = await loadRows(supabase);
  const judged = rows.map(judge);

  /**
   * Undo half first. A row the rule keeps but that is already `skipped` was
   * marked under an older rule or by the reviews cleanup; putting it back is what
   * makes this command safe to run twice and safe to regret.
   */
  if (process.argv.includes('--restore')) {
    /**
     * `--include-ambiguous` widens the undo to every skipped row the rule is not
     * sure about. That is the repair path: if a run stamped rows it should have
     * held, this puts exactly those back — a row judged `clear` junk stays
     * skipped, because the rule is sure about it.
     */
    const restoreAmbiguous = process.argv.includes('--include-ambiguous');
    const restorable = judged
      .filter((entry) => entry.row.ai_status === 'skipped'
        && (!entry.refused || (restoreAmbiguous && entry.confidence === 'needs-judgement')))
      .map((entry) => entry.row);
    const withBrief = restorable.filter((row) => row.ai_content?.trim());

    await setStatus(supabase, withBrief.map((row) => row.id), 'generated');
    await setStatus(
      supabase,
      restorable.filter((row) => !row.ai_content?.trim()).map((row) => row.id),
      'pending',
    );

    console.log(JSON.stringify({
      event: 'news_offtopic_restored',
      restored: restorable.length,
      toGenerated: withBrief.length,
      toPending: restorable.length - withBrief.length,
    }, null, 2));
    return;
  }

  /**
   * `--by-host` answers a different question: which publishers do the held rows
   * come from? A host that is a music publication by any reasonable definition can
   * be trusted the way the OFFICIAL scraper trusts its curated list, which is how
   * a held row gets resolved without a human reading 4,000 headlines.
   */
  if (process.argv.includes('--by-host')) {
    const held = judged.filter((entry) => entry.refused && entry.confidence === 'needs-judgement');
    const byHost = new Map<string, { held: number; titles: string[] }>();

    for (const entry of held) {
      const host = hostOf(entry.row.url);
      const bucket = byHost.get(host) || { held: 0, titles: [] };
      bucket.held += 1;
      if (bucket.titles.length < 2) bucket.titles.push(String(entry.row.title || '').slice(0, 70));
      byHost.set(host, bucket);
    }

    const ranked = Array.from(byHost.entries())
      .sort((a, b) => b[1].held - a[1].held)
      .map(([host, bucket]) => ({ host, held: bucket.held, titles: bucket.titles }));

    console.log(JSON.stringify({
      event: 'news_offtopic_by_host',
      heldTotal: held.length,
      distinctHosts: ranked.length,
      noUrl: held.filter((entry) => !hostOf(entry.row.url)).length,
      hosts: ranked.slice(0, 40),
    }, null, 2));
    return;
  }

  const refused = judged.filter((entry) => entry.row.ai_status !== 'skipped' && entry.refused);
  const clear = refused.filter((entry) => entry.confidence === 'clear');
  const needsJudgement = refused.filter((entry) => entry.confidence === 'needs-judgement');
  const includeAmbiguous = process.argv.includes('--include-ambiguous');
  const selected = includeAmbiguous ? refused : clear;

  const byCategory: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  for (const entry of selected) {
    const category = String(entry.row.category || 'null');
    byCategory[category] = (byCategory[category] || 0) + 1;
    byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
  }

  console.log(JSON.stringify({
    event: 'news_offtopic_purge',
    apply,
    scanned: rows.length,
    alreadySkipped: rows.filter((row) => row.ai_status === 'skipped').length,
    // Rows the vocabulary refused but the publisher rescues.
    rescuedByPublisher: judged.filter((entry) => entry.rescuedByPublisher).length,
    refused: refused.length,
    clear: clear.length,
    needsJudgement: needsJudgement.length,
    wouldSkip: selected.length,
    includeAmbiguous,
    byCategory,
    byReason,
  }, null, 2));

  for (const entry of selected.slice(0, 40)) {
    console.log(
      `- [${entry.row.category} ${entry.row.ai_status ?? 'null'}] ${String(entry.row.title || '').slice(0, 95)}  <${entry.reason}>`,
    );
  }

  if (needsJudgement.length > 0 && !includeAmbiguous) {
    console.log(
      `Held back ${needsJudgement.length} row(s) with no evidence either way — real artist-only reviews live there. `
      + 'Pass --include-ambiguous to include them.',
    );
  }

  if (!apply) {
    console.log('Report only. Re-run with --apply to stamp the clear rows as skipped.');
    return;
  }

  if (refused.length > rows.length * MAX_APPLY_RATIO) {
    throw new Error(
      `Refusing to skip ${refused.length} of ${rows.length} rows (over ${MAX_APPLY_RATIO * 100}%): `
      + 'that pattern means the rule is wrong, not the table.',
    );
  }

  // `selected`, never `refused`: the first version of this line stamped every
  // row the rule refused, including the 4,209 held as ambiguous, and unpublished
  // real artist-only reviews with them.
  const updated = await setStatus(supabase, selected.map((entry) => entry.row.id), 'skipped');
  console.log(JSON.stringify({ event: 'news_offtopic_purged', updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Off-topic news purge failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
