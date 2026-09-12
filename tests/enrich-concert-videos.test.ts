import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runConcertVideoEnrichment, selectFreshOfficialVideo } from '@/scripts/enrich-concert-videos';

function createSupabaseMock(rows: Array<Record<string, unknown>>) {
  const updates: Array<{ payload: Record<string, unknown>; names: string[] }> = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const supabase = {
    from: vi.fn(() => ({
      ...query,
      update: vi.fn((payload: Record<string, unknown>) => ({
        in: vi.fn(async (_column: string, names: string[]) => {
          updates.push({ payload, names });
          return { error: null };
        }),
      })),
    })),
  } as unknown as SupabaseClient;

  return { supabase, updates };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.CONCERT_VIDEO_ARTIST;
  vi.restoreAllMocks();
});

describe('concert video selection', () => {
  it('selects the newest eligible official tour video within one year', () => {
    const now = new Date('2026-09-12T00:00:00.000Z');
    const selected = selectFreshOfficialVideo('Bruno Mars', [
      {
        id: { videoId: 'AAAAAAAAAAA' },
        snippet: { title: 'Bruno Mars Official Tour Announcement', channelTitle: 'Bruno Mars', publishedAt: '2026-08-01T00:00:00.000Z' },
      },
      {
        id: { videoId: 'BBBBBBBBBBB' },
        snippet: { title: 'Bruno Mars Official Tour Announcement', channelTitle: 'Bruno Mars', publishedAt: '2026-09-01T00:00:00.000Z' },
      },
    ], now);

    expect(selected).toMatchObject({
      videoId: 'BBBBBBBBBBB',
      videoUrl: 'https://www.youtube.com/watch?v=BBBBBBBBBBB',
    });
  });

  it('rejects old and fan-made videos', () => {
    const selected = selectFreshOfficialVideo('Bruno Mars', [
      {
        id: { videoId: 'AAAAAAAAAAA' },
        snippet: { title: 'Bruno Mars fan reaction to the tour', channelTitle: 'Fan Channel', publishedAt: '2026-09-01T00:00:00.000Z' },
      },
      {
        id: { videoId: 'BBBBBBBBBBB' },
        snippet: { title: 'Bruno Mars official tour announcement', channelTitle: 'Bruno Mars', publishedAt: '2024-09-01T00:00:00.000Z' },
      },
    ], new Date('2026-09-12T00:00:00.000Z'));

    expect(selected).toBeNull();
  });
});

describe('concert video enrichment worker', () => {
  it('searches each normalized artist once and writes one URL to every duplicate row', async () => {
    process.env.YOUTUBE_API_KEY = 'youtube-key';
    const { supabase, updates } = createSupabaseMock([
      { artist_name: 'Bruno Mars', video_url: null },
      { artist_name: 'bruno   mars', video_url: null },
      { artist_name: 'Nick Cave', video_url: null },
    ]);
    const searchQueries: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL) => {
      const query = new URL(input).searchParams.get('q') || '';
      searchQueries.push(query);
      const isBruno = query.toLowerCase().includes('bruno');
      return jsonResponse({
        items: isBruno ? [{
          id: { videoId: 'AAAAAAAAAAA' },
          snippet: { title: 'Bruno Mars official tour announcement', channelTitle: 'Bruno Mars', publishedAt: '2026-09-01T00:00:00.000Z' },
        }] : [{
          id: { videoId: 'BBBBBBBBBBB' },
          snippet: { title: 'Nick Cave official live tour announcement', channelTitle: 'Nick Cave', publishedAt: '2026-09-01T00:00:00.000Z' },
        }],
      });
    });

    const result = await runConcertVideoEnrichment({
      supabase,
      fetchImpl: fetchMock,
      now: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(searchQueries).toEqual([
      'Bruno Mars official tour announcement live clip',
      'Nick Cave official tour announcement live clip',
    ]);
    expect(result).toMatchObject({ inspectedRows: 3, uniqueArtists: 2, processedArtists: 2, updated: 2, unresolved: 0 });
    expect(updates).toEqual([
      { payload: { video_url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' }, names: ['Bruno Mars', 'bruno   mars'] },
      { payload: { video_url: 'https://www.youtube.com/watch?v=BBBBBBBBBBB' }, names: ['Nick Cave'] },
    ]);
  });

  it('can target one exact stored artist_name without scanning another artist', async () => {
    process.env.YOUTUBE_API_KEY = 'youtube-key';
    process.env.CONCERT_VIDEO_ARTIST = 'Bruno Mars';
    const { supabase, updates } = createSupabaseMock([
      { artist_name: 'Bruno Mars', video_url: null },
      { artist_name: 'bruno   mars', video_url: null },
      { artist_name: 'Nick Cave', video_url: null },
    ]);
    const fetchMock = vi.fn(async () => jsonResponse({
      items: [{
        id: { videoId: 'AAAAAAAAAAA' },
        snippet: { title: 'Bruno Mars official tour announcement', channelTitle: 'Bruno Mars', publishedAt: '2026-09-01T00:00:00.000Z' },
      }],
    }));

    const result = await runConcertVideoEnrichment({
      supabase,
      fetchImpl: fetchMock,
      now: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(result.processedArtists).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updates[0]?.names).toEqual(['Bruno Mars', 'bruno   mars']);
  });

  it('does not search again when a unique artist already has a fresh video', async () => {
    process.env.YOUTUBE_API_KEY = 'youtube-key';
    const { supabase, updates } = createSupabaseMock([
      { artist_name: 'Bruno Mars', video_url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' },
    ]);
    const fetchMock = vi.fn(async () => jsonResponse({
      items: [{ id: 'AAAAAAAAAAA', snippet: { publishedAt: '2026-09-01T00:00:00.000Z' } }],
    }));

    const result = await runConcertVideoEnrichment({
      supabase,
      fetchImpl: fetchMock,
      now: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.skippedFreshExisting).toBe(1);
    expect(updates).toHaveLength(0);
  });
});
