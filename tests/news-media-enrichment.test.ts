import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  resolveRelatedNewsMedia: vi.fn(),
}));

vi.mock('@/lib/news-media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/news-media')>();
  return {
    ...actual,
    resolveRelatedNewsMedia: mocks.resolveRelatedNewsMedia,
  };
});

import { enrichGeneratedNewsMedia } from '@/lib/news-media-enrichment';

function longArticle(paragraphCount: number): string {
  return Array.from({ length: paragraphCount }, (_, index) => (
    `Paragraph ${index + 1} covers the confirmed music news context with enough editorial detail for the article validation gate. ` +
    'Additional reporting context keeps this test article comfortably above the required word count for generated content.'
  )).join('\n\n');
}

function createNewsSupabaseMock(rows: Array<Record<string, unknown>>) {
  const updates: Array<{ payload: Record<string, unknown>; id: string | number }> = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const supabase = {
    from: vi.fn((table: string) => {
      if (table !== 'news') throw new Error(`Unexpected table: ${table}`);

      return {
        ...query,
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn(async (_column: string, id: string | number) => {
            updates.push({ payload, id });
            return { error: null };
          }),
        })),
      };
    }),
  } as unknown as SupabaseClient;

  return { supabase, query, updates };
}

const generatedArticle = {
  id: 7,
  title: 'Harbor Lights Ensemble announces a new album',
  excerpt: 'The group is preparing a new studio release.',
  image: 'https://cdn.example.com/harbor-headline.jpg',
  ai_content: longArticle(6),
  ai_generated: true,
  ai_status: 'generated',
  created_at: new Date().toISOString(),
  layout1: null,
  layout2: null,
};

describe('generated news media persistence', () => {
  it('queries only generated LATEST rows and persists both layouts', async () => {
    mocks.resolveRelatedNewsMedia.mockResolvedValue({
      video: {
        subjectQuery: 'Harbor Lights Ensemble',
        videoId: 'AAAAAAAAAAA',
        videoTitle: 'Harbor Lights Ensemble interview',
        channelTitle: 'Harbor Lights Official',
        videoUrl: 'https://www.youtube.com/watch?v=AAAAAAAAAAA',
        embedUrl: 'https://www.youtube.com/embed/AAAAAAAAAAA?rel=0',
        thumbnailUrl: 'https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg',
        publishedAt: new Date().toISOString(),
        viewCount: 5000,
      },
      images: [{
        src: 'https://upload.wikimedia.org/harbor-portrait.jpg',
        alt: 'Harbor Lights Ensemble portrait',
        caption: 'Wikimedia Commons',
      }],
    });

    const { supabase, query, updates } = createNewsSupabaseMock([generatedArticle]);
    const result = await enrichGeneratedNewsMedia(supabase);

    expect(query.eq).toHaveBeenCalledWith('category', 'LATEST');
    expect(query.eq).toHaveBeenCalledWith('ai_status', 'generated');
    expect(query.eq).toHaveBeenCalledWith('ai_generated', true);
    expect(query.or).toHaveBeenCalledWith('layout1.is.null,layout2.is.null');
    expect(query.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(mocks.resolveRelatedNewsMedia).toHaveBeenCalledWith({
      title: generatedArticle.title,
      excerpt: generatedArticle.excerpt,
      excludedUrls: [generatedArticle.image, null, null],
      needsSecondImage: true,
    });
    expect(updates).toEqual([{
      id: generatedArticle.id,
      payload: {
        layout1: 'https://www.youtube.com/watch?v=AAAAAAAAAAA',
        layout2: 'https://upload.wikimedia.org/harbor-portrait.jpg',
      },
    }]);
    expect(result).toEqual({
      inspected: 1,
      updated: 1,
      videoFound: 1,
      imageFallbacks: 0,
      skipped: 0,
      noMedia: 0,
      failed: 0,
    });
  });

  it('does not update thin or fallback rows even if a query mock returns them', async () => {
    mocks.resolveRelatedNewsMedia.mockReset();
    const { supabase, updates } = createNewsSupabaseMock([
      {
        ...generatedArticle,
        id: 8,
        ai_content: 'Too short to pass the editorial validation gate.',
      },
      {
        ...generatedArticle,
        id: 9,
        ai_status: 'fallback',
      },
    ]);

    const result = await enrichGeneratedNewsMedia(supabase);

    expect(mocks.resolveRelatedNewsMedia).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(result).toMatchObject({ inspected: 2, skipped: 2, updated: 0, failed: 0 });
  });

  it('leaves complete stored layouts untouched and counts provider misses separately', async () => {
    mocks.resolveRelatedNewsMedia.mockResolvedValue({ video: null, images: [] });
    const completeArticle = {
      ...generatedArticle,
      id: 10,
      layout1: 'https://www.youtube.com/watch?v=BBBBBBBBBBB',
      layout2: 'https://upload.wikimedia.org/already-stored.jpg',
    };
    const { supabase, updates } = createNewsSupabaseMock([completeArticle]);

    const result = await enrichGeneratedNewsMedia(supabase);

    expect(mocks.resolveRelatedNewsMedia).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(result).toMatchObject({ inspected: 1, skipped: 1, noMedia: 0, failed: 0 });
  });
});
