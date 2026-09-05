import { describe, expect, it } from 'vitest';
import {
  buildSoundchartsFilter,
  REGION_COUNTRY_MAP,
  SOUNDCHARTS_TO_DB_GENRE,
  TARGET_REGIONS,
} from '@/lib/auto-updater';


describe('Soundcharts chart updater configuration', () => {
  it('covers the dashboard regions used by the regional chart routes', () => {
    expect(TARGET_REGIONS.map((region) => region.regionName)).toEqual([
      'US',
      'UK',
      'LATINO',
      'GERMANY',
      'FRANCE',
      'ITALY',
      'POLAND',
      'NORDIC',
      'BALTIC',
      'BALKAN',
      'OTHER',
      'ASIA',
      'WORLD',
    ]);
    expect(REGION_COUNTRY_MAP).toMatchObject({
      US: ['US'],
      UK: ['GB'],
      GERMANY: ['DE'],
      NORDIC: ['SE', 'NO', 'DK', 'FI', 'IS'],
      OTHER: ['AT', 'BE', 'CH', 'CY', 'CZ', 'HU', 'IE', 'LU', 'MT', 'NL', 'SK'],
      ASIA: ['JP', 'KR', 'CN', 'IN', 'TW', 'TH', 'PH', 'ID', 'VN'],
      WORLD: [],
    });
  });

  it('maps Soundcharts genre slugs to the Supabase genre ids', () => {
    expect(SOUNDCHARTS_TO_DB_GENRE['rock']).toEqual({ dbGenreId: 1 });
    expect(SOUNDCHARTS_TO_DB_GENRE['k-pop']).toEqual({ dbGenreId: 9, countryOverride: ['KR'] });
    expect(SOUNDCHARTS_TO_DB_GENRE['c-pop']).toEqual({ dbGenreId: 10, countryOverride: ['CN', 'TW'] });
    expect(SOUNDCHARTS_TO_DB_GENRE['indian-pop']).toEqual({ dbGenreId: 11, countryOverride: ['IN'] });
  });

  it('encodes country, genre, date range, and Spotify stream filters', () => {
    const encoded = buildSoundchartsFilter(['DE', 'AT'], 'rock', new Date('2026-08-02T12:00:00.000Z'));
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

    expect(payload).toMatchObject({
      s: 'custom.sc_trending_score|desc|month|total',
      f: {
        fc: 'DE,AT',
        ftsg: 'rock',
        frd: '2025-12-22|2026-08-02',
      },
      mi: [['audience.spotify.total', { mm: '' }]],
    });
  });
});
