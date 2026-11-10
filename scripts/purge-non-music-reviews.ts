import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { isOffTopicJunk } from '../lib/news-relevance';

loadEnvConfig(process.cwd());

/**
 * Takes the non-music items off the reviews page without deleting them.
 *
 * The reviews page has no category of its own: it selects every news row whose
 * title contains "review" or "interview". The table holds only LATEST and
 * OFFICIAL rows, so that is what it draws from — which is how "GAME REVIEW #8:
 * Wolves vs. Bucks game thread" and a Call of Duty review were published as music
 * criticism.
 *
 * The script applies the same selection, judges each row with `isOffTopicJunk`
 * (hard-blocked subject, or no music evidence plus off-topic evidence), and stamps
 * the failures `skipped`. Nothing is deleted, so a wrong call is reversible.
 *
 *   npm run reviews:purge              # report only
 *   npm run reviews:purge -- --apply   # stamp them
 */

const PAGE_SIZE = 1_000;
const MAX_ROWS = 5_000;

interface ReviewRow {
  id: string | number;
  title: string | null;
  excerpt: string | null;
  content: string | null;
  url: string | null;
  category: string | null;
  ai_status: string | null;
  ai_content: string | null;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const apply = process.argv.includes('--apply');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows: ReviewRow[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, excerpt, content, url, category, ai_status, ai_content')
      // The exact selection the reviews page makes.
      .or('title.ilike.%review%,title.ilike.%interview%')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read review rows: ${error.message}`);
    const page = (data || []) as ReviewRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  /**
   * Judged on the headline, which is what the reviews page shows.
   *
   * The excerpt cannot be read here: a film review's summary mentions its
   * soundtrack, so including it rescues exactly the rows that must go. The cost
   * is a story whose headline names only the artist and calls itself a
   * documentary — a handful of those are re-queued by hand after the run.
   */
  const rejected = rows.filter(
    (row) => row.ai_status !== 'skipped' && isOffTopicJunk({ title: row.title }),
  );

  const byCategory: Record<string, number> = {};
  for (const row of rejected) {
    const category = String(row.category || 'null');
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  console.log(JSON.stringify({
    event: 'reviews_purge',
    apply,
    scanned: rows.length,
    alreadySkipped: rows.filter((row) => row.ai_status === 'skipped').length,
    wouldSkip: rejected.length,
    byCategory,
  }, null, 2));

  for (const row of rejected.slice(0, 25)) {
    console.log(`- [${row.category}] ${String(row.title || '').slice(0, 95)}`);
  }

  /**
   * Undo half: a row this rule would keep but that is already `skipped` was
   * marked under an older, buggier version of the rule (the word "shares" alone
   * used to count as stock-market evidence, which caught every "artist shares new
   * single" headline). Restoring it re-queues it if it has no brief yet.
   */
  if (process.argv.includes('--restore')) {
    const restored = rows.filter(
      (row) => row.ai_status === 'skipped' && !isOffTopicJunk({ title: row.title, excerpt: row.excerpt }),
    );

    for (const row of restored) {
      const { error } = await supabase
        .from('news')
        .update({ ai_status: row.ai_content ? 'generated' : 'pending' })
        .eq('id', row.id);

      if (error) throw new Error(`Could not restore "${row.title}": ${error.message}`);
      console.log(`restored: ${String(row.title || '').slice(0, 90)}`);
    }

    console.log(JSON.stringify({ event: 'reviews_restored', restored: restored.length }, null, 2));
    return;
  }

  if (!apply) {
    console.log('Report only. Re-run with --apply to stamp these rows as skipped.');
    return;
  }

  let updated = 0;
  const ids = rejected.map((row) => row.id);
  const UPDATE_CHUNK = 100;

  for (let start = 0; start < ids.length; start += UPDATE_CHUNK) {
    const chunk = ids.slice(start, start + UPDATE_CHUNK);
    const { error, count } = await supabase
      .from('news')
      .update({ ai_status: 'skipped' }, { count: 'exact' })
      .in('id', chunk);

    if (error) throw new Error(`Could not mark review rows as skipped: ${error.message}`);
    updated += count ?? chunk.length;
  }

  console.log(JSON.stringify({ event: 'reviews_purged', updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Reviews purge failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
