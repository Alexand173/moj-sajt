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

import {
  enrichPendingNews,
  enrichPendingOfficialNews,
  getAiNewsBatchSize,
  getAiNewsConcurrency,
  getAiNewsStatus,
  getAiNewsWindowDays,
} from '@/lib/news-ai-enrichment';

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
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
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

  return {
    supabase,
    updates,
    categoryFilter: query.in,
    windowFilter: query.gte,
    statusFilter: query.or,
    exclusionFilter: query.not,
    orderBy: query.order,
  };
}

describe('news AI persistence', () => {
  beforeEach(() => {
    mocks.responsesCreate.mockReset();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.NEWS_API_KEY;
    delete process.env.AI_NEWS_BATCH_SIZE;
    delete process.env.AI_NEWS_WINDOW_DAYS;
    delete process.env.AI_NEWS_CONCURRENCY;
  });

  it('maps a validated rewrite to the generated status', () => {
    expect(getAiNewsStatus({ isAiGenerated: true, similarityCheckPassed: true })).toBe('generated');
    expect(getAiNewsStatus({ isAiGenerated: false, similarityCheckPassed: false })).toBe('fallback');
  });

  it('defaults to a batch of twenty rows that can be overridden but never exceeded', () => {
    expect(getAiNewsBatchSize()).toBe(20);

    process.env.AI_NEWS_BATCH_SIZE = '7';
    expect(getAiNewsBatchSize()).toBe(7);

    process.env.AI_NEWS_BATCH_SIZE = '50';
    expect(getAiNewsBatchSize()).toBe(20);
  });

  it('looks twenty-one days back by default so a backlog can drain', () => {
    expect(getAiNewsWindowDays()).toBe(21);

    process.env.AI_NEWS_WINDOW_DAYS = '40';
    expect(getAiNewsWindowDays()).toBe(40);

    process.env.AI_NEWS_WINDOW_DAYS = '500';
    expect(getAiNewsWindowDays()).toBe(90);
  });

  it('rewrites four articles at a time by default', () => {
    expect(getAiNewsConcurrency()).toBe(4);

    process.env.AI_NEWS_CONCURRENCY = '50';
    expect(getAiNewsConcurrency()).toBe(8);
  });

  it('retries rows whose rewrite previously fell back, after a cooldown', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, statusFilter } = createNewsSupabaseMock();

    await enrichPendingNews(supabase);

    const filter = statusFilter.mock.calls[0][0] as string;
    expect(filter).toContain('ai_status.is.null');
    expect(filter).toContain('ai_status.eq.pending');
    expect(filter).toContain('and(ai_status.eq.fallback,ai_generated_at.lt.');
    expect(filter).toContain('and(ai_status.eq.fallback,ai_generated_at.is.null)');
  });

  it('defaults enrichment queries to LATEST NewsAPI rows', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, categoryFilter } = createNewsSupabaseMock();

    await enrichPendingNews(supabase);

    expect(categoryFilter).toHaveBeenCalledWith('category', ['LATEST']);
  });

  it('runs the same rewrite pipeline for official publisher rows on request', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, categoryFilter } = createNewsSupabaseMock();

    await enrichPendingOfficialNews(supabase);

    expect(categoryFilter).toHaveBeenCalledWith('category', ['OFFICIAL']);
  });

  it('selects the oldest outstanding rows first so the tail of the backlog advances', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, orderBy, windowFilter } = createNewsSupabaseMock();

    await enrichPendingNews(supabase);

    expect(orderBy).toHaveBeenNthCalledWith(1, 'created_at', { ascending: true });
    expect(orderBy).toHaveBeenNthCalledWith(2, 'id', { ascending: true });

    const windowStart = new Date(windowFilter.mock.calls[0][1] as string).getTime();
    const windowDays = (Date.now() - windowStart) / 86_400_000;
    expect(windowDays).toBeGreaterThan(20.9);
    expect(windowDays).toBeLessThan(21.1);
  });

  it('can still be asked for newest first, which only manual spot checks need', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, orderBy } = createNewsSupabaseMock();

    await enrichPendingNews(supabase, 20, { order: 'newest' });

    expect(orderBy).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
  });

  it('keeps already failed rows out of the selection', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, exclusionFilter } = createNewsSupabaseMock();

    await enrichPendingNews(supabase, 20, { excludeIds: [11, 'abc', 'bad id)'] });
    expect(exclusionFilter).toHaveBeenCalledWith('id', 'in', '(11,abc)');

    exclusionFilter.mockClear();
    await enrichPendingNews(supabase);
    expect(exclusionFilter).not.toHaveBeenCalled();
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

    expect(result).toMatchObject({ inspected: 1, generated: 1, fallback: 0, skipped: 0, failed: 0 });
    expect(updates).toEqual([{
      id: 42,
      payload: {
        ai_content: 'The upcoming release is expected in October, while the group has not shared additional touring plans. Details about the final track list remain limited.',
        ai_similarity_score: expect.any(Number),
        ai_generated: true,
        ai_status: 'generated',
        ai_generated_at: expect.any(String),
      },
    }]);
  });

  it('leaves pending rows untouched when the OpenAI key is unavailable', async () => {
    delete process.env.OPENAI_API_KEY;
    const { supabase, updates } = createNewsSupabaseMock();

    const result = await enrichPendingNews(supabase);

    expect(result).toMatchObject({ inspected: 1, generated: 0, fallback: 0, skipped: 1, failed: 0 });
    expect(updates).toHaveLength(0);
    expect(mocks.responsesCreate).not.toHaveBeenCalled();
  });

  it('does not start a rewrite once the deadline has passed', async () => {
    const { supabase, updates } = createNewsSupabaseMock();

    const result = await enrichPendingNews(supabase, 20, { deadlineAt: Date.now() - 1_000 });

    expect(mocks.responsesCreate).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(result).toMatchObject({ inspected: 1, deferred: 1, truncated: true });
  });

  it('leaves a row pending when the provider reports exhausted quota', async () => {
    mocks.responsesCreate.mockRejectedValue(new Error('429 You exceeded your current quota'));

    const { supabase, updates } = createNewsSupabaseMock();
    const result = await enrichPendingNews(supabase);

    expect(updates).toHaveLength(0);
    expect(result).toMatchObject({ quotaExhausted: true, generated: 0, fallback: 0, deferred: 1 });
  });
});
