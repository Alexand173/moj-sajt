import { resolveConcertCity } from '@/lib/concert-city';
import type { GeoLocation } from '@/lib/geo-location';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { generisiAffiliateLink } from '@/lib/ticket-affiliate';

/**
 * Events the visitor can realistically get to, for the "near you" rail on the
 * tickets hub.
 *
 * The region is the coarse slice — it is the same key the `/tickets/<region>`
 * pages use, so the rail always agrees with the region page it links into. The
 * city from the IP lookup only reorders the result: a city-level guess is right
 * often enough to be worth surfacing first, but never trusted enough to hide
 * dates in the rest of the region.
 */

export type NearbyEvent = {
  id: string;
  artist: string;
  imageUrl: string | null;
  venue: string | null;
  city: string | null;
  /** ISO timestamp of the show. */
  date: string;
  ticketUrl: string | null;
  region: string | null;
};

type ConcertRow = {
  id: string | number;
  region: string | null;
  artist_name: string | null;
  image_url: string | null;
  date: string | null;
  location: string | null;
  city: string | null;
  ticket_link: string | null;
};

const ROW_LIMIT = 800;
const RESULT_LIMIT = 12;

/**
 * `date` is stored as `YYYY-MM-DD` with no time, so comparing it to `Date.now()`
 * would drop a show the moment its UTC midnight passed. A date counts as upcoming
 * until the visitor's day is over, which is how the rest of the ticket code reads it.
 */
function isUpcoming(value: string | null): boolean {
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return timestamp >= startOfToday;
}

function comparableCity(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Today as `YYYY-MM-DD` in the server's timezone — the format `date` is stored in. */
function todayDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

async function loadRows(region: string | null) {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return [];

  try {
    // Filter and order in Postgres: the row budget should be spent on upcoming
    // dates, not on whatever the table happens to return first.
    let query = supabase
      .from('koncerti')
      .select('id, region, artist_name, image_url, date, location, city, ticket_link')
      .gte('date', todayDate());

    if (region) query = query.ilike('region', region);

    const { data, error } = await query.order('date', { ascending: true }).limit(ROW_LIMIT);
    if (error) {
      console.warn('Could not load nearby events:', error.message);
      return [];
    }

    return (data || []) as ConcertRow[];
  } catch (error) {
    console.warn('Could not load nearby events:', error);
    return [];
  }
}

/**
 * One card per artist — a rail of twelve nights from the same tour would say less
 * than twelve different shows — with the visitor's own city first, then the
 * soonest dates.
 */
function toEvents(rows: ConcertRow[], nearCity: string | null): NearbyEvent[] {
  const nearKey = comparableCity(nearCity);

  const ranked = rows
    .filter((row) => Boolean(row.artist_name?.trim()) && isUpcoming(row.date))
    .map((row) => {
      const city = resolveConcertCity(row.city, row.location);
      const isNear = Boolean(nearKey) && comparableCity(city) === nearKey;
      return { row, city, isNear, timestamp: new Date(row.date as string).getTime() };
    })
    .sort((a, b) => Number(b.isNear) - Number(a.isNear) || a.timestamp - b.timestamp);

  const seen = new Set<string>();
  const events: NearbyEvent[] = [];

  for (const entry of ranked) {
    const artist = (entry.row.artist_name as string).trim();
    const key = comparableCity(artist);
    if (seen.has(key)) continue;

    seen.add(key);
    events.push({
      id: String(entry.row.id),
      artist,
      imageUrl: entry.row.image_url || null,
      venue: entry.row.location?.trim() || null,
      city: entry.city,
      date: entry.row.date as string,
      ticketUrl: entry.row.ticket_link ? generisiAffiliateLink(entry.row.ticket_link) : null,
      region: entry.row.region?.trim().toLowerCase() || null,
    });

    if (events.length >= RESULT_LIMIT) break;
  }

  return events;
}

export async function getNearbyEvents(location: Pick<GeoLocation, 'city' | 'regionKey'> | null): Promise<NearbyEvent[]> {
  const region = location?.regionKey && location.regionKey !== 'world' ? location.regionKey : null;
  const nearby = toEvents(await loadRows(location?.regionKey ?? null), location?.city ?? null);
  if (nearby.length > 0) return nearby;

  // A thin region feed should still fill the rail, so widen to every region
  // rather than shipping an empty section.
  if (region) return toEvents(await loadRows(null), null);

  return [];
}
