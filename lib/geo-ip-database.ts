import { isPublicIpAddress } from '@/lib/ip-address';

/**
 * The visitor's city, from a free service that needs no key.
 *
 * Two of them, in order, because both are free and neither is guaranteed:
 *
 * 1. **ipwho.is** answers the city with its coordinate, which is what the
 *    distance ranking needs:
 *      GET https://ipwho.is/213.196.109.5
 *      { "success": true, "country_code": "RS", "region": "Nisava",
 *        "city": "Nis", "latitude": 43.3247223, "longitude": 21.9033327 }
 * 2. **db-ip.com** answers the city without one, so the gazetteer supplies the
 *    point (`lib/visitor-cities`):
 *      GET https://api.db-ip.com/v2/free/213.196.109.5
 *      { "countryCode": "RS", "stateProv": "Central Serbia", "city": "Niš" }
 *
 * Both name **Niš** for the block that serves Niš. That is the whole reason this
 * exists: Vercel's headers named a Serbian village, and a shipped MaxMind
 * database named Belgrade — the operator's registered city — with a confident
 * 20 km radius, while ipwho.is, db-ip.com and the visitor's own Analytics all
 * put the same address in Niš.
 *
 * Neither service is paid and neither needs an account. ipwho.is allows 10,000
 * requests a month without a key and db-ip.com 1,000 a day; every answer is
 * cached per address for six hours in `lib/geo-location`, so ordinary traffic
 * spends a handful of requests a day.
 */

export type IpProvider = 'ipwhois' | 'dbip';

export type IpLocation = {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** First-level administrative division, e.g. `Nisava`, `Minnesota`. */
  subdivision: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Only a paid service reports one; kept so the precision gate still works. */
  accuracyRadiusKm: number | null;
  /** Which service answered — the first question any geo bug asks. */
  provider: IpProvider;
};

/**
 * Long enough for a slow service, short enough that a timeout is invisible next
 * to the platform header it falls back to.
 */
const LOOKUP_TIMEOUT_MS = 3_500;

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // One visitor's address is not a document to cache at the edge.
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    return (await response.json()) as Record<string, unknown>;
  } catch {
    // A timeout, a refusal or a rate limit is not an error the page should see:
    // the ladder falls back to the next service, then to the platform headers.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function lookupWithIpWhoIs(ip: string): Promise<IpLocation | null> {
  const payload = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (!payload || payload.success === false) return null;

  const countryCode = text(payload.country_code);
  if (!countryCode) return null;

  return {
    city: text(payload.city),
    countryCode: countryCode.toUpperCase(),
    countryName: text(payload.country),
    subdivision: text(payload.region),
    latitude: number(payload.latitude),
    longitude: number(payload.longitude),
    accuracyRadiusKm: null,
    provider: 'ipwhois',
  };
}

async function lookupWithDbIp(ip: string): Promise<IpLocation | null> {
  const payload = await fetchJson(`https://api.db-ip.com/v2/free/${encodeURIComponent(ip)}`);
  if (!payload || payload.error) return null;

  const countryCode = text(payload.countryCode);
  if (!countryCode) return null;

  return {
    city: text(payload.city),
    countryCode: countryCode.toUpperCase(),
    countryName: text(payload.countryName),
    subdivision: text(payload.stateProv),
    latitude: null,
    longitude: null,
    accuracyRadiusKm: null,
    provider: 'dbip',
  };
}

/**
 * The services' opinion about an address, or `null` when neither has one.
 *
 * An address inside a private range is answered without a request: a development
 * machine asking about `::1` must not be placed in a city, and must not spend a
 * lookup on it either.
 */
export async function lookupIpLocation(ip: string | null | undefined): Promise<IpLocation | null> {
  // The unit tests set this so a suite never depends on the network.
  if (process.env.GEOIP_DISABLED === '1') return null;
  if (!isPublicIpAddress(ip)) return null;

  return (await lookupWithIpWhoIs(ip as string)) ?? (await lookupWithDbIp(ip as string));
}
