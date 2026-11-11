import { getRegionKeyForCountry } from '@/lib/geo-regions';
import { lookupIpLocation } from '@/lib/geo-ip-database';
import { isPublicIpAddress } from '@/lib/ip-address';
import { findCityByName, findNearestCity } from '@/lib/visitor-cities';
import { parseCoordinate, type Coordinate } from '@/lib/geo-distance';

export { REGION_COUNTRIES, getRegionKeyForCountry } from '@/lib/geo-regions';

/**
 * City-level location for the "near you" surfaces, resolved on the server from
 * the request's address.
 *
 * The ladder, in order, and why the order is this one:
 *
 * 1. **Cloudflare location headers**, if this site is ever proxied through it.
 *    They are free and precise, and cost a handful of lines to prefer.
 * 2. **The shipped GeoLite2 database.** This is the source of truth. Vercel's
 *    own headers named a Serbian village for a visitor that Google Analytics —
 *    and MaxMind, and the visitor — put in Niš.
 * 3. **Vercel's headers.** Kept as a fallback so a deployment without the
 *    database still places visitors approximately.
 * 4. **Two keyless IP providers.** For other hosts, and for local development
 *    where no platform header exists.
 * 5. Nothing — the rail then shows the region's soonest dates, unnamed.
 *
 * Every source feeds one normaliser, so a village is corrected to its nearest
 * city the same way whichever layer answered.
 */

export type GeoSource = 'cloudflare' | 'geolite2' | 'vercel' | 'ipapi';

export type GeoLocation = {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** Region key used by the `/tickets/<region>` routes. */
  regionKey: string;
  /** Decimal degrees used to rank nearby concerts by air distance. */
  latitude: number | null;
  longitude: number | null;
  /** Which layer answered — surfaced by the debug view, never by the UI copy. */
  source: GeoSource;
  /** Set when the raw lookup named a place smaller than the city we show. */
  snappedFrom?: string | null;
  /** The raw accuracy radius, when the source reports one. */
  accuracyRadiusKm?: number | null;
};

/**
 * How far a lookup may be moved to reach a real city.
 *
 * 75 km is the distance at which "nearby" is still honest for a concert list: a
 * village 40 km from Niš is a Niš visitor for every practical purpose, while a
 * town 300 km away belongs to a different city's audience. MaxMind's own
 * accuracy is usually better than this; the limit exists so that a wide block
 * cannot be turned into a confident-sounding city.
 */
const SNAP_ACCURACY_LIMIT_KM = 75;

/**
 * Above this radius the record describes a region, not a place. Snapping a
 * 1,000 km hit would invent a city somewhere in the middle of a country, which
 * is worse than admitting we only know the country.
 */
const MAX_COORDINATE_PRECISION_KM = 150;

const GEO_TIMEOUT_MS = 3_500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;

type RawPlace = {
  name: string | null;
  countryCode: string | null;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Present only when the source reports how wide its answer is. */
  accuracyRadiusKm?: number | null;
};

/**
 * Applied to every source, so all four agree on what a place is called.
 *
 * - A name the gazetteer knows keeps the gazetteer's spelling: the page says
 *   `Niš`, not `Nis`, and the same string the concert feed uses.
 * - Otherwise a known coordinate is moved at most 75 km, and only within the
 *   same country, to the nearest real city. That is what turns `Brezovica`
 *   into `Niš`; the country bound is what stops a border village snapping to
 *   the town across the frontier.
 * - A coordinate without enough precision is never snapped: naming a city from
 *   a country-sized block is guesswork dressed as data.
 */
export function resolvePlaceName(place: RawPlace): { name: string | null; snapped: boolean } {
  const canonical = findCityByName(place.name, place.countryCode);
  if (canonical) return { name: canonical.name, snapped: false };

  if (place.latitude === null || place.longitude === null) {
    return { name: place.name, snapped: false };
  }

  /**
   * The gate lives here, not at the call sites, because it is the same rule
   * everywhere: a record that covers 1,000 km describes a country, and naming a
   * city from its centre is worse than admitting we do not know one. Without
   * this, `8.8.8.8` — a US-wide block with no city — resolved to a town in
   * Kansas purely because it was the nearest name to the centroid.
   */
  const accuracy = place.accuracyRadiusKm;
  if (accuracy !== null && accuracy !== undefined && accuracy > SNAP_ACCURACY_LIMIT_KM) {
    return { name: place.name, snapped: false };
  }

  const nearest = findNearestCity(
    { latitude: place.latitude, longitude: place.longitude },
    { countryCode: place.countryCode, maxKm: SNAP_ACCURACY_LIMIT_KM },
  );

  if (!nearest) return { name: place.name, snapped: false };

  return { name: nearest.city.name, snapped: place.name !== nearest.city.name };
}

function buildLocation(
  place: RawPlace,
  source: GeoSource,
  extra: { accuracyRadiusKm?: number | null; coordinate?: Coordinate | null } = {},
): GeoLocation {
  const resolved = resolvePlaceName(place);
  const coordinate = extra.coordinate ?? (
    place.latitude !== null && place.longitude !== null
      ? { latitude: place.latitude, longitude: place.longitude }
      : null
  );

  return {
    city: resolved.name,
    countryCode: place.countryCode,
    countryName: place.countryName,
    regionKey: getRegionKeyForCountry(place.countryCode),
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    source,
    snappedFrom: resolved.snapped ? place.name : null,
    accuracyRadiusKm: extra.accuracyRadiusKm ?? null,
  };
}

/**
 * Best-effort client address, left-most first. `cf-connecting-ip` leads because
 * when Cloudflare is in front it is the only entry a client cannot forge.
 */
export function getRequestIp(headers: Headers): string | null {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
    headers.get('x-vercel-forwarded-for')?.split(',')[0],
    headers.get('x-real-ip'),
    headers.get('x-client-ip'),
  ];

  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip && isPublicIpAddress(ip)) return ip;
  }

  return null;
}

/** Percent-decoded and trimmed: Vercel sends `Ni%C5%A1`, Cloudflare sends `Niš`. */
function cleanHeaderCity(value: string | null): string | null {
  if (!value?.trim()) return null;

  let city = value;
  try {
    city = decodeURIComponent(value);
  } catch {
    city = value;
  }

  return city.replace(/\s+/g, ' ').trim().slice(0, 64) || null;
}

/**
 * Layer 0: Cloudflare's visitor location headers.
 *
 * `request.cf` is a Workers-only object and does not exist in a Node runtime,
 * and these headers only appear when the "add visitor location headers" managed
 * transform is enabled. Tried first because it is free and better, never relied
 * on: this domain answers straight from Vercel with no `cf-ray` at all.
 */
function readCloudflareLocation(headers: Headers): RawPlace | null {
  const name = cleanHeaderCity(headers.get('cf-ipcity'));
  const countryCode = headers.get('cf-ipcountry')?.trim().toUpperCase() || null;
  if (!name && !countryCode) return null;

  const coordinate = parseCoordinate(headers.get('cf-iplatitude'), headers.get('cf-iplongitude'));

  return {
    name,
    countryCode,
    countryName: null,
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
  };
}

/** Layer 2: Vercel's headers, kept for a deployment without the database. */
function readPlatformLocation(headers: Headers): RawPlace | null {
  const countryCode = headers.get('x-vercel-ip-country')?.trim().toUpperCase() || null;
  const name = cleanHeaderCity(headers.get('x-vercel-ip-city'));
  if (!countryCode && !name) return null;

  const coordinate = parseCoordinate(
    headers.get('x-vercel-ip-latitude'),
    headers.get('x-vercel-ip-longitude'),
  );

  return {
    name,
    countryCode,
    countryName: null,
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type IpApiCoResponse = {
  city?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  error?: boolean | string;
};

type IpApiComResponse = {
  status?: string;
  city?: string | null;
  countryCode?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
};

async function lookupPlace(ip: string): Promise<RawPlace | null> {
  const primary = await fetchJson<IpApiCoResponse>(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
  if (primary && !primary.error && (primary.country_code || primary.city)) {
    const coordinate = parseCoordinate(primary.latitude, primary.longitude);

    return {
      name: primary.city?.trim() || null,
      countryCode: primary.country_code?.trim().toUpperCase() || null,
      countryName: primary.country_name?.trim() || null,
      latitude: coordinate?.latitude ?? null,
      longitude: coordinate?.longitude ?? null,
    };
  }

  const fallback = await fetchJson<IpApiComResponse>(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,lat,lon`,
  );
  if (fallback?.status === 'success') {
    const coordinate = parseCoordinate(fallback.lat, fallback.lon);

    return {
      name: fallback.city?.trim() || null,
      countryCode: fallback.countryCode?.trim().toUpperCase() || null,
      countryName: fallback.country?.trim() || null,
      latitude: coordinate?.latitude ?? null,
      longitude: coordinate?.longitude ?? null,
    };
  }

  return null;
}

const locationCache = new Map<string, { place: GeoLocation; expiresAt: number }>();

function readCache(ip: string): GeoLocation | null {
  const hit = locationCache.get(ip);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    locationCache.delete(ip);
    return null;
  }

  return hit.place;
}

function writeCache(ip: string, place: GeoLocation): void {
  if (locationCache.size >= CACHE_LIMIT) {
    const oldest = locationCache.keys().next().value;
    if (oldest) locationCache.delete(oldest);
  }

  locationCache.set(ip, { place, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * The visitor's location, or null when no layer can place them (local
 * development, a proxy that strips every header, a failed lookup).
 */
export async function getRequestLocation(headers: Headers): Promise<GeoLocation | null> {
  const cloudflare = readCloudflareLocation(headers);
  if (cloudflare) return buildLocation(cloudflare, 'cloudflare');

  const ip = getRequestIp(headers);

  if (ip) {
    const record = await lookupIpLocation(ip);
    if (record) {
      const precise = record.accuracyRadiusKm === null
        || record.accuracyRadiusKm <= MAX_COORDINATE_PRECISION_KM;

      const location = buildLocation(
        {
          name: record.city,
          countryCode: record.countryCode,
          countryName: record.countryName,
          latitude: precise ? record.latitude : null,
          longitude: precise ? record.longitude : null,
          accuracyRadiusKm: record.accuracyRadiusKm,
        },
        'geolite2',
        { accuracyRadiusKm: record.accuracyRadiusKm },
      );

      writeCache(ip, location);
      return location;
    }
  }

  const platform = readPlatformLocation(headers);
  if (platform) return buildLocation(platform, 'vercel');

  if (!ip) return null;

  const cached = readCache(ip);
  if (cached) return cached;

  const place = await lookupPlace(ip);
  if (!place) return null;

  const location = buildLocation(place, 'ipapi');
  writeCache(ip, location);

  return location;
}
