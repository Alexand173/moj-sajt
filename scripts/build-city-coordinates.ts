import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cityKey, resolveConcertCity } from '@/lib/concert-city';
import { REGION_COUNTRIES } from '@/lib/geo-location';

/**
 * Builds `lib/city-coordinates.json`: one [lat, lon] per concert city, so the
 * "near you" rail can rank dates by air distance without a geocoder on the
 * request path.
 *
 *   npm run cities:coords            # geocode cities that are missing
 *   npm run cities:coords -- --force # re-geocode everything
 *
 * Open-Meteo's geocoder is keyless and needs no attribution, which keeps this
 * runnable from CI or a laptop with no extra secrets.
 *
 * A bare name query is not enough: `Milano` comes back as Milano, Texas and
 * `Roma` as the country of Romania. Every row also carries a region, so the
 * candidate list is filtered to the countries that region covers before the most
 * populous match wins.
 */

loadEnvConfig(process.cwd());

const OUTPUT_PATH = path.join(process.cwd(), 'lib', 'city-coordinates.json');
const GEOCODER_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const CANDIDATE_COUNT = 10;
const PAGE_SIZE = 1000;
const GEOCODE_DELAY_MS = 250;
/** Matches below this population that do not match the name exactly are listed for review. */
const LOW_CONFIDENCE_POPULATION = 30_000;

/**
 * Cities the geocoder cannot place but the feed uses. Kept here rather than
 * hand-edited into the JSON so a regeneration cannot silently drop them.
 */
const MANUAL_OVERRIDES: Record<string, CoordinateTuple> = {
  // Open-Meteo answers `Göteborg` with a botanical garden, or nothing.
  'göteborg': [57.7089, 11.9746],
  // `Łódź` resolves to a village outside Poznań, which put a 118 km city at 291 km.
  'łodz': [51.7592, 19.456],
};

type CoordinateTuple = [number, number];
type CoordinateTable = Record<string, CoordinateTuple>;

type CityCandidate = {
  /** Normalised key, also the table key. */
  key: string;
  /** Display name as the feed spells it. */
  name: string;
  /** Every region the city appears in, so the country filter can use all of them. */
  regions: Set<string>;
};

type GeocodeResult = {
  name?: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
  population?: number;
  /** GeoNames feature code: `PPL*` is a populated place, `PCLI` a country, `ISL` an island. */
  feature_code?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function todayDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function readExistingTable(): CoordinateTable {
  if (!existsSync(OUTPUT_PATH)) return {};

  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) as CoordinateTable;
  } catch (error) {
    console.warn('Existing city-coordinates.json could not be parsed; starting fresh.', error);
    return {};
  }
}

/** Every distinct city with at least one upcoming date, with the regions it appears in. */
async function collectCities(): Promise<CityCandidate[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const cities = new Map<string, CityCandidate>();
  const since = todayDate();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('koncerti')
      .select('city, location, region')
      .gte('date', since)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not read koncerti: ${error.message}`);

    const rows = (data || []) as { city: string | null; location: string | null; region: string | null }[];
    for (const row of rows) {
      const city = resolveConcertCity(row.city, row.location);
      if (!city) continue;

      const lookupKey = cityKey(city);
      if (!lookupKey) continue;

      const existing = cities.get(lookupKey);
      if (existing) {
        const region = row.region?.trim().toLowerCase();
        if (region) existing.regions.add(region);
        continue;
      }

      cities.set(lookupKey, {
        key: lookupKey,
        name: city,
        regions: new Set(row.region?.trim().toLowerCase() ? [row.region.trim().toLowerCase()] : []),
      });
    }

    if (rows.length < PAGE_SIZE) break;
  }

  return Array.from(cities.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Variants of a messy feed label, most specific first: `Merksem (Antwerpen)`
 * should be tried as the parent city too, and `Gdańsk/Sopot` as `Gdańsk`.
 */
function searchVariants(name: string): string[] {
  const variants = new Set<string>();
  const push = (value: string) => {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 2) variants.add(cleaned);
  };

  push(name);
  push(name.replace(/\s*\([^)]*\)\s*/g, ' '));
  push(name.split('/')[0] ?? '');
  const parenthetical = /\(([^)]+)\)/.exec(name)?.[1];
  if (parenthetical) push(parenthetical);

  // Feed abbreviations and street-suffix noise: `Ft Lauderdale`, `Mt Claremont`,
  // `Linlithgow Ave`, `Antwerpen 1`, `Limerick City`.
  for (const base of Array.from(variants)) {
    push(base.replace(/\bFt\.?\b/gi, 'Fort').replace(/\bMt\.?\b/gi, 'Mount'));
    push(base.replace(/\s+\b(Ave|Ave\.|Street|St\.|Road|Rd|Boulevard|Blvd)\b\.?$/i, ''));
    push(base.replace(/\s+\d+$/, ''));
    push(base.replace(/\s+\bCity\b$/i, ''));
  }

  // Feed labels carry trailing noise: `Buenos Aires Argentina`, `México CDMX`,
  // `København V`, `Col. Centro Monterrey`.
  for (const base of Array.from(variants)) {
    const words = base.split(' ');
    if (words.length >= 3) push(words.slice(0, -1).join(' '));
    if (words.length >= 3) push(words.slice(0, 2).join(' '));

    const last = words[words.length - 1];
    if (words.length >= 2 && (/^[A-Z0-9.]{2,}$/.test(last) || last.length === 1)) {
      push(words.slice(0, -1).join(' '));
    }
  }

  // Diacritics defeat the geocoder for some names: `Málaga`, `Göteborg`.
  for (const base of Array.from(variants)) push(cityKey(base));

  return Array.from(variants);
}

/**
 * The feed files Australia and New Zealand under `asia`, a region the visitor
 * map does not cover (an Australian visitor resolves to `world`). Widening the
 * geocoder's set here recovers those cities without changing how visitors are
 * bucketed into region pages.
 */
const GEOCODE_REGION_EXTRA: Record<string, readonly string[]> = {
  asia: ['AU', 'NZ'],
};

/** Countries the city's regions cover, so a European name cannot match a US town. */
function allowedCountries(regions: Set<string>): Set<string> | null {
  if (regions.size === 0) return null;

  const codes = new Set<string>();
  for (const region of regions) {
    const covered = [...(REGION_COUNTRIES[region] ?? []), ...(GEOCODE_REGION_EXTRA[region] ?? [])];
    // `world`, `jazz` and `classical` span continents, so they must not filter.
    if (covered.length === 0) return null;
    for (const code of covered) codes.add(code);
  }

  return codes.size > 0 ? codes : null;
}

/**
 * A concert is played in a town, not in a country or on an island. GeoNames
 * feature codes separate the two, and dropping everything that is not a
 * populated place is what stops `Roma` resolving to the country of Romania.
 */
function isPopulatedPlace(result: GeocodeResult): boolean {
  if (!result.feature_code) return true;
  return result.feature_code.startsWith('PPL');
}

function pickCandidate(
  results: GeocodeResult[],
  query: string,
  allowed: Set<string> | null,
  exactOnly: boolean,
): GeocodeResult | null {
  const wanted = cityKey(query);

  const pool = results
    .filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude))
    .filter((result) => isPopulatedPlace(result))
    .filter((result) => !allowed || allowed.has((result.country_code || '').toUpperCase()))
    .filter((result) => !exactOnly || cityKey(result.name || '') === wanted);

  if (pool.length === 0) return null;

  // The name the feed used is the strongest signal, so an exact match wins even
  // when a larger same-prefix city exists (Jackson before Jacksonville). Within
  // equals, the biggest place wins: Rome over `Roma, Botoșani`.
  return pool
    .map((result) => ({
      result,
      exact: cityKey(result.name || '') === wanted ? 1 : 0,
      population: result.population ?? 0,
    }))
    .sort((a, b) => b.exact - a.exact || b.population - a.population)[0].result;
}

type Choose = (results: GeocodeResult[]) => GeocodeResult | null;

/**
 * English names first (`München` → Munich), then the native index: a label like
 * `Ciudad de México` only exists under the local name.
 */
async function lookup(variant: string, choose: Choose): Promise<GeocodeResult | null> {
  for (const language of ['en', '']) {
    const languageParam = language ? `&language=${language}` : '';
    const url = `${GEOCODER_URL}?name=${encodeURIComponent(variant)}&count=${CANDIDATE_COUNT}${languageParam}&format=json`;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (response.ok) {
          const payload = (await response.json()) as { results?: GeocodeResult[] };
          const match = choose(payload.results || []);
          if (match) return match;
          break;
        }
      } catch {
        // Retry once, then try the other language.
      }

      await sleep(1000);
    }

    await sleep(GEOCODE_DELAY_MS);
  }

  return null;
}

async function geocode(city: CityCandidate, allowed: Set<string> | null): Promise<GeocodeResult | null> {
  // First pass: inside the region, so `Milano` cannot become Milano, Texas.
  for (const variant of searchVariants(city.name)) {
    const match = await lookup(variant, (results) => pickCandidate(results, variant, allowed, false));
    if (match) return match;
    await sleep(GEOCODE_DELAY_MS);
  }

  if (!allowed) return null;

  // Second pass: a city the region list does not cover is still that city when the
  // name matches exactly — `Sevilla`, `Pyrmont`, `Fitzroy`. Population decides
  // between same-named towns, and nothing is invented when there is no exact match.
  for (const variant of searchVariants(city.name)) {
    const match = await lookup(variant, (results) => pickCandidate(results, variant, null, true));
    if (match) return match;
    await sleep(GEOCODE_DELAY_MS);
  }

  return null;
}

function writeTable(table: CoordinateTable): void {
  const sorted: CoordinateTable = {};
  for (const key of Object.keys(table).sort()) sorted[key] = table[key];
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const existing = force ? {} : readExistingTable();

  console.log('Reading upcoming cities from koncerti…');
  const cities = await collectCities();
  console.log(`${cities.length} distinct cities with dates still ahead.`);

  const missing = cities.filter((city) => !existing[city.key]);
  console.log(`${cities.length - missing.length} already geocoded, ${missing.length} to look up.`);

  const table: CoordinateTable = { ...existing };
  const lowConfidence: string[] = [];
  let failures = 0;

  for (const [index, city] of missing.entries()) {
    const allowed = allowedCountries(city.regions);
    const match = await geocode(city, allowed);

    if (!match) {
      failures += 1;
      console.warn(`  ${index + 1}/${missing.length} ${city.name}: no match in region`);
    } else {
      table[city.key] = [
        Number(match.latitude.toFixed(4)),
        Number(match.longitude.toFixed(4)),
      ];
      const where = [match.name, match.admin1, match.country_code].filter(Boolean).join(', ');
      console.log(`  ${index + 1}/${missing.length} ${city.name} → ${where}`);

      // A small, differently-named place is the shape of a bad match. Flagging it
      // keeps the checked-in JSON reviewable without a geocoder on the request path.
      const inexact = cityKey(match.name || '') !== city.key;
      if (inexact && (match.population ?? 0) < LOW_CONFIDENCE_POPULATION) {
        lowConfidence.push(`${city.name} → ${where}`);
      }
    }
  }

  for (const [key, coordinate] of Object.entries(MANUAL_OVERRIDES)) {
    table[key] = coordinate;
    console.log(`  manual override ${key} → ${coordinate[0]}, ${coordinate[1]}`);
  }

  writeTable(table);

  const covered = cities.filter((city) => table[city.key]).length;
  const percentage = cities.length === 0 ? 0 : (covered / cities.length) * 100;
  console.log(`\ngeocoded ${covered} of ${cities.length} distinct cities (${percentage.toFixed(1)}%)`);
  console.log(`wrote ${Object.keys(table).length} entries to lib/city-coordinates.json`);

  if (failures > 0) {
    console.warn(`${failures} cities had no match inside their region; the rail treats them as unknown distance.`);
  }

  if (lowConfidence.length > 0) {
    console.log(`\n${lowConfidence.length} low-confidence matches worth eyeballing:`);
    for (const line of lowConfidence) console.log(`  ${line}`);
  }
}

main().catch((error: unknown) => {
  console.error('City coordinate build failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
