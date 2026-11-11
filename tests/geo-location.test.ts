import { beforeEach, describe, expect, it } from 'vitest';
import {
  describeRequestIp,
  getRequestLocation,
  locationFromIpRecord,
  resolvePlaceName,
} from '@/lib/geo-location';
import { findCityByName, findNearestCity, gazetteerSize } from '@/lib/visitor-cities';
import { getCityCoordinates } from '@/lib/city-coordinates';
import { haversineKm, type Coordinate } from '@/lib/geo-distance';

/**
 * The visits that were wrong in production, expressed as data.
 *
 * The case that started this: a visitor in Niš whose address resolved to the
 * village Brezovica, so the tickets page said "Near Brezovica" and the rail
 * ranked every Serbian date as unplaceable.
 */

/**
 * A village inside the Niš basin: about 9 km from Niš and 28 km from Leskovac,
 * so there is one obvious regional centre. The exact village does not matter —
 * what matters is a locality with no entry of its own.
 */
const BREZOVICA = { latitude: 43.25, longitude: 21.95 };
const NIS = { latitude: 43.3247, longitude: 21.9033 };

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

beforeEach(() => {
  // Never inflate the 50 MB database in a unit test.
  process.env.GEOIP_DISABLED = '1';
});

describe('visitor city gazetteer', () => {
  it('knows the cities the ticket feed can actually place', () => {
    expect(gazetteerSize()).toBeGreaterThan(30_000);
    expect(findCityByName('Niš', 'RS')?.name).toBe('Niš');
    expect(findCityByName('Mason City', 'US')?.name).toBe('Mason City');
    expect(findCityByName('New York', 'US')?.name).toBe('New York');
  });

  it('matches through accents and punctuation', () => {
    expect(findCityByName('Nis', 'RS')?.name).toBe('Niš');
    expect(findCityByName('Copenhagen')?.countryCode).toBe('DK');
    // `ł` and `ø` do not decompose under NFKD, so they need folding of their own
    // or a Polish and a Norwegian visitor are unplaceable.
    expect(findCityByName('Lodz')?.name).toBe('Łódź');
    expect(findCityByName('Tromso')?.name).toBe('Tromsø');
  });

  it('keeps the spelling the database and the visitor use, not GeoNames', () => {
    // GeoNames stores "New York City"; the platform says "New York".
    const city = findCityByName('New York', 'US');

    expect(city?.name).toBe('New York');
    expect(findCityByName('Copenhagen', 'DK')?.name).toBe('Copenhagen');
  });

  it('refuses a name it does not know, which is what makes a village a village', () => {
    expect(findCityByName('Brezovica', 'RS')).toBeNull();
  });

  it('knows a city by the name its own country uses', () => {
    // GeoNames files the city as `Rome`; the promoter, the poster and the person
    // on the phone say `Roma`. Without the alias index a Rome date measured 620
    // km from Niš — the distance to a 3,000-person commune in Botoșani.
    expect(findCityByName('Roma')?.name).toBe('Rome');
    expect(findCityByName('Wien')?.name).toBe('Vienna');
    expect(findCityByName('Milano')?.name).toBe('Milan');
    expect(findCityByName('Beograd')?.name).toBe('Belgrade');
  });

  it('lets the country decide between a metropolis and its namesake', () => {
    expect(findCityByName('Paris')?.countryCode).toBe('FR');
    expect(findCityByName('Paris', 'US')?.countryCode).toBe('US');
    // An alias that contradicts the country is refused, not corrected: a row
    // filed under Romania is not quietly moved to Italy.
    expect(findCityByName('Roma', 'RO')).toBeNull();
  });

  it('finds the nearest city inside the radius and the same country', () => {
    const nearest = findNearestCity(BREZOVICA, { countryCode: 'RS', maxKm: 75 });

    expect(nearest?.city.name).toBe('Niš');
    // Close enough to be the same city for a concert, far enough that it is
    // genuinely a snap and not an exact hit.
    expect(nearest?.distanceKm).toBeGreaterThan(2);
    expect(nearest?.distanceKm).toBeLessThan(75);
  });

  it('never crosses a border to find a name', () => {
    // Sofia's coordinates, claimed as Serbia: the nearest Serbian city is far
    // outside 75 km, so the answer must be nothing rather than a Bulgarian city.
    const nearest = findNearestCity({ latitude: 42.6977, longitude: 23.3219 }, { countryCode: 'RS', maxKm: 75 });

    expect(nearest).toBeNull();
  });
});

describe('resolvePlaceName', () => {
  it('turns the village into the city a person would name', () => {
    const resolved = resolvePlaceName({
      name: 'Brezovica',
      countryCode: 'RS',
      countryName: 'Serbia',
      ...BREZOVICA,
      accuracyRadiusKm: 50,
    });

    expect(resolved).toEqual({ name: 'Niš', snapped: true });
  });

  it('keeps a name the gazetteer already knows', () => {
    const resolved = resolvePlaceName({
      name: 'Mason City',
      countryCode: 'US',
      countryName: 'United States',
      latitude: 43.1536,
      longitude: -93.201,
      accuracyRadiusKm: 20,
    });

    expect(resolved).toEqual({ name: 'Mason City', snapped: false });
  });

  it('canonicalises the spelling to the one the feed uses', () => {
    const resolved = resolvePlaceName({
      name: 'Nis',
      countryCode: 'RS',
      countryName: 'Serbia',
      ...NIS,
      accuracyRadiusKm: 20,
    });

    expect(resolved.name).toBe('Niš');
  });

  it('does not invent a city from a country-sized block', () => {
    // 8.8.8.8: the United States, no city, a 1,000 km radius. Snapping this is
    // how a Kansas town got attached to Google's DNS resolver.
    const resolved = resolvePlaceName({
      name: null,
      countryCode: 'US',
      countryName: 'United States',
      latitude: 37.751,
      longitude: -97.822,
      accuracyRadiusKm: 1000,
    });

    expect(resolved).toEqual({ name: null, snapped: false });
  });

  it('leaves an unplaceable name alone when there is no coordinate', () => {
    const resolved = resolvePlaceName({
      name: 'Brezovica',
      countryCode: 'RS',
      countryName: 'Serbia',
      latitude: null,
      longitude: null,
    });

    expect(resolved).toEqual({ name: 'Brezovica', snapped: false });
  });
});

describe('getRequestLocation', () => {
  it('corrects the platform label it was given', async () => {
    const location = await getRequestLocation(headers({
      'x-vercel-ip-country': 'RS',
      'x-vercel-ip-city': encodeURIComponent('Brezovica'),
      'x-vercel-ip-latitude': String(BREZOVICA.latitude),
      'x-vercel-ip-longitude': String(BREZOVICA.longitude),
    }));

    expect(location?.city).toBe('Niš');
    expect(location?.source).toBe('vercel');
    expect(location?.snappedFrom).toBe('Brezovica');
    expect(location?.regionKey).toBe('europa');
  });

  it('prefers Cloudflare headers when they are present', async () => {
    // Header values are bytes, so a non-ASCII city arrives percent-encoded —
    // exactly as Vercel sends `Ni%C5%A1`.
    const location = await getRequestLocation(headers({
      'cf-ipcity': encodeURIComponent('Niš'),
      'cf-ipcountry': 'RS',
      'cf-iplatitude': String(NIS.latitude),
      'cf-iplongitude': String(NIS.longitude),
      'x-vercel-ip-city': 'Brezovica',
      'x-vercel-ip-country': 'RS',
    }));

    expect(location?.source).toBe('cloudflare');
    expect(location?.city).toBe('Niš');
  });

  it('returns null when nothing places the visitor', async () => {
    expect(await getRequestLocation(headers({}))).toBeNull();
  });
});

describe('resolvePlaceName with the names the services send', () => {
  it('strips the district db-ip.com puts in brackets', () => {
    // db-ip.com writes `Madrid (Fuencarral - El Pardo)`; the visitor wants
    // Madrid, and that is the city the service itself named.
    expect(resolvePlaceName({
      name: 'Madrid (Fuencarral - El Pardo)',
      countryCode: 'ES',
      countryName: 'Spain',
      latitude: null,
      longitude: null,
    })).toEqual({ name: 'Madrid', snapped: false });
  });

  it('keeps the city the service named, even a small one', () => {
    // The page says what the service answers — no second guess at it.
    expect(resolvePlaceName({
      name: 'Falkensee',
      countryCode: 'DE',
      countryName: 'Germany',
      latitude: null,
      longitude: null,
    })).toEqual({ name: 'Falkensee', snapped: false });
  });

  it('spells the city the way the concert feed does', () => {
    // ipwho.is answers `Nis`; the feed and the page say `Niš`.
    expect(resolvePlaceName({
      name: 'Nis',
      countryCode: 'RS',
      countryName: 'Serbia',
      ...NIS,
    })).toEqual({ name: 'Niš', snapped: false });
  });
});

describe('describeRequestIp', () => {
  it('reads the visitor from x-forwarded-for and says which header it used', () => {
    const address = describeRequestIp(headers({
      'x-forwarded-for': '203.0.113.9, 76.76.21.21',
      'x-real-ip': '76.76.21.21',
    }));

    expect(address.ip).toBe('203.0.113.9');
    expect(address.header).toBe('x-forwarded-for');
    // Both headers are reported, so a disagreement can be read rather than guessed.
    expect(address.candidates).toHaveLength(2);
    expect(address.candidates[0].used).toBe(true);
  });

  it('falls through a private hop to the header that carries a real address', () => {
    const address = describeRequestIp(headers({
      'x-forwarded-for': '192.168.1.5',
      'x-real-ip': '203.0.113.9',
    }));

    expect(address.ip).toBe('203.0.113.9');
    expect(address.header).toBe('x-real-ip');
    expect(address.candidates[0].isPublic).toBe(false);
  });

  it('never returns carrier-grade NAT, which cannot be placed', () => {
    expect(describeRequestIp(headers({ 'x-forwarded-for': '100.64.3.4' })).ip).toBeNull();
  });

  it('normalizes a port or an IPv4-mapped address before the reader sees it', () => {
    expect(describeRequestIp(headers({ 'x-real-ip': '203.0.113.9:51514' })).ip).toBe('203.0.113.9');
    expect(describeRequestIp(headers({ 'x-real-ip': '::ffff:203.0.113.9' })).ip).toBe('203.0.113.9');
  });
});

describe('locationFromIpRecord', () => {
  it('uses the coordinate the service reported', () => {
    // ipwho.is answers the city and its point.
    const location = locationFromIpRecord({
      city: 'Nis',
      countryCode: 'RS',
      countryName: 'Serbia',
      subdivision: 'Nisava',
      latitude: 43.3247223,
      longitude: 21.9033327,
      accuracyRadiusKm: null,
      provider: 'ipwhois',
    });

    expect(location.city).toBe('Niš');
    expect(location.source).toBe('ipwhois');
    expect(location.regionKey).toBe('europa');
    expect(location.latitude).toBeCloseTo(43.32, 1);
    expect(location.longitude).toBeCloseTo(21.9, 1);
  });

  it('asks the gazetteer for a point when the service sends none', () => {
    // db-ip.com answers a name only; the ranking still needs somewhere to measure from.
    const location = locationFromIpRecord({
      city: 'Niš',
      countryCode: 'RS',
      countryName: 'Serbia',
      subdivision: 'Central Serbia',
      latitude: null,
      longitude: null,
      accuracyRadiusKm: null,
      provider: 'dbip',
    });

    expect(location.source).toBe('dbip');
    expect(location.latitude).toBeCloseTo(43.32, 1);
    expect(location.longitude).toBeCloseTo(21.9, 1);
  });

  it('keeps the country when the city cannot be placed', () => {
    const location = locationFromIpRecord({
      city: 'Somewhere Unknown',
      countryCode: 'RS',
      countryName: 'Serbia',
      subdivision: null,
      latitude: null,
      longitude: null,
      accuracyRadiusKm: null,
      provider: 'dbip',
    });

    expect(location.countryCode).toBe('RS');
    expect(location.regionKey).toBe('europa');
    expect(location.latitude).toBeNull();
  });
});

describe('getCityCoordinates', () => {
  it('resolves promoter label noise instead of leaving the distance empty', () => {
    const gdansk = getCityCoordinates('Gdańsk');

    expect(gdansk).not.toBeNull();
    expect(getCityCoordinates('Gdańsk/Sopot')).toEqual(gdansk);
    expect(getCityCoordinates('København S')).not.toBeNull();
    expect(getCityCoordinates('Merksem (Antwerpen)')).not.toBeNull();
  });

  it('resolves Göteborg, whose manual override was stored under the wrong key', () => {
    expect(getCityCoordinates('Göteborg')).toEqual({ latitude: 57.7089, longitude: 11.9746 });
  });

  it('measures a Rome date from Niš at the real ~785 km, not 620', () => {
    // The regression that made the rail lie: `Roma` had been geocoded to
    // Roma, Botoșani (47.83, 26.6), so a Rome show read 620 km away — closer
    // than Vienna, which is 692.
    const rome = getCityCoordinates('Roma');
    if (!rome) throw new Error('the coordinate table is missing Roma');

    const distanceKm = haversineKm(NIS, rome);

    expect(distanceKm).toBeGreaterThan(760);
    expect(distanceKm).toBeLessThan(810);
    expect(distanceKm).toBeGreaterThan(haversineKm(NIS, getCityCoordinates('Vienna') as Coordinate));
  });

  it('places a city the checked-in table has never seen', () => {
    // The table is built from cities that have dates; the gazetteer is the net
    // under a venue that went on sale after the last build.
    expect(getCityCoordinates('Thessaloniki')).not.toBeNull();
  });
});
