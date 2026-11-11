import { lookupIpLocation } from '@/lib/geo-ip-database';
import { getRegionKeyForCountry } from '@/lib/geo-regions';
import { resolvePlaceName } from '@/lib/geo-location';
import { findCityByName } from '@/lib/visitor-cities';

/**
 * Shows what the shipped database says about a set of addresses, and what the
 * correction does with the answer.
 *
 *   npm run geo:probe                       # the default matrix, one per region
 *   npm run geo:probe -- 178.220.0.1 128.101.101.101
 *   npm run geo:probe -- --no-compare        # skip the second opinion (offline)
 *
 * The second opinion is ipapi.co, an independent IP database that behaves like
 * the ones the platform and the analytics use. When MaxMind and ipapi agree and
 * the correction agrees with both, the label is as good as IP geolocation gets.
 */

const DEFAULT_IPS = [
  '128.101.101.101', // University of Minnesota — MaxMind documents this as Minneapolis
  '8.8.8.8',         // Google DNS — a wide block, expect no city
  '81.2.69.142',     // MaxMind's UK test address
  '91.64.0.1',       // Deutsche Telekom, Berlin
  '133.11.0.1',      // University of Tokyo
  '178.220.0.1',     // Serbian ISP block — the case that started this
  '212.200.65.1',    // Telekom Srbija
];

type Row = {
  ip: string;
  country: string | null;
  databaseCity: string | null;
  accuracyKm: number | null;
  shownCity: string | null;
  snappedFrom: string | null;
  inGazetteer: boolean;
  region: string;
  secondOpinion: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function secondOpinion(ip: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'musictop-geo-probe' },
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const payload = (await response.json()) as { city?: string | null; error?: boolean };
    if (payload.error) return null;

    return payload.city?.trim() || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const compare = !process.argv.includes('--no-compare');
  const ips = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  const targets = ips.length > 0 ? ips : DEFAULT_IPS;

  const rows: Row[] = [];

  for (const ip of targets) {
    const record = await lookupIpLocation(ip);
    const resolved = record
      ? resolvePlaceName({
        name: record.city,
        countryCode: record.countryCode,
        countryName: record.countryName,
        latitude: record.latitude,
        longitude: record.longitude,
        accuracyRadiusKm: record.accuracyRadiusKm,
      })
      : { name: null, snapped: false };

    rows.push({
      ip,
      country: record?.countryCode ?? null,
      databaseCity: record?.city ?? null,
      accuracyKm: record?.accuracyRadiusKm ?? null,
      shownCity: resolved.name,
      snappedFrom: resolved.snapped ? record?.city ?? null : null,
      inGazetteer: Boolean(findCityByName(record?.city, record?.countryCode)),
      region: getRegionKeyForCountry(record?.countryCode ?? null),
      secondOpinion: compare ? await secondOpinion(ip) : null,
    });

    if (compare) await sleep(300);
  }

  console.table(rows.map((row) => ({
    ip: row.ip,
    country: row.country ?? '-',
    region: row.region,
    'MaxMind city': row.databaseCity ?? '(none)',
    'accuracy km': row.accuracyKm ?? '-',
    'shown as': row.shownCity ?? '(none)',
    snapped: row.snappedFrom ?? '',
    'ipapi.co': row.secondOpinion ?? '-',
    agree: row.databaseCity && row.secondOpinion
      ? (row.databaseCity === row.secondOpinion ? 'yes' : 'differs')
      : '-',
  })));

  const placed = rows.filter((row) => row.shownCity).length;
  const snapped = rows.filter((row) => row.snappedFrom).length;
  const agreed = rows.filter((row) => row.databaseCity && row.secondOpinion
    && row.databaseCity === row.secondOpinion).length;

  console.log(JSON.stringify({
    event: 'geo_probe',
    addresses: rows.length,
    named: placed,
    correctedBySnap: snapped,
    agreesWithSecondOpinion: agreed,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Geo probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
