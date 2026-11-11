import { lookupIpLocation } from '@/lib/geo-ip-database';
import { getRegionKeyForCountry } from '@/lib/geo-regions';
import { resolvePlaceName } from '@/lib/geo-location';
import { findCityByName } from '@/lib/visitor-cities';

/**
 * What db-ip.com says about a set of addresses, and what the correction does
 * with the answer.
 *
 *   npm run geo:probe                                   # the default matrix
 *   npm run geo:probe -- 213.196.109.5 128.101.101.101
 *   npm run geo:probe -- --no-compare                    # skip the second opinion
 *
 * The second opinion is ipapi.co, an independent database. Where the two name
 * the same city the label is as good as IP geolocation gets; where they differ,
 * the address describes a block rather than a place and the number is a guess.
 * The case that started all this — `213.196.109.5` — is in the default matrix.
 */

const DEFAULT_IPS = [
  '213.196.109.5',   // Telekom Srbija — the block that named Belgrade for a Niš visitor
  '128.101.101.101', // University of Minnesota, documented as Minneapolis
  '8.8.8.8',         // Google DNS — a wide block, expect the operator's city
  '81.2.69.142',     // MaxMind's UK test address
  '91.64.0.1',       // Deutsche Telekom, Berlin
  '133.11.0.1',      // University of Tokyo
  '43.153.57.1',     // Tencent Cloud, Santa Clara
];

type Row = {
  ip: string;
  country: string | null;
  region: string;
  databaseCity: string | null;
  subdivision: string | null;
  shownCity: string | null;
  snappedFrom: string | null;
  inGazetteer: boolean;
  secondOpinion: string | null;
  agrees: string;
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

    const payload = (await response.json()) as { city?: string | null; error?: boolean | string };
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
      })
      : { name: null, snapped: false };

    const opinion = compare ? await secondOpinion(ip) : null;

    rows.push({
      ip,
      country: record?.countryCode ?? null,
      region: getRegionKeyForCountry(record?.countryCode ?? null),
      databaseCity: record?.city ?? null,
      subdivision: record?.subdivision ?? null,
      shownCity: resolved.name,
      snappedFrom: resolved.snapped ? record?.city ?? null : null,
      inGazetteer: Boolean(findCityByName(record?.city, record?.countryCode)),
      secondOpinion: opinion,
      agrees: record?.city && opinion ? (record.city === opinion ? 'yes' : 'differs') : '-',
    });

    if (compare) await sleep(300);
  }

  console.table(rows.map((row) => ({
    ip: row.ip,
    country: row.country ?? '-',
    region: row.region,
    'db-ip.com city': row.databaseCity ?? '(none)',
    subdivision: row.subdivision ?? '-',
    'shown as': row.shownCity ?? '(none)',
    snapped: row.snappedFrom ?? '',
    'ipapi.co': row.secondOpinion ?? '-',
    agree: row.agrees,
  })));

  console.log(JSON.stringify({
    event: 'geo_probe',
    service: 'db-ip.com',
    addresses: rows.length,
    named: rows.filter((row) => row.shownCity).length,
    correctedBySnap: rows.filter((row) => row.snappedFrom).length,
    agreesWithSecondOpinion: rows.filter((row) => row.agrees === 'yes').length,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Geo probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
