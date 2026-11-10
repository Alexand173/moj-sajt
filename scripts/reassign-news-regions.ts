import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeNewsRegion } from '../lib/news-regions';
import { getPublisherRegion } from '../lib/news-sources';

loadEnvConfig(process.cwd());

/**
 * Moves stored stories to the channel their publisher belongs to.
 *
 * `region` was the *query* that found a row, not where it is from. The `europa`
 * query is a set of European music phrases, so a US outlet that mentions a
 * European tour lands in `europa` — which is how "Canada to hit U.S. with
 * retaliatory tariffs. And, remembering music legend Dolly Parton", an NPR
 * newsletter, was filed under `europa`.
 *
 * Ingest now resolves the publisher first (`getPublisherRegion`), so no new row
 * misfiles. This backfill applies the same resolver to what is already stored.
 * It only moves a row when the URL places its publisher — an unknown host keeps
 * the channel it has.
 *
 *   npm run news:reassign-regions              # report only
 *   npm run news:reassign-regions -- --apply   # move them
 */

const PAGE_SIZE = 500;
const MAX_ROWS = 60_000;
/** A resolver bug must not be able to reshuffle the whole feed in one command. */
const MAX_APPLY_RATIO = 0.4;

/**
 * Channels whose name is a place. `asia`, `latino`, `jazz`, `classical` and
 * `world` are at least as much *topic* as geography — the Asia channel is built
 * from K-pop queries — so a story there is not misfiled just because its
 * publisher sits in London. Only a move between these three can be called a
 * correction without a human reading the row.
 */
const GEOGRAPHIC_CHANNELS = new Set(['us', 'uk', 'europa']);

interface NewsRow {
  id: string | number;
  url: string | null;
  region: string | null;
  category: string | null;
}

async function loadRows(supabase: SupabaseClient): Promise<NewsRow[]> {
  const rows: NewsRow[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, url, region, category')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read news rows: ${error.message}`);

    const page = (data || []) as NewsRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const apply = process.argv.includes('--apply');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = await loadRows(supabase);

  const moves = rows
    .map((row) => {
      // Named publishers only: a country code says where a newsroom is, not what
      // its music desk writes about.
      const publisherRegion = getPublisherRegion(row.url, { includeTld: false });
      const current = normalizeNewsRegion(row.region || '');

      if (!publisherRegion || !current || publisherRegion === current) return null;
      if (!GEOGRAPHIC_CHANNELS.has(current) || !GEOGRAPHIC_CHANNELS.has(publisherRegion)) return null;

      return { row, from: current, to: publisherRegion };
    })
    .filter((move): move is { row: NewsRow; from: string; to: string } => move !== null);

  const transitions: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const move of moves) {
    const key = `${move.from} -> ${move.to}`;
    transitions[key] = (transitions[key] || 0) + 1;
    const category = String(move.row.category || 'null');
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  const resolved = rows.filter((row) => getPublisherRegion(row.url) !== null).length;

  console.log(JSON.stringify({
    event: 'news_region_reassign',
    apply,
    scanned: rows.length,
    placeableByPublisher: resolved,
    wouldMove: moves.length,
    byCategory,
    transitions: Object.fromEntries(
      Object.entries(transitions).sort((a, b) => b[1] - a[1]).slice(0, 20),
    ),
  }, null, 2));

  for (const move of moves.slice(0, 20)) {
    console.log(`- ${move.from} -> ${move.to}  ${String(move.row.url || '').slice(0, 80)}`);
  }

  if (!apply) {
    console.log('Report only. Re-run with --apply to move these rows.');
    return;
  }

  if (moves.length > resolved * MAX_APPLY_RATIO) {
    throw new Error(
      `Refusing to move ${moves.length} of ${resolved} placeable rows (over ${MAX_APPLY_RATIO * 100}%): `
      + 'that pattern means the resolver is wrong, not the table.',
    );
  }

  const CHUNK = 100;
  let updated = 0;

  for (let start = 0; start < moves.length; start += CHUNK) {
    const chunk = moves.slice(start, start + CHUNK);

    // Grouped by destination, so a chunk is a handful of UPDATEs rather than one
    // per row.
    const byDestination = new Map<string, Array<string | number>>();
    for (const move of chunk) {
      const ids = byDestination.get(move.to) || [];
      ids.push(move.row.id);
      byDestination.set(move.to, ids);
    }

    for (const [region, ids] of byDestination) {
      const { error, count } = await supabase
        .from('news')
        .update({ region }, { count: 'exact' })
        .in('id', ids);

      if (error) throw new Error(`Could not move rows to ${region}: ${error.message}`);
      updated += count ?? ids.length;
    }
  }

  console.log(JSON.stringify({ event: 'news_region_reassigned', updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Region reassignment failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
