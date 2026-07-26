import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  responsesCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = {
      create: mocks.responsesCreate,
    };
  },
}));

import { enrichPendingNews, getAiNewsStatus } from '@/lib/news-ai-enrichment';

function createNewsSupabaseMock() {
  const updates: Array<{ payload: Record<string, unknown>; id: string | number }> = [];
  const pendingRows = [{
    id: 42,
    title: 'Harbor Lights Ensemble Announces Fictional October Album',
    excerpt: 'The group is preparing a new studio release after a summer recording session.',
    content: 'A publisher reported that Harbor Lights Ensemble plans a studio album in October after summer sessions. The band has not announced a tour or guest performers.',
    url: null,
    category: 'LATEST',
  }];

  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: pendingRows, error: null }),
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

  return { supabase, updates, categoryFilter: query.eq };
}

describe('news AI persistence', () => {
  beforeEach(() => {
    mocks.responsesCreate.mockReset();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.NEWS_API_KEY;
  });

  it('maps a validated rewrite to the generated status', () => {
    expect(getAiNewsStatus({ isAiGenerated: true, similarityCheckPassed: true })).toBe('generated');
    expect(getAiNewsStatus({ isAiGenerated: false, similarityCheckPassed: false })).toBe('fallback');
  });

  it('limits enrichment queries to LATEST NewsAPI rows', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, categoryFilter } = createNewsSupabaseMock();

    await enrichPendingNews(supabase);

    expect(categoryFilter).toHaveBeenCalledWith('category', 'LATEST');
  });

  it('persists generated content, similarity, boolean, and status fields', async () => {
    mocks.responsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        seoTitle: 'Harbor Lights Album Update',
        seoDescription: 'The band is preparing a new studio release.',
        articleContent: 'The upcoming release is expected in October, while the group has not shared additional touring plans. Details about the final track list remain limited.',
      }),
    });

    const { supabase, updates } = createNewsSupabaseMock();
    const result = await enrichPendingNews(supabase);

    expect(result).toEqual({ inspected: 1, generated: 1, fallback: 0, skipped: 0, failed: 0 });
    expect(updates).toEqual([{
      id: 42,
      payload: {
        ai_content: 'The upcoming release is expected in October, while the group has not shared additional touring plans. Details about the final track list remain limited.',
        ai_similarity_score: expect.any(Number),
        ai_generated: true,
        ai_status: 'generated',
      },
    }]);
  });

  it('leaves pending rows untouched when the OpenAI key is unavailable', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, updates } = createNewsSupabaseMock();

    const result = await enrichPendingNews(supabase);

    expect(result).toEqual({ inspected: 1, generated: 0, fallback: 0, skipped: 1, failed: 0 });
    expect(updates).toHaveLength(0);
    expect(mocks.responsesCreate).not.toHaveBeenCalled();
  });
});
