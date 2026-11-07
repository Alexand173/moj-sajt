/**
 * City-level location for the "near you" surfaces, resolved from the request's
 * IP address on the server.
 *
 * Two keyless providers are tried in order, because a single free endpoint is
 * too easy to lose to a rate limit. The IP is never stored or logged: it is used
 * for one lookup and then dropped, and the resolved city is cached in memory so
 * repeat requests from the same address do not hit the provider again.
 */

export type GeoLocation = {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** Region key used by the `/tickets/<region>` routes. */
  regionKey: string;
};

/** Countries grouped by the region keys the ticket pages use. */
const REGION_COUNTRIES: Record<string, readonly string[]> = {
  us: ['US', 'CA'],
  uk: ['GB', 'IE'],
  latino: ['MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'DO', 'PR', 'CR', 'PA', 'UY', 'PY', 'BO', 'ES', 'PT'],
  europa: [
    'DE', 'FR', 'IT', 'PL', 'SE', 'NO', 'DK', 'FI', 'IS', 'EE', 'LV', 'LT', 'RS', 'BA', 'BG', 'RO',
    'GR', 'AL', 'HR', 'MK', 'ME', 'XK', 'SI', 'AT', 'BE', 'CH', 'CY', 'CZ', 'HU', 'LU', 'MT', 'NL', 'SK',
  ],
  asia: ['JP', 'KR', 'CN', 'IN', 'TW', 'TH', 'PH', 'ID', 'VN', 'SG', 'MY', 'HK'],
};

const COUNTRY_TO_REGION = new Map<string, string>(
  Object.entries(REGION_COUNTRIES).flatMap(([region, codes]) => codes.map((code) => [code, region] as const)),
);

export function getRegionKeyForCountry(countryCode: string | null): string {
  if (!countryCode) return 'world';
  return COUNTRY_TO_REGION.get(countryCode.trim().toUpperCase()) ?? 'world';
}

const GEO_TIMEOUT_MS = 3_500;
const LOCATION_TTL_MS = 6 * 60 * 60 * 1000;
const LOCATION_CACHE_LIMIT = 500;

type ResolvedPlace = {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
};

const locationCache = new Map<string, { place: GeoLocation; expiresAt: number }>();

/** Private and loopback addresses cannot be geolocated; treat them as unknown. */
function isPublicIp(value: string): boolean {
  if (!value) return false;
  if (value.includes(':')) {
    return !/^(::1|fe80|fc|fd)/i.test(value);
  }

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  if (value === '0.0.0.0' || value.startsWith('127.') || value.startsWith('10.') || value.startsWith('169.254.')) return false;
  if (value.startsWith('192.168.')) return false;

  const private172 = /^172\.(\d{1,3})\./.exec(value);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;

  return true;
}

/**
 * Best-effort client address. Vercel sets `x-forwarded-for` (and its own
 * `x-vercel-forwarded-for`); the left-most entry is the client.
 */
export function getRequestIp(headers: Headers): string | null {
  const candidates = [
    headers.get('x-forwarded-for')?.split(',')[0],
    headers.get('x-vercel-forwarded-for')?.split(',')[0],
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-client-ip'),
  ];

  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip && isPublicIp(ip)) return ip;
  }

  return null;
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
  error?: boolean | string;
};

type IpApiComResponse = {
  status?: string;
  city?: string | null;
  countryCode?: string | null;
  country?: string | null;
};

async function lookupPlace(ip: string): Promise<ResolvedPlace | null> {
  const primary = await fetchJson<IpApiCoResponse>(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
  if (primary && !primary.error && (primary.country_code || primary.city)) {
    return {
      city: primary.city?.trim() || null,
      countryCode: primary.country_code?.trim().toUpperCase() || null,
      countryName: primary.country_name?.trim() || null,
    };
  }

  const fallback = await fetchJson<IpApiComResponse>(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city`,
  );
  if (fallback?.status === 'success') {
    return {
      city: fallback.city?.trim() || null,
      countryCode: fallback.countryCode?.trim().toUpperCase() || null,
      countryName: fallback.country?.trim() || null,
    };
  }

  return null;
}

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
  if (locationCache.size >= LOCATION_CACHE_LIMIT) {
    const oldest = locationCache.keys().next().value;
    if (oldest) locationCache.delete(oldest);
  }

  locationCache.set(ip, { place, expiresAt: Date.now() + LOCATION_TTL_MS });
}

/**
 * Vercel resolves the visitor's city in front of the function on every request,
 * so those headers are used first: they cost nothing and cannot be rate limited.
 * The keyless IP providers below stay as the fallback for other hosts.
 */
function readPlatformLocation(headers: Headers): GeoLocation | null {
  const countryCode = headers.get('x-vercel-ip-country')?.trim().toUpperCase() || null;
  const rawCity = headers.get('x-vercel-ip-city')?.trim() || null;
  if (!countryCode && !rawCity) return null;

  let city = rawCity;
  if (city) {
    try {
      city = decodeURIComponent(city);
    } catch {
      city = rawCity;
    }
  }

  return {
    city: city?.replace(/\s+/g, ' ').trim().slice(0, 64) || null,
    countryCode,
    countryName: null,
    regionKey: getRegionKeyForCountry(countryCode),
  };
}

/**
 * The visitor's location, or null when the address is unknown (local
 * development, a proxy that strips the header, or a failed lookup).
 */
export async function getRequestLocation(headers: Headers): Promise<GeoLocation | null> {
  const platform = readPlatformLocation(headers);
  if (platform) return platform;

  const ip = getRequestIp(headers);
  if (!ip) return null;

  const cached = readCache(ip);
  if (cached) return cached;

  const place = await lookupPlace(ip);
  if (!place) return null;

  const location: GeoLocation = {
    city: place.city,
    countryCode: place.countryCode,
    countryName: place.countryName,
    regionKey: getRegionKeyForCountry(place.countryCode),
  };
  writeCache(ip, location);

  return location;
}
