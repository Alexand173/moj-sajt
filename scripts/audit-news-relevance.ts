import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { assessNewsRelevance } from '../lib/news-relevance';

loadEnvConfig(process.cwd());

/**
 * Reports what the ingest relevance gate would keep and drop, without writing
 * anything.
 *
 *   npm run news:relevance              # last 7 days
 *   npm run news:relevance -- --days=30 --limit=500
 *
 * It reads the rows already in the table, so it answers two questions at once:
 * whether the gate is too strict for real music stories, and how much of the
 * existing backlog it would have refused. Rows already rewritten are included,
 * because the point is the headline, not the enrichment state.
 */

function readNumberFlag(flag: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) return undefined;

  const parsed = Number.parseInt(argument.slice(flag.length + 1), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const days = readNumberFlag('--days') ?? 7;
  const limit = readNumberFlag('--limit') ?? 200;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('news')
    .select('id, title, excerpt, content, url, category, ai_status')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not read news rows: ${error.message}`);

  const rows = data || [];
  const rejected = rows
    .map((row) => ({
      row,
      verdict: assessNewsRelevance(
        {
          title: row.title,
          excerpt: row.excerpt,
          content: row.content,
          url: row.url,
        },
        // Mirrors the ingest paths: scraper rows come from a curated list of
        // music publications, NewsAPI rows come from a general firehose.
        row.category === 'OFFICIAL' ? 'music-publication' : 'news-api',
      ),
    }))
    .filter((entry) => !entry.verdict.relevant);

  const byReason = new Map<string, number>();
  for (const entry of rejected) {
    const reason = entry.verdict.hardBlock
      || `score ${entry.verdict.musicScore} vs ${entry.verdict.offTopicScore}`;
    byReason.set(reason, (byReason.get(reason) || 0) + 1);
  }

  console.log(JSON.stringify({
    event: 'news_relevance_audit',
    windowDays: days,
    sampled: rows.length,
    kept: rows.length - rejected.length,
    wouldReject: rejected.length,
    reasons: Object.fromEntries(byReason),
  }, null, 2));

  for (const entry of rejected.slice(0, 25)) {
    console.log(
      `- [${entry.row.category} ${entry.row.ai_status ?? 'null'}] ${String(entry.row.title || '').slice(0, 90)}`
      + `  <${entry.verdict.hardBlock || `${entry.verdict.musicScore}/${entry.verdict.offTopicScore}`}>`,
    );
  }
}

main().catch((error: unknown) => {
  console.error('Relevance audit failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
