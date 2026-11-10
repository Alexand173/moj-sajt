import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

/**
 * Reports how new news is distributed, so the ingest quotas can be set against
 * real numbers instead of guesses. Read-only.
 *
 *   npm run news:balance               # last 14 days
 *   npm run news:balance -- --days=30
 *
 * It answers the three questions the publisher asked: is LATEST and OFFICIAL
 * arriving in similar volume, does every region receive a similar amount each
 * day, and does each region page end up with a similar mix of the two.
 */

const PAGE_SIZE = 1_000;

interface BalanceRow {
  id: string | number;
  category: string | null;
  region: string | null;
  created_at: string;
  ai_status: string | null;
  ai_generated: boolean | null;
  url: string | null;
}

function readNumberFlag(flag: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) return undefined;

  const parsed = Number.parseInt(argument.slice(flag.length + 1), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function loadRows(days: number): Promise<BalanceRow[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows: BalanceRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('id, category, region, created_at, ai_status, ai_generated, url')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read news rows: ${error.message}`);
    const page = (data || []) as BalanceRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function tally(rows: BalanceRow[], keyOf: (row: BalanceRow) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyOf(row);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function main(): Promise<void> {
  const days = readNumberFlag('--days') ?? 14;
  const rows = await loadRows(days);

  const latest = rows.filter((row) => row.category === 'LATEST');
  const official = rows.filter((row) => row.category === 'OFFICIAL');
  const published = rows.filter((row) => row.ai_generated === true && row.ai_status === 'generated');
  const sourcelessFallbacks = rows.filter(
    (row) => row.ai_status === 'fallback' && !String(row.url || '').trim(),
  );

  const latestByDay = tally(latest, (row) => dayKey(row.created_at));
  const officialByDay = tally(official, (row) => dayKey(row.created_at));
  const latestByRegion = tally(latest, (row) => String(row.region || 'null'));
  const officialByRegion = tally(official, (row) => String(row.region || 'null'));
  const publishedByRegionCategory = tally(
    published,
    (row) => `${row.region || 'null'}:${row.category || 'null'}`,
  );

  console.log(JSON.stringify({
    event: 'news_balance_audit',
    windowDays: days,
    rows: rows.length,
    latest: latest.length,
    official: official.length,
    published: published.length,
    sourcelessFallbacks: sourcelessFallbacks.length,
    sourcelessFallbacksByCategory: tally(sourcelessFallbacks, (row) => String(row.category || 'null')),
    meanPerDay: {
      latest: Number((latest.length / days).toFixed(1)),
      official: Number((official.length / days).toFixed(1)),
    },
  }, null, 2));

  console.log('\nDay        LATEST  OFFICIAL');
  const daysSeen = Array.from(new Set([...Object.keys(latestByDay), ...Object.keys(officialByDay)])).sort();
  for (const day of daysSeen) {
    console.log(
      `${day}  ${String(latestByDay[day] || 0).padStart(6)}  ${String(officialByDay[day] || 0).padStart(8)}`,
    );
  }

  console.log('\nRegion      LATEST  OFFICIAL  PUBLISHED L/O');
  const regions = Array.from(new Set([...Object.keys(latestByRegion), ...Object.keys(officialByRegion)])).sort();
  for (const region of regions) {
    console.log(
      `${region.padEnd(10)}  ${String(latestByRegion[region] || 0).padStart(6)}  `
      + `${String(officialByRegion[region] || 0).padStart(8)}  `
      + `${String(publishedByRegionCategory[`${region}:LATEST`] || 0).padStart(6)}/`
      + `${String(publishedByRegionCategory[`${region}:OFFICIAL`] || 0).padStart(6)}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error('Balance audit failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
