import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

/**
 * Removes the shared stock photograph from OFFICIAL rows that still carry it.
 *
 *   npm run news:clear-placeholder-image            # report only
 *   npm run news:clear-placeholder-image -- --apply # clear the field
 *
 * Every scraped row used to be stored with the same Unsplash image, so the feed
 * showed one photograph across dozens of unrelated publishers and each detail
 * page had a hero that belonged to no story. The scraper now reads the listing's
 * own picture and writes nothing when there is none; this is the backfill for
 * everything already stored.
 *
 * The field is set to an empty string rather than null: the column's nullability
 * is not guaranteed by the schema in this repo, and every reader already treats a
 * falsy `image` as "no picture" (`article.image && <img …>` on the detail page,
 * `item.image || fallback` in the feed). Empty is the shape the readers expect.
 */

const PLACEHOLDER = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745';
const CHUNK = 100;

type Row = { id: string | number; title: string | null; image: string | null };

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const apply = process.argv.includes('--apply');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows: Row[] = [];
  const PAGE = 1000;

  for (let offset = 0; offset < 60_000; offset += PAGE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, image')
      .eq('category', 'OFFICIAL')
      .eq('image', PLACEHOLDER)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Could not read OFFICIAL rows: ${error.message}`);

    const page = (data || []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  console.log(JSON.stringify({
    event: 'official_placeholder_image',
    apply,
    rows: rows.length,
    sample: rows.slice(0, 12).map((row) => String(row.title || '').slice(0, 80)),
  }, null, 2));

  if (!apply) {
    console.log('Report only. Re-run with --apply to clear the field on these rows.');
    return;
  }

  let updated = 0;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const ids = rows.slice(start, start + CHUNK).map((row) => row.id);
    const { error, count } = await supabase
      .from('news')
      .update({ image: '' }, { count: 'exact' })
      .in('id', ids);

    if (error) throw new Error(`Could not clear image on news rows: ${error.message}`);
    updated += count ?? ids.length;
  }

  console.log(JSON.stringify({ event: 'official_placeholder_image_cleared', updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Clearing the OFFICIAL placeholder image failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
