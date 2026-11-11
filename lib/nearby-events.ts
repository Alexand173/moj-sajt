import { getCityCoordinates } from '@/lib/city-coordinates';
import { resolveConcertCity } from '@/lib/concert-city';
import { haversineKm, parseCoordinate, type Coordinate } from '@/lib/geo-distance';
import type { GeoLocation } from '@/lib/geo-location';
import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { generisiAffiliateLink } from '@/lib/ticket-affiliate';

/**
 * Events the visitor can realistically get to, for the "near you" rail on the
 * tickets hub.
 *
 * The region is the coarse slice — it is the same key the `/tickets/<region>`
 * pages use, so the rail always agrees with the region page it links into — and
 * the ranking is proximity: the visitor's own city first, then ascending
 * great-circle distance, with the soonest date only breaking ties. An IP lookup
 * is good enough to sort by, never good enough to hide dates behind, which is why
 * the region still supplies the pool.
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
  /** Air distance from the visitor, rounded to whole kilometres; null when unknown. */
  distanceKm: number | null;
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

/**
 * The board lists every date in the region, so the pool has to hold them all.
 * The ranker can only order what it loaded, and the pool arrives ordered by
 * date rather than by where the visitor is.
 *
 * 300 was too small to be honest about distance — a visitor in Mason City was
 * competing against the soonest 300 dates in the whole US region, so a show two
 * hours away could be pushed out by a show in Florida a month earlier. 1,200
 * narrow rows is still one indexed range query, and it covers every region's
 * on-sale count several times over.
 */
const ROW_LIMIT = 1200;

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

/** A row resolved far enough to be ranked; free of Supabase types so it can be tested. */
export type NearbyCandidate<T> = {
  item: T;
  city: string | null;
  artist: string;
  date: string;
  distanceKm: number | null;
  /** True when the show is in the visitor's own city. */
  isLocal: boolean;
};

const UNKNOWN_DISTANCE = Number.POSITIVE_INFINITY;

/**
 * Local first, then nearest, then soonest. A local show keeps its place even when
 * the IP centroid and the city centroid differ by a few kilometres, because the
 * city name matching is the stronger signal. Unknown distances sort last: a city
 * we could not place is not a city next door.
 */
export function compareNearbyCandidates<T>(a: NearbyCandidate<T>, b: NearbyCandidate<T>): number {
  if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;

  const aDistance = a.distanceKm ?? UNKNOWN_DISTANCE;
  const bDistance = b.distanceKm ?? UNKNOWN_DISTANCE;
  if (aDistance !== bDistance) return aDistance < bDistance ? -1 : 1;

  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.artist.localeCompare(b.artist);
}

export function orderNearby<T>(candidates: NearbyCandidate<T>[]): NearbyCandidate<T>[] {
  return [...candidates].sort(compareNearbyCandidates);
}

/** What the ranking needs to know about the visitor. */
export type NearbyViewer = {
  city: string | null;
  coordinate: Coordinate | null;
};

/**
 * Every date in the region, ordered by how close the show is.
 *
 * The board used to show twelve rows, one per artist, with the visitor's own
 * city capped at half of them. That is the right shape for a rail of cards and
 * the wrong one for a board people scroll: a visitor in Belgrade could not see
 * the eleventh Belgrade date, and a tour with three nights in one city was cut
 * to one. Ordering is the only rule now — the nearest city first, then distance,
 * then the sooner date — and the list runs as far as the region does.
 */
function toEvents(rows: ConcertRow[], viewer: NearbyViewer): NearbyEvent[] {
  const nearKey = comparableCity(viewer.city);

  const ranked = orderNearby(
    rows
      .filter((row) => Boolean(row.artist_name?.trim()) && isUpcoming(row.date))
      .map((row) => {
        const city = resolveConcertCity(row.city, row.location);
        const isLocal = Boolean(nearKey) && comparableCity(city) === nearKey;
        const cityCoordinate = getCityCoordinates(city);
        const distanceKm = isLocal
          ? 0
          : viewer.coordinate && cityCoordinate
            ? Math.round(haversineKm(viewer.coordinate, cityCoordinate))
            : null;

        return {
          item: row,
          city,
          artist: (row.artist_name as string).trim(),
          date: row.date as string,
          distanceKm,
          isLocal,
        };
      }),
  );

  return ranked.map((entry) => ({
    id: String(entry.item.id),
    artist: entry.artist,
    imageUrl: entry.item.image_url || null,
    venue: entry.item.location?.trim() || null,
    city: entry.city,
    date: entry.date,
    ticketUrl: entry.item.ticket_link ? generisiAffiliateLink(entry.item.ticket_link) : null,
    region: entry.item.region?.trim().toLowerCase() || null,
    distanceKm: entry.distanceKm,
  }));
}

export type NearbyLocation = Pick<GeoLocation, 'city' | 'regionKey' | 'latitude' | 'longitude'>;

function toViewer(location: NearbyLocation | null): NearbyViewer {
  if (!location) return { city: null, coordinate: null };

  return {
    city: location.city ?? null,
    coordinate: parseCoordinate(location.latitude, location.longitude),
  };
}

/**
 * The board for the visitor's own region, and nothing else.
 *
 * A region is what the visitor is shopping in — the row links to that region's
 * page, the city column names cities in it, and a date two continents away is
 * not "nearby" however cheap the flight. So a thin or empty region feed produces
 * the empty state rather than a list filled from everywhere else.
 *
 * A visitor whose country belongs to no region (`world`) has no slice to narrow
 * to, and a visitor no service could place has no region at all; both get the
 * whole feed, ordered by distance when there is a point to measure from.
 */
export async function getNearbyEvents(location: NearbyLocation | null): Promise<NearbyEvent[]> {
  return toEvents(await loadRows(location?.regionKey ?? null), toViewer(location));
}
