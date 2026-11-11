import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeArtistText } from '../lib/news-artists';
import { assessNewsRelevance } from '../lib/news-relevance';
import { isMusicPublicationUrl } from '../lib/news-sources';
import { findCityByName } from '../lib/visitor-cities';

loadEnvConfig(process.cwd());

/**
 * Publishes the artist roster the news gate reads, as a committed file.
 *
 *   npm run news:roster            # rebuild and write lib/news-artist-roster.json
 *   npm run news:roster -- --dry   # report only
 *
 * Why a file. The gate's blind spot is that an artist's name is not a music
 * word: "Lindsey Buckingham shares update about Stevie Nicks" scores zero against
 * every vocabulary list, and the only evidence that resolves it is knowing who
 * those people are. The site already knows — the charts and the tour feed — but
 * reading them at request time made ingest pay for a query, and made a purge run
 * depend on whatever the tables held that evening. A generated, reviewed file
 * makes the same roster available to both, and every change to it is a diff.
 *
 * Three sources, in order of trust:
 *
 * 1. **Chart artists** (`songs.artist_name`) — curated by the chart ingest.
 * 2. **Tour artists** (`koncerti.artist_name`) — whoever has dates on sale.
 * 3. **Names already in published headlines**. This is the growth path, and the
 *    riskiest, so it is bounded: two or three capitalised words, no music
 *    vocabulary, no sentence scaffolding, and it must appear in **two different
 *    stories** before it is believed. A one-off phrase is a phrase; a name that
 *    turns up twice is a person the desk writes about.
 */

const OUTPUT_PATH = path.join(process.cwd(), 'lib', 'news-artist-roster.json');
const PAGE_SIZE = 1000;
const MAX_NEWS_ROWS = 40_000;
/**
 * How many different stories must name a phrase before it is believed.
 *
 * Two was not enough: it let through "Country Singer", "Southeast Asia" and
 * "Total Eclipse", each of which is a phrase two desks happened to write in the
 * same week. Three still catches real artists — a working musician appears in far
 * more than three stories over a year of feed — and cuts the generic noun phrases
 * that made the first run of this script unusable.
 */
const MIN_TITLE_ROWS = 3;

/**
 * Words that are never a person's name, even capitalised. Two lists: English
 * scaffolding that starts sentences ("Why", "Inside", "Watch") and music
 * vocabulary that is part of a headline rather than the subject of it — indexing
 * "New Album" as an artist would make every album story pass the gate.
 */
const REJECTED_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'from',
  'with', 'without', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'has',
  'have', 'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'do',
  'does', 'did', 'not', 'no', 'yes', 'you', 'your', 'our', 'my', 'his', 'her',
  'their', 'its', 'they', 'them', 'he', 'she', 'it', 'we', 'us', 'i', 'this',
  'that', 'these', 'those', 'what', 'when', 'where', 'why', 'how', 'who', 'which',
  'all', 'any', 'more', 'most', 'new', 'now', 'here', 'there', 'then', 'than',
  'first', 'last', 'next', 'best', 'top', 'big', 'biggest', 'good', 'great',
  'after', 'before', 'over', 'under', 'into', 'out', 'up', 'down', 'off', 'again',
  // Music vocabulary — part of the headline, not the artist.
  'album', 'albums', 'song', 'songs', 'single', 'tour', 'tours', 'dates', 'show',
  'shows', 'concert', 'concerts', 'festival', 'festivals', 'music', 'video',
  'videos', 'track', 'tracks', 'record', 'records', 'ep', 'lp', 'mixtape',
  'grammy', 'grammys', 'award', 'awards', 'chart', 'charts', 'billboard',
  // Editorial scaffolding.
  'review', 'reviews', 'interview', 'exclusive', 'breaking', 'report', 'reports',
  'watch', 'listen', 'inside', 'update', 'updates', 'news', 'live', 'announces',
  'announced', 'reveals', 'revealed', 'shares', 'drops', 'adds', 'confirms',
  'world', 'cup', 'prime', 'minister', 'president', 'ceo', 'company', 'court',
  'police', 'government', 'season', 'episode', 'final', 'week', 'day', 'year',
  // Descriptions of people and places that a headline capitalises.
  'dj', 'singer', 'rapper', 'band', 'star', 'producer', 'drummer', 'guitarist',
  'release', 'debut', 'comeback', 'reunion', 'tribute', 'edition', 'vol',
  'north', 'south', 'east', 'west', 'southeast', 'northeast', 'america',
  'american', 'asia', 'asian', 'europe', 'european', 'africa', 'british',
  'english', 'french', 'german', 'italian', 'spanish', 'king', 'prince',
  'park', 'city', 'county', 'state', 'street', 'avenue', 'total', 'songbook',
  'staff', 'picks', 'notes', 'premiere', 'jr', 'sr', 'jr.', 'sr.', 'exclusive',
]);

function wordsOf(value: string): string[] {
  return value
    // `Ariana Grande’s` must give the name, not a name ending in `s` — the first
    // run of this script indexed "ariana grande s", which matches nothing.
    .replace(/[’']s\b/gi, '')
    .replace(/[“”„"«»]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function isNameWord(word: string): boolean {
  if (!/^[\p{Lu}][\p{L}'’.&-]*$/u.test(word)) return false;
  const plain = word.replace(/[^\p{L}]/gu, '');
  if (plain.length < 2) return false;
  return !REJECTED_WORDS.has(plain.toLowerCase());
}

/**
 * Two- and three-word capitalised runs from a headline. Single words are left
 * out on purpose: `JAŸ-Z` and `Adele` are real, but so are "Tour", "Festival"
 * and every sentence-initial verb, and a single word carries no shape to filter
 * on. Chart and tour data cover the one-word names.
 */
function candidateRuns(title: string): string[] {
  const words = wordsOf(title);
  const runs = new Set<string>();

  for (let start = 0; start < words.length; start += 1) {
    if (!isNameWord(words[start])) continue;

    for (let length = 2; length <= 3 && start + length <= words.length; length += 1) {
      const slice = words.slice(start, start + length);
      if (!slice.every(isNameWord)) break;
      if (slice.every((word) => word.replace(/[^\p{L}]/gu, '').length <= 3)) continue;

      runs.add(slice.join(' '));
    }
  }

  return Array.from(runs);
}

type NewsRow = { id: string | number; title: string | null; url: string | null; category: string | null };

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const dry = process.argv.includes('--dry');

  const existing = (() => {
    try {
      return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) as { names?: string[] };
    } catch {
      return { names: [] as string[] };
    }
  })();

  const chart = new Set<string>();
  const tour = new Set<string>();

  const { data: songs } = await supabase.from('songs').select('artist_name').limit(20_000);
  for (const row of (songs || []) as Array<{ artist_name: string | null }>) {
    if (row.artist_name?.trim()) chart.add(row.artist_name.trim());
  }

  const { data: concerts } = await supabase.from('koncerti').select('artist_name').limit(20_000);
  for (const row of (concerts || []) as Array<{ artist_name: string | null }>) {
    if (row.artist_name?.trim()) tour.add(row.artist_name.trim());
  }

  /**
   * Headline harvest. Only stories the vocabulary gate already accepts are read,
   * so the harvest inherits the editorial judgement that is already in force —
   * an artist name scraped from a story about tariffs would be a name learned
   * from a mistake.
   */
  const rowIdsByName = new Map<string, Set<string>>();
  let scanned = 0;
  let accepted = 0;

  for (let offset = 0; offset < MAX_NEWS_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, url, category')
      .eq('ai_status', 'generated')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read news rows: ${error.message}`);

    const rows = (data || []) as NewsRow[];
    scanned += rows.length;

    for (const row of rows) {
      if (!row.title?.trim()) continue;

      const trusted = isMusicPublicationUrl(row.url);
      const verdict = assessNewsRelevance(
        { title: row.title, url: row.url },
        trusted ? 'music-publication' : 'news-api',
      );

      if (!verdict.relevant && !trusted) continue;
      accepted += 1;

      for (const run of candidateRuns(row.title)) {
        const key = normalizeArtistText(run);
        if (!key) continue;

        const bucket = rowIdsByName.get(key);
        if (bucket) bucket.add(String(row.id));
        else rowIdsByName.set(key, new Set([String(row.id)]));
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  const harvested = new Map<string, string>();
  const rejectedAsPlace: string[] = [];

  for (const [key, ids] of rowIdsByName) {
    if (ids.size < MIN_TITLE_ROWS) continue;
    if (chart.has(key) || tour.has(key)) continue;

    /**
     * A place name capitalises exactly like a person's, and "Los Angeles" in the
     * roster would let any Los Angeles story through the gate as if it named an
     * artist. The gazetteer built for the visitor lookup already knows every city
     * above 15,000 people, so it answers this for free.
     */
    if (findCityByName(key)) {
      rejectedAsPlace.push(key);
      continue;
    }

    harvested.set(key, key);
  }

  const names = new Set<string>();
  for (const name of [...chart, ...tour, ...harvested.keys()]) {
    const trimmed = name.trim();
    if (trimmed) names.add(trimmed);
  }

  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b));

  const payload = {
    source: 'MusicTop chart + tour feed, plus names repeated across accepted headlines',
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { chart: chart.size, tour: tour.size, headlines: harvested.size, total: sorted.length },
    names: sorted,
  };

  const samples = Array.from(harvested.keys()).slice(0, 40);

  console.log(JSON.stringify({
    event: 'artist_roster_built',
    dry,
    newsRowsScanned: scanned,
    newsRowsAccepted: accepted,
    chart: chart.size,
    tour: tour.size,
    headlineNames: harvested.size,
    previousTotal: Array.isArray(existing.names) ? existing.names.length : 0,
    total: sorted.length,
    headlineSample: samples,
  }, null, 2));

  if (dry) {
    console.log('Report only. Re-run without --dry to write the roster.');
    return;
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 0)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
}

main().catch((error: unknown) => {
  console.error('Artist roster build failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
