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
 * The rail shows 12 cards. The ranker can only order what it loaded, and the
 * nearest date is not always among the soonest dozen, so the pool is wider than
 * the result: 300 upcoming rows of this narrow select is still a cheap query.
 */
const ROW_LIMIT = 300;
const RESULT_LIMIT = 12;

/**
 * Half the rail is enough for the visitor's own city. A visitor in London has
 * hundreds of London dates, and filling all twelve slots with them would hide the
 * nearby cities the distance ordering exists to surface. The remaining slots go to
 * the closest shows elsewhere.
 */
const LOCAL_RESULT_LIMIT = 6;

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

export type NearbyLimits = {
  /** Cards in the rail. */
  total: number;
  /** Cards the visitor's own city may occupy. */
  local: number;
};

/**
 * Picks the rail from an already-ordered candidate list: one card per artist — a
 * rail of twelve nights from the same tour would say less than twelve different
 * shows — and no more than `limits.local` from the visitor's own city.
 */
export function selectNearby<T>(candidates: NearbyCandidate<T>[], limits: NearbyLimits): NearbyCandidate<T>[] {
  const picked: NearbyCandidate<T>[] = [];
  const seenArtists = new Set<string>();
  let locals = 0;

  for (const candidate of candidates) {
    if (picked.length >= limits.total) break;

    const artistKey = comparableCity(candidate.artist);
    if (seenArtists.has(artistKey)) continue;
    if (candidate.isLocal && locals >= limits.local) continue;

    seenArtists.add(artistKey);
    if (candidate.isLocal) locals += 1;
    picked.push(candidate);
  }

  return picked;
}

/**
 * One card per artist, ordered by how close the show is, with the local group
 * capped so nearby cities still make it onto the rail.
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

  return selectNearby(ranked, { total: RESULT_LIMIT, local: LOCAL_RESULT_LIMIT }).map((entry) => ({
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

export async function getNearbyEvents(location: NearbyLocation | null): Promise<NearbyEvent[]> {
  const region = location?.regionKey && location.regionKey !== 'world' ? location.regionKey : null;
  const viewer = toViewer(location);

  const nearby = toEvents(await loadRows(location?.regionKey ?? null), viewer);
  if (nearby.length > 0) return nearby;

  // A thin region feed should still fill the rail, so widen to every region
  // rather than shipping an empty section. The visitor's city stops mattering
  // here, but their coordinates still order the widened pool by distance.
  if (region) return toEvents(await loadRows(null), { city: null, coordinate: viewer.coordinate });

  return [];
}
