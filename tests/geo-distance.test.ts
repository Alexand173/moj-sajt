import { describe, expect, it } from 'vitest';
import { haversineKm, isCoordinate, parseCoordinate } from '@/lib/geo-distance';

const LONDON = { latitude: 51.5074, longitude: -0.1278 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const WARSAW = { latitude: 51.1079, longitude: 17.0385 };
const KRAKOW = { latitude: 50.0647, longitude: 19.945 };

describe('haversineKm', () => {
  it('measures a known pair', () => {
    expect(Math.round(haversineKm(LONDON, PARIS))).toBe(344);
  });

  it('is zero for the same point', () => {
    expect(hawSaneZero()).toBe(0);
  });

  it('matches a second known pair', () => {
    const km = haversineKm(WARSAW, KRAKOW);
    expect(km).toBeGreaterThan(230);
    expect(km).toBeLessThan(250);
  });

  it('measures across the antimeridian the short way', () => {
    const distance = haversineKm({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 });
    expect(distance).toBeLessThan(120);
  });

  it('is symmetric', () => {
    expect(haversineKm(PARIS, LONDON)).toBeCloseTo(haversineKm(LONDON, PARIS), 6);
  });
});

function hawSaneZero(): number {
  return haversineKm(LONDON, { latitude: LONDON.latitude, longitude: LONDON.longitude });
}

describe('parseCoordinate', () => {
  it('reads the string form geo providers send', () => {
    expect(parseCoordinate('52.2297', '21.0122')).toEqual({ latitude: 52.2297, longitude: 21.0122 });
  });

  it('rejects values off the globe', () => {
    expect(parseCoordinate('91.0', '21.0')).toBeNull();
    expect(parseCoordinate('52.0', '181.0')).toBeNull();
  });

  it('rejects missing or unparseable input', () => {
    expect(parseCoordinate(null, null)).toBeNull();
    expect(parseCoordinate('', '')).toBeNull();
    expect(parseCoordinate('north', 'east')).toBeNull();
    expect(parseCoordinate(undefined, 21)).toBeNull();
  });

  it('keeps the equator and prime meridian', () => {
    expect(parseCoordinate(0, 0)).toEqual({ latitude: 0, longitude: 0 });
  });
});

describe('isCoordinate', () => {
  it('accepts valid coordinates and rejects impostors', () => {
    expect(isCoordinate(WARSAW)).toBe(true);
    expect(isCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
    expect(isCoordinate({ latitude: 120, longitude: 0 })).toBe(false);
    expect(isCoordinate({})).toBe(false);
    expect(isCoordinate(null)).toBe(false);
    expect(isCoordinate('52,21')).toBe(false);
  });
});
