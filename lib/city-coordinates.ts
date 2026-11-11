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

/**
 * The feed labels a venue's city however the promoter wrote it, and the table is
 * keyed by the label the first row happened to carry. `Gdańsk/Sopot` and
 * `Gdańsk` are one city; `København S` is Copenhagen; `Merksem (Antwerpen)` is
 * Antwerpen to anyone travelling to a show. Trying the obvious reductions
 * resolves those without a geocoder on the request path and without an alias
 * entry per promoter.
 */
function variantKeys(city: string): string[] {
  const base = city.replace(/\s+/g, ' ').trim();
  const keys = new Set<string>();

  const push = (value: string) => {
    const key = cityKey(value);
    if (key) keys.add(key);
  };

  push(base);
  // `Merksem (Antwerpen)` → `Merksem`, and the parent city the other way round.
  push(base.replace(/\s*\([^)]*\)\s*/g, ' '));
  const parenthetical = /\(([^)]+)\)/.exec(base)?.[1];
  if (parenthetical) push(parenthetical);
  // `Gdańsk/Sopot` → `Gdańsk`.
  push(base.split('/')[0] ?? '');
  // `København S`, `Antwerpen 1`, `Limerick City`.
  push(base.replace(/\s+\d+$/, ''));
  push(base.replace(/\s+\b(City|Stad|Ville|S|N|E|W|V)\b$/, ''));

  return Array.from(keys);
}

export function getCityCoordinates(city: string | null | undefined): Coordinate | null {
  if (!city || !city.trim()) return null;

  const primaryKey = cityKey(city);
  if (!primaryKey) return null;

  const cached = cache.get(primaryKey);
  if (cached !== undefined) return cached;

  let coordinate: Coordinate | null = null;

  for (const key of variantKeys(city)) {
    const tuple = TABLE[key];
    if (!Array.isArray(tuple) || tuple.length !== 2) continue;
    if (!Number.isFinite(tuple[0]) || !Number.isFinite(tuple[1])) continue;

    coordinate = { latitude: tuple[0] as number, longitude: tuple[1] as number };
    break;
  }

  cache.set(primaryKey, coordinate);
  return coordinate;
}

/** How many cities the checked-in map knows; used by the generator's report. */
export function cityCoordinateCount(): number {
  return Object.keys(TABLE).length;
}
