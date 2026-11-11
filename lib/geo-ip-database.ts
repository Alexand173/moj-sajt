import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isPublicIpAddress } from '@/lib/ip-address';

/**
 * The visitor's city, from a database we ship rather than one the platform
 * provides.
 *
 * Vercel resolves the IP in front of the function and sends the result in
 * `x-vercel-ip-*`. For this site it named **Brezovica**, a Serbian village, for a
 * visitor whose Analytics reports Niš. Google and MaxMind both put the same
 * address in Niš, so the fault is the database, not the reader — and the fix is
 * to read one that agrees with the analytics the editorial team already trusts.
 *
 * The data is `geolite2-city` (MaxMind GeoLite2-City, refreshed twice a week,
 * CC BY-SA 4.0). It ships gzipped, so the first lookup in a process inflates it
 * into a buffer and hands that to `Reader.openBuffer` — no temporary file, no
 * write to a read-only bundle.
 *
 * Everything here fails closed. A missing file, an unreadable database or a
 * malformed address returns `null` and the caller falls back down the ladder;
 * losing the database must never take the tickets page down with it.
 */

export type IpLocation = {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** First-level administrative division, e.g. `Nišava`, `Minnesota`. */
  subdivision: string | null;
  latitude: number | null;
  longitude: number | null;
  /**
   * How wide the block is, in kilometres. A 5 km radius is a street; a 1000 km
   * radius is a country centroid and must not be read as a city.
   */
  accuracyRadiusKm: number | null;
};

const DATABASE_PACKAGE = 'geolite2-city';
const DATABASE_FILE = 'GeoLite2-City.mmdb.gz';

type GeoCityRecord = {
  city?: { names?: Record<string, string> };
  country?: { isoCode?: string; names?: Record<string, string> };
  subdivisions?: Array<{ names?: Record<string, string> }>;
  location?: { latitude?: number; longitude?: number; accuracyRadius?: number };
};

type GeoReader = { city: (ip: string) => GeoCityRecord };

let readerPromise: Promise<GeoReader | null> | null = null;
let warned = false;

function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`GeoIP database unavailable: ${message}`);
}

/** Where the packaged database is, after bundling traced it into the function. */
function resolveDatabasePath(): string | null {
  const candidates = [
    process.env.GEOIP_DB_PATH,
    path.join(process.cwd(), 'node_modules', DATABASE_PACKAGE, DATABASE_FILE),
    path.join(process.cwd(), '..', 'node_modules', DATABASE_PACKAGE, DATABASE_FILE),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Reads the database once per process.
 *
 * `@maxmind/geoip2-node` is ESM-only, so it is imported dynamically: a static
 * import would either fail the CommonJS build or force the whole route to be
 * ESM. The inflated buffer is held for the lifetime of the process, which is
 * what makes the second lookup free.
 */
async function getReader(): Promise<GeoReader | null> {
  if (process.env.GEOIP_DISABLED === '1') return null;

  if (!readerPromise) {
    readerPromise = (async (): Promise<GeoReader | null> => {
      const file = resolveGzPath();
      if (!file) {
        warnOnce(`no ${DATABASE_FILE} found; run npm install geolite2-city`);
        return null;
      }

      try {
        const geoip = await import('@maxmind/geoip2-node');
        const ReaderClass = (geoip as unknown as {
          Reader?: { openBuffer?: (buffer: Buffer) => unknown };
        }).Reader;

        if (!ReaderClass?.openBuffer) {
          warnOnce('@maxmind/geoip2-node exposed no Reader.openBuffer');
          return null;
        }

        const buffer = gunzipSync(readFileSync(file));
        return ReaderClass.openBuffer(buffer) as GeoReader;
      } catch (error) {
        warnOnce(error instanceof Error ? error.message : String(error));
        return null;
      }
    })();
  }

  return readerPromise;
}

let gzPath: string | null | undefined;

function resolveGzPath(): string | null {
  if (gzPath === undefined) gzPath = resolveDatabasePath();
  return gzPath;
}

/**
 * The database's opinion about an address, or `null` when it has none.
 *
 * An address inside a private range is answered without touching the database:
 * a development machine asking about `::1` must not be placed in a city.
 */
export async function lookupIpLocation(ip: string | null | undefined): Promise<IpLocation | null> {
  if (!isPublicIpAddress(ip)) return null;

  const reader = await getReader();
  if (!reader) return null;

  try {
    const record = reader.city(ip as string);

    return {
      city: record.city?.names?.en?.trim() || null,
      countryCode: record.country?.isoCode?.trim().toUpperCase() || null,
      countryName: record.country?.names?.en?.trim() || null,
      subdivision: record.subdivisions?.[0]?.names?.en?.trim() || null,
      latitude: Number.isFinite(record.location?.latitude) ? (record.location?.latitude as number) : null,
      longitude: Number.isFinite(record.location?.longitude) ? (record.location?.longitude as number) : null,
      accuracyRadiusKm: Number.isFinite(record.location?.accuracyRadius) ? (record.location?.accuracyRadius as number) : null,
    };
  } catch {
    // `AddressNotFoundError` is the normal answer for an unallocated range.
    return null;
  }
}

/** For the probe script and for a debug view: is the database actually loadable? */
export async function isIpDatabaseAvailable(): Promise<boolean> {
  return Boolean(await getReader());
}
