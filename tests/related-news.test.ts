import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractNewsTopic, getRelatedNews } from '@/lib/related-news';

interface QueryCall {
  column?: string;
  value?: unknown;
}

function createSupabaseMock(rowsFor: (mode: 'artist' | 'region') => Array<Record<string, unknown>>) {
  const calls: {
    artist: QueryCall[];
    region: QueryCall[];
    publication: QueryCall[];
    not: QueryCall[];
    neq: QueryCall[];
  } = { artist: [], region: [], publication: [], not: [], neq: [] };
  let mode: 'artist' | 'region' = 'region';

  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.neq = vi.fn((column: string, value: unknown) => {
    calls.neq.push({ column, value });
    return query;
  });
  query.ilike = vi.fn((column: string, value: unknown) => {
    calls.artist.push({ column, value });
    mode = 'artist';
    return query;
  });
  query.eq = vi.fn((column: string, value: unknown) => {
    // Region and publication state are separate questions, so they are recorded
    // separately: `region` is which channel, `publication` is whether the row may
    // be shown at all.
    if (column === 'region') calls.region.push({ column, value });
    else calls.publication.push({ column, value });
    mode = 'region';
    return query;
  });
  query.not = vi.fn((column: string, operator: string, value: unknown) => {
    calls.not.push({ column, value: { operator, value } });
    return query;
  });
  query.order = vi.fn(() => query);
  query.limit = vi.fn(async () => ({ data: rowsFor(mode), error: null }));

  const supabase = { from: vi.fn(() => query) } as unknown as SupabaseClient;

  return { supabase, calls };
}

const artistRows = [
  { id: 'a1', title: 'Before the show: Sam Rivers on touring', image: '/one.jpg', category: 'LATEST', region: 'us', created_at: '2026-10-24T00:00:00.000Z' },
  { id: 'a2', title: 'Sam Rivers adds a second night', image: null, category: 'OFFICIAL', region: 'uk', created_at: '2026-10-20T00:00:00.000Z' },
];

describe('related story topic extraction', () => {
  it('picks the artist name from a sentence-case headline', () => {
    expect(extractNewsTopic('Dolly Parton Posthumously Featured on Bad Wolves Cover')).toEqual(['Dolly', 'Parton']);
    expect(extractNewsTopic('Sam Rivers Postpones the Autumn Tour Dates')).toEqual(['Sam', 'Rivers']);
  });

  it('handles all-caps headlines', () => {
    expect(extractNewsTopic('KYUHYUN ANNOUNCES CONTINUE ASIA TOUR')).toEqual(['KYUHYUN']);
  });

  it('reads names that start after a colon', () => {
    expect(extractNewsTopic('Festival recap: Tatiana Huezos takes the top prize')).toEqual(['Tatiana', 'Huezos']);
  });

  it('returns nothing for lowercase or personal headlines', () => {
    expect(extractNewsTopic('sam rivers announces a new tour')).toEqual([]);
    expect(extractNewsTopic('Why i stopped touring')).toEqual([]);
    expect(extractNewsTopic(null)).toEqual([]);
  });
});

describe('related news lookup', () => {
  it('matches other stories that mention the artist in the headline', async () => {
    const { supabase, calls } = createSupabaseMock((mode) => (mode === 'artist' ? artistRows : []));

    const stories = await getRelatedNews(supabase, { id: 'current', title: 'Sam Rivers Postpones the Autumn Tour Dates', region: 'us' });

    expect(stories).toHaveLength(2);
    expect(calls.artist[0]).toEqual({ column: 'title', value: '%Sam Rivers%' });
    expect(calls.neq).toContainEqual({ column: 'id', value: 'current' });
    expect(calls.region).toHaveLength(0);
  });

  it('only ever offers rows that are published and attributed', async () => {
    const { supabase, calls } = createSupabaseMock((mode) => (mode === 'artist' ? artistRows : []));

    await getRelatedNews(supabase, { id: 'current', title: 'Sam Rivers Postpones the Autumn Tour Dates', region: 'us' });

    // Neither candidate query filtered this before, so a sidebar could link to a
    // `skipped` story or to one whose article page now returns 404.
    expect(calls.publication).toContainEqual({ column: 'ai_status', value: 'generated' });
    expect(calls.publication).toContainEqual({ column: 'ai_generated', value: true });
    expect(calls.not).toContainEqual({ column: 'url', value: { operator: 'is', value: null } });
  });

  it('retries with the shorter name and then falls back to the region feed', async () => {
    const { supabase, calls } = createSupabaseMock((mode) => (mode === 'region' ? artistRows.slice(0, 1) : []));

    const stories = await getRelatedNews(supabase, { id: 'current', title: 'Sam Rivers Postpones the Autumn Tour Dates', region: 'us' });

    expect(calls.artist.map((call) => call.value)).toEqual(['%Sam Rivers%', '%Sam%']);
    expect(calls.region).toContainEqual({ column: 'region', value: 'us' });
    expect(stories).toHaveLength(1);
    // The region fallback carries the same publication guards as the artist query.
    expect(calls.not).toContainEqual({ column: 'url', value: { operator: 'is', value: null } });
  });

  it('returns nothing when supabase is unavailable or the headline has no artist', async () => {
    const { supabase, calls } = createSupabaseMock(() => []);

    expect(await getRelatedNews(null, { id: 'current', title: 'Sam Rivers Postpones the Tour', region: 'us' })).toEqual([]);
    expect(await getRelatedNews(supabase, { id: 'current', title: 'apple reveals a new music app', region: 'us' })).toEqual([]);
    expect(calls.artist).toHaveLength(0);
  });
});
