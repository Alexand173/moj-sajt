import { cache } from 'react';
import { getTicketRegionLabel } from '@/lib/region-navigation';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { isLiveTourDate } from '@/lib/tour-profile';
import { normalizeArtistIdentity } from '@/lib/tour-profile-core';

export { getTicketRegionLabel };

/** Rows read from the `koncerti` table, narrowed to what the ticket surfaces need. */
export type ConcertRegionRow = {
  region: string | null;
  artist_name: string | null;
  date: string | null;
};

export type TicketRegionSummary = {
  region: string;
  /** Display label used in headings and breadcrumbs: `the UK`, `US`, `EUROPA`. */
  label: string;
  /** Artists with at least one date still on sale. */
  artistCount: number;
  /** Earliest date on sale as an ISO string; null when no date could be parsed. */
  nextDate: string | null;
};

/** Region order used by the header navigation, so the hub reads the same way. */
export const TICKET_REGION_ORDER = ['us', 'uk', 'europa', 'latino', 'asia', 'world', 'jazz', 'classical'] as const;

const CONCERT_ROW_LIMIT = 10000;

/**
 * Single read of `koncerti` shared by the tickets hub and the sitemap. Every
 * ticket surface derives its regions from this, so the hub, the breadcrumbs and
 * the sitemap cannot drift apart.
 */
export const loadConcertRegionRows = cache(async (): Promise<ConcertRegionRow[]> => {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('koncerti')
      .select('region, artist_name, date')
      .limit(CONCERT_ROW_LIMIT);

    if (error) {
      console.warn('Could not load concert rows for the ticket regions:', error.message);
      return [];
    }

    const rows = (data || []) as ConcertRegionRow[];
    if (rows.length >= CONCERT_ROW_LIMIT) {
      console.warn(`koncerti returned ${CONCERT_ROW_LIMIT} rows (the query cap); some regions may be missing.`);
    }

    return rows;
  } catch (error) {
    console.warn('Could not load concert rows for the ticket regions:', error);
    return [];
  }
});

/**
 * Regions that currently sell tickets, counting only artists whose dates are
 * still ahead. Sorted by the header's region order first, then by volume.
 */
export const getTicketRegionSummaries = cache(async (): Promise<TicketRegionSummary[]> => {
  const rows = await loadConcertRegionRows();
  const byRegion = new Map<string, { artists: Set<string>; next: number | null }>();

  for (const row of rows) {
    const region = row.region?.trim().toLowerCase();
    const artistName = row.artist_name?.trim();
    if (!region || !artistName || !isLiveTourDate(row.date)) continue;

    const entry = byRegion.get(region) ?? { artists: new Set<string>(), next: null };
    byRegion.set(region, entry);
    entry.artists.add(normalizeArtistIdentity(artistName) || artistName.toLowerCase());

    const timestamp = new Date(row.date as string).getTime();
    if (Number.isFinite(timestamp) && (entry.next === null || timestamp < entry.next)) {
      entry.next = timestamp;
    }
  }

  const orderIndex = (region: string) => {
    const index = TICKET_REGION_ORDER.indexOf(region as (typeof TICKET_REGION_ORDER)[number]);
    return index === -1 ? TICKET_REGION_ORDER.length : index;
  };

  return Array.from(byRegion.entries())
    .map(([region, entry]) => ({
      region,
      label: getTicketRegionLabel(region),
      artistCount: entry.artists.size,
      nextDate: entry.next === null ? null : new Date(entry.next).toISOString(),
    }))
    .sort((a, b) => orderIndex(a.region) - orderIndex(b.region)
      || b.artistCount - a.artistCount
      || a.region.localeCompare(b.region));
});
