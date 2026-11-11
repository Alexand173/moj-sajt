import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Builds `lib/visitor-cities.json`: every city a visitor could plausibly be in,
 * so an IP lookup that lands on a village can be corrected to the town a person
 * would name.
 *
 *   npm run cities:gazetteer           # download if needed, then rebuild
 *   npm run cities:gazetteer -- --force  # re-download
 *
 * Why a gazetteer at all. MaxMind and Vercel both resolve the *block* an address
 * belongs to, and a block is often registered in a small locality: an ISP in
 * Niš registers part of its range in Brezovica. Naming the village is technically
 * what the database says and practically useless — nobody looks for a concert in
 * a village of 200 people, and the nearby rail then compares the visitor against
 * a city that never appears in the feed.
 *
 * Source: GeoNames `cities15000` (every populated place above 15,000 people),
 * CC BY 4.0. It is a static dump, so this is a build-time step and the request
 * path only ever reads the committed JSON.
 *
 * The file is deliberately flat arrays rather than objects: 34,000 rows of
 * `{"name":…,"country":…}` is about three times the bytes of the same data as
 * tuples, and this module is loaded on the one route that needs it.
 */

const DUMP_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const CACHE_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'geonames');
const CACHE_FILE = path.join(CACHE_DIR, 'cities15000.txt');
const OUTPUT_PATH = path.join(process.cwd(), 'lib', 'visitor-cities.json');

/** `[name, countryCode, latitude, longitude, population]` */
type CityTuple = [string, string, number, number, number];

type DumpRow = {
  name: string;
  ascii: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  population: number;
  featureCode: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadDump(force: boolean): Promise<void> {
  if (existsSync(CACHE_FILE) && !force) {
    console.log(`Using cached dump: ${path.relative(process.cwd(), CACHE_FILE)}`);
    return;
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const zipPath = path.join(CACHE_DIR, 'cities15000.zip');

  console.log(`Downloading ${DUMP_URL} …`);
  const response = await fetch(DUMP_URL);
  if (!response.ok) throw new Error(`GeoNames download failed: ${response.status} ${response.statusText}`);

  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${(Buffer.byteLength(readFileSync(zipPath)) / 1_048_576).toFixed(1)} MB, extracting…`);

  // `tar` on Windows 10+, `unzip` elsewhere: both are present on the platforms
  // this runs on and neither needs a new dependency for a once-a-release step.
  try {
    execFileSync('tar', ['-xzf', zipPath, '-C', CACHE_DIR], { stdio: 'ignore' });
  } catch {
    execFileSync('unzip', ['-o', zipPath, '-d', CACHE_DIR], { stdio: 'ignore' });
  }

  if (!existsSync(CACHE_FILE)) {
    throw new Error(`Extraction produced no ${CACHE_FILE}.`);
  }

  await sleep(0);
}

/**
 * GeoNames columns, tab separated:
 * 0 id · 1 name · 2 asciiName · 3 alternates · 4 lat · 5 lon · 6 class · 7 code ·
 * 8 countryCode · 9 cc2 · 10 admin1 · … · 14 population
 */
function parseDump(contents: string): DumpRow[] {
  const rows: DumpRow[] = [];

  for (const line of contents.split('\n')) {
    if (!line.trim()) continue;

    const fields = line.split('\t');
    if (fields.length < 15) continue;

    const latitude = Number(fields[4]);
    const longitude = Number(fields[5]);
    const population = Number(fields[14] || 0);
    const countryCode = (fields[8] || '').trim().toUpperCase();

    if (!countryCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    rows.push({
      name: fields[1].trim(),
      ascii: (fields[2] || '').trim(),
      countryCode,
      latitude,
      longitude,
      population: Number.isFinite(population) ? population : 0,
      featureCode: (fields[7] || '').trim(),
    });
  }

  return rows;
}

/**
 * One entry per name per country, keeping the largest place. GeoNames lists
 * suburbs and boroughs as cities in their own right — `Zemun` next to
 * `Belgrade` — and keeping every one of them makes the nearest-city search
 * return a district when the person means the city.
 */
function toTuples(rows: DumpRow[]): CityTuple[] {
  const best = new Map<string, CityTuple>();

  for (const row of rows) {
    if (!row.name) continue;
    // PPLX is a section of a city, not a city.
    if (row.featureCode === 'PPLX') continue;

    const key = `${row.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}|${row.countryCode}`;
    const existing = best.get(key);

    if (!existing || row.population > existing[4]) {
      best.set(key, [
        row.name,
        row.countryCode,
        Number(row.latitude.toFixed(4)),
        Number(row.longitude.toFixed(4)),
        Math.round(row.population),
      ]);
    }
  }

  return Array.from(best.values()).sort((a, b) => a[0].localeCompare(b[0]));
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  await downloadDump(force);

  const rows = parseDump(readFileSync(CACHE_FILE, 'utf8'));
  const cities = toTuples(rows);

  const payload = {
    source: 'GeoNames cities15000 — CC BY 4.0 — https://www.geonames.org/',
    generatedAt: new Date().toISOString().slice(0, 10),
    cities,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload)}\n`, 'utf8');

  const bytes = readFileSync(OUTPUT_PATH).byteLength;
  const withPopulation = cities.filter((city) => city[4] >= 100_000).length;

  console.log(JSON.stringify({
    event: 'visitor_cities_built',
    dumpRows: rows.length,
    cities: cities.length,
    majorCities: withPopulation,
    distinctCountries: new Set(cities.map((city) => city[1])).size,
    kilobytes: Math.round(bytes / 1024),
  }, null, 2));

  const serbia = cities.filter((city) => city[1] === 'RS').slice(0, 5);
  console.log('Serbia sample:', JSON.stringify(serbia));
}

main().catch((error: unknown) => {
  console.error('Visitor city gazetteer build failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
