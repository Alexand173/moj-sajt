import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildArtistNameIndex, loadKnownArtistNames, type ArtistNameIndex } from '../lib/news-artists';
import { assessNewsRelevance, isPublishableMusicNews, type RelevancePolicy } from '../lib/news-relevance';
import { getPublisherTrust, isMusicPublicationUrl } from '../lib/news-sources';

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
 * `needs-judgement` — everything else the gate refuses, including the row with no
 * music words *and* no off-topic words. That bucket used to hold every artist-only
 * review as well, because there was no way to tell it from a cricket explainer.
 * Publisher trust settles it: a zero-evidence row from a known general newsroom is
 * now `clear`, and one whose host is a music publication — or unknown — stays here.
 * Nothing in this bucket is stamped unless `--include-ambiguous` is passed.
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
  /** Set when a named subject blocked the row, rather than a score. */
  hardBlock: string | null;
  confidence: Confidence;
  /** Published by a music outlet, so the gate's silence is not evidence. */
  trustedPublisher: boolean;
  /** Would have been refused on vocabulary alone, and the publisher rescues it. */
  rescuedByPublisher: boolean;
}

function policyFor(row: NewsRow): RelevancePolicy {
  return row.category === 'OFFICIAL' ? 'music-publication' : 'news-api';
}

function judge(row: NewsRow, knownArtists: ArtistNameIndex): JudgedRow {
  const verdict = assessNewsRelevance(
    { title: row.title, excerpt: row.excerpt, content: row.content, url: row.url },
    policyFor(row),
    // The same artist evidence ingest uses. Without it, "Lindsey Buckingham shares
    // surprising update about relationship with Stevie Nicks" reads as no-music and
    // a general newsroom's copy would be stamped.
    { knownArtists },
  );

  /**
   * A music publication is trusted the way the scraper trusts its curated list:
   * "Blackpink – Go" and "Xiu Xiu – Xiu Mutha Fuckin' Xiu" carry no music
   * vocabulary, and the host is the only signal that resolves them. Such a row is
   * never candidate junk, whatever the words score.
   */
  const trustedPublisher = isMusicPublicationUrl(row.url);

  /**
   * The publisher is known and is not a music publication.
   *
   * This is what resolves the "no evidence either way" bucket the first version of
   * this script had to hold: an artist-only review and a cricket explainer both
   * score zero, so vocabulary cannot separate them — but the host can. When the
   * publisher is a general newsroom, zero music evidence means the story is not
   * about music.
   */
  const host = hostOf(row.url);
  const hasKnownPublisher = host !== '(no url)' && host !== '(bad url)';
  const noMusicEvidence = verdict.musicScore === 0;
  /**
   * Three shapes are unambiguous enough to stamp without a human:
   *
   * - a blocked subject, which names something that is never music;
   * - no music evidence at all, plus off-topic evidence;
   * - no music evidence at all, from a publisher we can see is a general newsroom.
   *
   * `headlineSaysNothingMusical` is deliberately NOT one of them, and it was
   * measured rather than guessed: mirroring the ingest gate's headline rule over
   * stored rows reclassified 1,763 published rows as clear, and 654 of those had
   * substantial body evidence — "JAŸ-Z Adds London Stadium Show", "Ella Langley
   * Blocks Herself From A New No. 1 Hit", "Sarah McLachlan and Allison Russell on
   * Touring Together". An artist's name is not in any vocabulary list, so a
   * headline can name one and still score zero. The rule needs artist recognition
   * before it can be trusted; see the plan.
   */
  const confidence: Confidence = !looksLikeAudioGear(row.title)
    && (
      Boolean(verdict.hardBlock)
      || (noMusicEvidence && verdict.offTopicScore >= 2)
      || (noMusicEvidence && hasKnownPublisher && !trustedPublisher)
    )
    ? 'clear'
    : 'needs-judgement';

  /**
   * The site's own verdict, not a second opinion.
   *
   * The category-policy guess above is what this script has always used, and it
   * drifted from the reader: the purge judged OFFICIAL rows as a trusted publisher
   * no matter which host they came from. Asking `isPublishableMusicNews` — the
   * same call the feed, the article page and the worker make — means a row this
   * script spares is a row a reader can actually open, and vice versa.
   */
  const publishable = isPublishableMusicNews(
    { title: row.title, excerpt: row.excerpt, content: row.content, url: row.url },
    { knownArtists, publisherTrust: getPublisherTrust(row.url) },
  );

  return {
    row,
    refused: !publishable,
    reason: verdict.hardBlock || `score ${verdict.musicScore} vs ${verdict.offTopicScore}`,
    hardBlock: verdict.hardBlock,
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
  const knownArtists = buildArtistNameIndex(await loadKnownArtistNames(supabase));
  const judged = rows.map((row) => judge(row, knownArtists));

  /**
   * The same rows judged with no artist knowledge at all, so the report can say
   * what the roster bought us. Without this the count of held rows moves between
   * runs and nothing explains the movement; with it, "the roster rescued N rows"
   * is a number instead of a hope.
   */
  const withoutArtists = rows.map((row) => judge(row, buildArtistNameIndex([])));

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
  /**
   * `--blocks-only` stamps only the rows a named subject blocked (sport, gossip,
   * self-help, legal, a game) and leaves the "no music evidence from a general
   * newsroom" bucket alone.
   *
   * Both are `clear` by definition, but they carry different risk: a cricket
   * explainer is wrong beyond argument, while an artist-only headline with no
   * music vocabulary is occasionally a real story. At 1,043 candidates the split
   * matters, so it is one flag rather than a judgement baked into the run.
   */
  const blocksOnly = process.argv.includes('--blocks-only');
  const clearBySubject = clear.filter((entry) => Boolean(entry.hardBlock)).length;
  const selected = includeAmbiguous
    ? refused
    : blocksOnly
      ? clear.filter((entry) => Boolean(entry.hardBlock))
      : clear;

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
    // Rows that only pass because the roster knows the artist's name.
    rescuedByArtist: judged.filter((entry, index) => !entry.refused && withoutArtists[index].refused).length,
    refused: refused.length,
    clear: clear.length,
    // Split so the report says how much of the bucket is a named subject and how
    // much is the zero-evidence rule.
    clearBySubject,
    clearBySilence: clear.length - clearBySubject,
    needsJudgement: needsJudgement.length,
    wouldSkip: selected.length,
    includeAmbiguous,
    blocksOnly,
    byCategory,
    byReason,
  }, null, 2));

  for (const entry of selected.slice(0, 40)) {
    console.log(
      `- [${entry.row.category} ${entry.row.ai_status ?? 'null'}] ${String(entry.row.title || '').slice(0, 95)}  <${entry.reason}>`,
    );
  }

  /**
   * What the held rows actually are, split by whether they can even be seen.
   *
   * This is the difference between a number and a decision. Since Phase 3 a row
   * with no URL 404s, so a held row without a URL is not a reader-facing problem
   * at all; a held row with one is the real question, and the hosts it comes from
   * are how that question gets answered.
   */
  if (needsJudgement.length > 0) {
    const isReachable = (entry: JudgedRow) => {
      const host = hostOf(entry.row.url);
      return host !== '(no url)' && host !== '(bad url)';
    };

    const heldWithUrl = needsJudgement.filter(isReachable);
    const heldWithoutUrl = needsJudgement.filter((entry) => !isReachable(entry));

    const byHost = new Map<string, number>();
    for (const entry of heldWithUrl) {
      const host = hostOf(entry.row.url);
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
    }

    const top = [...byHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

    console.log(JSON.stringify({
      event: 'news_held_breakdown',
      held: heldWithoutUrl.length + heldWithUrl.length,
      reachable: heldWithUrl.length,
      unreachable: heldWithoutUrl.length,
      publishers: heldWithUrl.length,
      topPublishers: top.map(([host, count]) => ({ host, count })),
    }, null, 2));

    console.log(
      `${heldWithUrl.length} held row(s) are reachable and need a decision; `
      + `${heldWithoutUrl.length} hold no source URL, so they already 404 and reach nobody.`,
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
