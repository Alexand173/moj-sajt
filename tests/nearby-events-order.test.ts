import { describe, expect, it } from 'vitest';
import { orderNearby, type NearbyCandidate } from '@/lib/nearby-events';

type Row = { id: string };

function candidate(
  id: string,
  patch: Partial<NearbyCandidate<Row>> = {},
): NearbyCandidate<Row> {
  return {
    item: { id },
    city: 'Somewhere',
    artist: id,
    date: '2027-03-01',
    distanceKm: null,
    isLocal: false,
    ...patch,
  };
}

const ids = (candidates: NearbyCandidate<Row>[]) => candidates.map((entry) => entry.item.id);

describe('orderNearby', () => {
  it('puts the visitor’s own city first, whatever the date', () => {
    const ordered = orderNearby([
      candidate('elsewhere-soon', { date: '2026-12-01', distanceKm: 40 }),
      candidate('home-later', { date: '2027-09-01', distanceKm: 0, isLocal: true }),
      candidate('further', { date: '2026-11-01', distanceKm: 900 }),
    ]);

    expect(ids(ordered)).toEqual(['home-later', 'elsewhere-soon', 'further']);
  });

  it('orders the rest by air distance, not by date', () => {
    const ordered = orderNearby([
      candidate('lisbon', { date: '2026-11-02', distanceKm: 2760 }),
      candidate('krakow', { date: '2027-02-11', distanceKm: 252 }),
      candidate('lodz', { date: '2027-04-20', distanceKm: 118 }),
    ]);

    expect(ids(ordered)).toEqual(['lodz', 'krakow', 'lisbon']);
  });

  it('keeps a city we could not place at the end, however soon it is', () => {
    const ordered = orderNearby([
      candidate('unknown-city', { date: '2026-11-01', distanceKm: null }),
      candidate('far-but-known', { date: '2027-01-01', distanceKm: 4000 }),
      candidate('near', { date: '2027-05-01', distanceKm: 30 }),
    ]);

    expect(ids(ordered)).toEqual(['near', 'far-but-known', 'unknown-city']);
  });

  it('breaks distance ties by date, then artist', () => {
    const ordered = orderNearby([
      candidate('b-act', { distanceKm: 200, date: '2027-01-05' }),
      candidate('a-act', { distanceKm: 200, date: '2027-01-05' }),
      candidate('sooner', { distanceKm: 200, date: '2026-12-31' }),
    ]);

    expect(ids(ordered)).toEqual(['sooner', 'a-act', 'b-act']);
  });

  it('reproduces the old order when the visitor has no coordinates', () => {
    const ordered = orderNearby([
      candidate('home-later', { date: '2027-08-01', isLocal: true }),
      candidate('second', { date: '2026-12-15' }),
      candidate('third', { date: '2027-01-20' }),
    ]);

    expect(ids(ordered)).toEqual(['home-later', 'second', 'third']);
  });

  it('does not mutate the input array', () => {
    const input = [candidate('later', { date: '2027-06-01', distanceKm: 500 }), candidate('nearer', { distanceKm: 10 })];
    const before = ids(input);

    orderNearby(input);

    expect(ids(input)).toEqual(before);
  });
});
