import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { placeKey } from '@/lib/visitor-cities';

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
  alternates: string[];
  countryCode: string;
  latitude: number;
  longitude: number;
  population: number;
  featureCode: string;
};

/**
 * Alternate names, kept for the cities a promoter would name in their own
 * language.
 *
 * This is what makes `Roma` Rome instead of a 3,000-person commune in Botoșani:
 * the gazetteer files the city as `Rome` (its English name), and the promoter,
 * every poster and the person on the phone call it `Roma`. GeoNames ships the
 * alternate names in the dump — the column this builder used to read and throw
 * away.
 *
 * 500,000 people is the line. Below it a namesake village is as likely as the
 * city and a wrong alias costs a distance; above it the local name is in wide
 * use and the alias is almost always the metropolis. Every alternate above that
 * line is kept rather than a handful: the lists are alphabetical, so the first
 * six of Rome's sixty-one are `An Roimh`, `An Ròimh`, `Erroma`, `Hrom` — and
 * `Roma` never made the cut.
 */
const ALIAS_MIN_POPULATION = 500_000;
const ALIAS_MIN_LENGTH = 3;
const ALIAS_MAX_LENGTH = 28;
/** A name, not a code: `ROM` and `VIE` are airport codes wearing a name's slot. */
const ALIAS_SHAPE = /^[\p{L}][\p{L}\s'.-]{2,27}$/u;

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
      alternates: (fields[3] || '').split(',').map((alternate) => alternate.trim()).filter(Boolean),
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
function toTuples(rows: DumpRow[]): { cities: CityTuple[]; alternates: Map<string, string[]> } {
  const best = new Map<string, CityTuple>();
  const alternates = new Map<string, string[]>();

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
      alternates.set(`${row.name}|${row.countryCode}`, row.alternates);
    }
  }

  return {
    cities: Array.from(best.values()).sort((a, b) => a[0].localeCompare(b[0])),
    alternates,
  };
}

/**
 * Alternate name → index into `cities`.
 *
 * Cities are visited largest first so the metropolis claims a shared spelling:
 * `Roma` belongs to Rome (2.8 M) before Roma, Botoșani (3,000) can take it, and
 * the answer does not depend on which row GeoNames happened to list first.
 */
function buildAliasIndex(cities: CityTuple[], alternates: Map<string, string[]>): Record<string, number> {
  const aliases: Record<string, number> = {};

  const bySize = cities
    .map((city, index) => ({ city, index }))
    .filter((entry) => entry.city[4] >= ALIAS_MIN_POPULATION)
    .sort((a, b) => b.city[4] - a.city[4]);

  for (const { city, index } of bySize) {
    const list = alternates.get(`${city[0]}|${city[1]}`) ?? [];
    const primary = placeKey(city[0]);

    for (const alternate of list) {
      if (alternate.length < ALIAS_MIN_LENGTH || alternate.length > ALIAS_MAX_LENGTH) continue;
      if (!ALIAS_SHAPE.test(alternate)) continue;
      // An all-caps token is a code, not how anyone writes a city.
      if (alternate === alternate.toUpperCase()) continue;

      const key = placeKey(alternate);
      if (!key || key.length < ALIAS_MIN_LENGTH) continue;
      // The primary name is already in the name index; the largest city wins a
      // contested spelling, and the first claim is never overwritten.
      if (key === primary || key in aliases) continue;

      aliases[key] = index;
    }
  }

  const sorted: Record<string, number> = {};
  for (const key of Object.keys(aliases).sort()) sorted[key] = aliases[key];

  return sorted;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  await downloadDump(force);

  const rows = parseDump(readFileSync(CACHE_FILE, 'utf8'));
  const { cities, alternates } = toTuples(rows);
  const aliases = buildAliasIndex(cities, alternates);

  const payload = {
    source: 'GeoNames cities15000 — CC BY 4.0 — https://www.geonames.org/',
    generatedAt: new Date().toISOString().slice(0, 10),
    cities,
    aliases,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload)}\n`, 'utf8');

  const bytes = readFileSync(OUTPUT_PATH).byteLength;
  const withPopulation = cities.filter((city) => city[4] >= 100_000).length;

  console.log(JSON.stringify({
    event: 'visitor_cities_built',
    dumpRows: rows.length,
    cities: cities.length,
    majorCities: withPopulation,
    aliases: Object.keys(aliases).length,
    distinctCountries: new Set(cities.map((city) => city[1])).size,
    kilobytes: Math.round(bytes / 1024),
  }, null, 2));

  for (const probe of ['roma', 'wien', 'milano', 'beograd', 'nyc']) {
    const index = aliases[probe];
    console.log(`  alias ${probe} → ${index === undefined ? '(none)' : cities[index].slice(0, 2).join(', ')}`);
  }

  const serbia = cities.filter((city) => city[1] === 'RS').slice(0, 5);
  console.log('Serbia sample:', JSON.stringify(serbia));
}

main().catch((error: unknown) => {
  console.error('Visitor city gazetteer build failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
