import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { assessNewsRelevance, type RelevancePolicy } from '../lib/news-relevance';

loadEnvConfig(process.cwd());

/**
 * Explains the verdicts behind a handful of headlines, term by term, so the
 * relevance gate can be tuned against real stories instead of intuition.
 *
 *   npm run news:gate -- "Leonard Cohen"
 *   npm run news:gate -- "Suno" --days=90
 *
 * It also probes NewsAPI once, because a silent ingest failure and an
 * over-strict gate look identical from the feed: no new LATEST rows.
 */

function readFlagValue(flag: string): string | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  return argument ? argument.slice(flag.length + 1) : undefined;
}

function readTerm(): string | undefined {
  return process.argv.slice(2).find((value) => !value.startsWith('--'));
}

async function probeNewsApi(): Promise<void> {
  const apiKey = process.env.NEWS_API_KEY?.trim();
  if (!apiKey) {
    console.log('NEWS_API_KEY is not set; skipping the provider probe.');
    return;
  }

  const startedAt = Date.now();
  const response = await fetch(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent('music tour')}&language=en&pageSize=1&sortBy=publishedAt&apiKey=${apiKey}`,
    { cache: 'no-store' },
  );
  const payload = (await response.json().catch(() => null)) as
    | { status?: string; code?: string; message?: string; totalResults?: number }
    | null;

  console.log(JSON.stringify({
    event: 'newsapi_probe',
    httpStatus: response.status,
    status: payload?.status,
    code: payload?.code,
    message: payload?.message,
    totalResults: payload?.totalResults,
    elapsedMs: Date.now() - startedAt,
  }, null, 2));
}

async function main(): Promise<void> {
  const term = readTerm();
  const days = Number.parseInt(readFlagValue('--days') || '60', 10);

  if (!term) {
    await probeNewsApi();
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('news')
    .select('id, title, excerpt, content, url, category, region, created_at')
    .ilike('title', `%${term}%`)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Could not read news rows: ${error.message}`);

  const rows = data || [];
  if (rows.length === 0) {
    console.log(`No rows matching "${term}" in the last ${days} days.`);
    return;
  }

  for (const row of rows) {
    const policy: RelevancePolicy = row.category === 'OFFICIAL' ? 'music-publication' : 'news-api';
    const verdict = assessNewsRelevance(
      { title: row.title, excerpt: row.excerpt, content: row.content, url: row.url },
      policy,
    );

    console.log(JSON.stringify({
      title: row.title,
      category: row.category,
      region: row.region,
      policy,
      relevant: verdict.relevant,
      musicScore: verdict.musicScore,
      offTopicScore: verdict.offTopicScore,
      hardBlock: verdict.hardBlock,
      matchedMusic: verdict.matchedMusic,
      matchedOffTopic: verdict.matchedOffTopic,
      excerpt: String(row.excerpt || '').slice(0, 160),
    }, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error('Gate diagnosis failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
