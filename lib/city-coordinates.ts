import coordinates from '@/lib/city-coordinates.json';
import { cityKey } from '@/lib/concert-city';
import type { Coordinate } from '@/lib/geo-distance';

/**
 * Concert city → coordinates, generated once by `npm run cities:coords` and
 * committed. The rail needs a distance for every city in the feed, and calling a
 * geocoder on the request path would add a third-party dependency and a network
 * hop to a page that is otherwise served from cache.
 *
 * Keys are the same normalised form `resolveConcertCity` returns, so `Kraków`,
 * `Krakow` and `KRAKÓW` all land on one entry.
 */

/**
 * JSON imports widen tuples to `number[]`, so the shape is checked at read time
 * rather than asserted here — a hand-edited file cannot slip past the type system.
 */
const TABLE = coordinates as Record<string, number[] | undefined>;

/** Cities are matched by normalised name at most once per process. */
const cache = new Map<string, Coordinate | null>();

export function getCityCoordinates(city: string | null | undefined): Coordinate | null {
  if (!city || !city.trim()) return null;

  const key = cityKey(city);
  if (!key) return null;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const tuple = TABLE[key];
  const coordinate = Array.isArray(tuple) && tuple.length === 2
    && Number.isFinite(tuple[0]) && Number.isFinite(tuple[1])
    ? { latitude: tuple[0] as number, longitude: tuple[1] as number }
    : null;

  cache.set(key, coordinate);
  return coordinate;
}

/** How many cities the checked-in map knows; used by the generator's report. */
export function cityCoordinateCount(): number {
  return Object.keys(TABLE).length;
}
