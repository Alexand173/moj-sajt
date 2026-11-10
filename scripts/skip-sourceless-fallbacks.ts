import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

/**
 * Removes rows that can never be rewritten from the AI queue.
 *
 * A NewsAPI row whose `url` is null was stored with a truncated snippet and a
 * one-line excerpt. There is no publisher page to fetch and nothing to rewrite,
 * so every retry must fail the same way — yet the retry cooldown keeps putting
 * them back at the head of a repair run, crowding out rows that could succeed.
 *
 * They are stamped `skipped`, which no selector matches, instead of deleted: the
 * row stays auditable and the feed already ignores it (it is not `generated`).
 *
 *   npm run news:skip-sourceless            # report only
 *   npm run news:skip-sourceless -- --apply # stamp them
 */

const PAGE_SIZE = 1_000;

interface SourcelessRow {
  id: string | number;
  title: string | null;
  category: string | null;
  ai_status: string | null;
  url: string | null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const apply = hasFlag('--apply');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows: SourcelessRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, category, ai_status, url')
      .eq('ai_status', 'fallback')
      .or('url.is.null,url.eq.')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read sourceless fallback rows: ${error.message}`);
    const page = (data || []) as SourcelessRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    const category = String(row.category || 'null');
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  console.log(JSON.stringify({
    event: 'news_sourceless_fallbacks',
    apply,
    found: rows.length,
    byCategory,
  }, null, 2));

  for (const row of rows.slice(0, 10)) {
    console.log(`- [${row.category}] ${String(row.title || '').slice(0, 90)}`);
  }

  if (!apply) {
    console.log('Report only. Re-run with --apply to stamp these rows as skipped.');
    return;
  }

  let updated = 0;
  const ids = rows.map((row) => row.id);
  const UPDATE_CHUNK = 100;

  for (let start = 0; start < ids.length; start += UPDATE_CHUNK) {
    const chunk = ids.slice(start, start + UPDATE_CHUNK);
    const { error, count } = await supabase
      .from('news')
      .update({ ai_status: 'skipped' }, { count: 'exact' })
      .in('id', chunk);

    if (error) throw new Error(`Could not mark rows as skipped: ${error.message}`);
    updated += count ?? chunk.length;
  }

  console.log(JSON.stringify({ event: 'news_sourceless_fallbacks_skipped', updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Sourceless fallback cleanup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
