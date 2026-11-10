import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Keeps new news arriving in comparable amounts.
 *
 * Measured over 14 days, the two ingest paths drifted far apart and so did the
 * regions: US received 399 LATEST and 384 OFFICIAL rows while WORLD received 129
 * LATEST and zero OFFICIAL, and UK received 7 LATEST against 123 OFFICIAL. On the
 * region page that is not a subtle imbalance — the middle column is nearly empty
 * while the official rail runs for pages.
 *
 * The fix is a per-region, per-category budget shared by both ingest paths: the
 * same number, so the two categories converge, and the same cap for every region,
 * so one busy region cannot consume the day. Supply still decides what is
 * possible — a region whose publishers post twice a day cannot be filled to the
 * cap — but nothing is starved by another region's volume.
 */

export type NewsFeedCategory = 'LATEST' | 'OFFICIAL';

/** Stories each region may receive per category in a rolling day. */
export const DEFAULT_NEWS_DAILY_PER_REGION = 10;
export const MAX_NEWS_DAILY_PER_REGION = 40;
/**
 * Rolling 24 hours rather than a calendar day: it needs no timezone decision and
 * needs no new column. `created_at` is the publication time for publisher rows
 * and the feed's own timestamp for NewsAPI rows, so it is the honest "news of the
 * day" count for both.
 */
const QUOTA_WINDOW_HOURS = 24;
const COUNT_PAGE_SIZE = 1_000;
/** How far the two sides of a region page may drift apart before one is trimmed. */
const FEED_MIX_RATIO = 2;

export function getNewsDailyPerRegion(): number {
  const parsed = Number.parseInt(process.env.NEWS_DAILY_PER_REGION || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_NEWS_DAILY_PER_REGION;

  return Math.min(Math.max(parsed, 1), MAX_NEWS_DAILY_PER_REGION);
}

export function getQuotaWindowStart(now = Date.now()): string {
  return new Date(now - QUOTA_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * How many rows each region already received for this category inside the window.
 * Paged, because a busy region can exceed the 1,000-row response limit.
 */
export async function loadRecentCountByRegion(
  supabase: SupabaseClient,
  category: NewsFeedCategory,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (let offset = 0; ; offset += COUNT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('news')
      .select('region')
      .eq('category', category)
      .gte('created_at', getQuotaWindowStart())
      .order('id', { ascending: true })
      .range(offset, offset + COUNT_PAGE_SIZE - 1);

    if (error) throw new Error(`Could not count recent ${category} rows: ${error.message}`);

    const page = (data || []) as Array<{ region: string | null }>;
    for (const row of page) {
      const region = String(row.region || '').trim().toLowerCase();
      if (region) counts[region] = (counts[region] || 0) + 1;
    }

    if (page.length < COUNT_PAGE_SIZE) break;
  }

  return counts;
}

/** What each region may still accept today, floored at zero. */
export function remainingQuotaByRegion(
  counts: Record<string, number>,
  regions: readonly string[],
  target = getNewsDailyPerRegion(),
): Record<string, number> {
  // Count keys arrive from the database, where a region may be stored as "UK"
  // while the scraper writes "uk". Normalise both sides or a spent allowance
  // silently reads as untouched.
  const normalizedCounts: Record<string, number> = {};
  for (const [region, count] of Object.entries(counts)) {
    normalizedCounts[region.trim().toLowerCase()] = count;
  }

  const remaining: Record<string, number> = {};

  for (const region of regions) {
    const key = region.trim().toLowerCase();
    remaining[key] = Math.max(0, target - (normalizedCounts[key] || 0));
  }

  return remaining;
}

/**
 * Trims a scraped batch to each region's remaining budget. The incoming order is
 * preserved, so the caller decides priority; this only removes what would exceed
 * the region's day.
 */
export function takeWithinQuota<T>(
  items: T[],
  regionOf: (item: T) => string,
  remaining: Record<string, number>,
): { kept: T[]; dropped: Record<string, number> } {
  const used: Record<string, number> = {};
  const dropped: Record<string, number> = {};
  const kept: T[] = [];

  for (const item of items) {
    const region = regionOf(item).trim().toLowerCase();
    const allowance = remaining[region] ?? 0;
    const taken = used[region] || 0;

    if (taken >= allowance) {
      dropped[region] = (dropped[region] || 0) + 1;
      continue;
    }

    used[region] = taken + 1;
    kept.push(item);
  }

  return { kept, dropped };
}

/**
 * Trims a region page's two streams so neither dominates.
 *
 * The page limits each category to 50 rows, but a region with 4 LATEST and 50
 * OFFICIAL stories showed a four-item middle column beside a fifty-item rail.
 * Trimming the longer stream to twice the shorter one keeps the page balanced
 * without throwing away a full feed when both sides are healthy.
 */
export function balanceFeedMix<T>(
  latest: T[],
  official: T[],
  cap = 50,
): { latest: T[]; official: T[] } {
  const shorter = Math.min(latest.length, official.length);

  // One side is empty: trimming the other would leave the page blank, so the
  // healthy stream keeps its full feed and the imbalance is repaired at ingest
  // instead.
  if (shorter === 0) {
    return { latest: latest.slice(0, cap), official: official.slice(0, cap) };
  }

  const allowance = Math.min(cap, shorter * FEED_MIX_RATIO);

  return {
    latest: latest.slice(0, Math.min(latest.length, allowance)),
    official: official.slice(0, Math.min(official.length, allowance)),
  };
}
