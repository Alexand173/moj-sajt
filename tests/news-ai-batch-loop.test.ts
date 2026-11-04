import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  enrichPendingNews: vi.fn(),
}));

vi.mock('@/lib/news-ai-enrichment', () => ({
  AI_NEWS_DEADLINE_SAFETY_MS: 2_000,
  enrichPendingNews: mocks.enrichPendingNews,
  getAiNewsBatchSize: () => 20,
  getAiNewsConcurrency: () => 4,
  getAiNewsWindowDays: () => 21,
}));

import {
  DEFAULT_AI_BATCHES_PER_RUN,
  MAX_AI_BATCHES_PER_RUN,
  runEnrichmentBatches,
} from '@/lib/news-ai-batch-loop';

const supabase = { id: 'batch-client' } as unknown as SupabaseClient;

function outcome(overrides: Record<string, unknown> = {}) {
  return {
    inspected: 20,
    generated: 20,
    fallback: 0,
    skipped: 0,
    failed: 0,
    deferred: 0,
    truncated: false,
    failedIds: [],
    quotaExhausted: false,
    ...overrides,
  };
}

describe('news AI batch loop', () => {
  beforeEach(() => {
    mocks.enrichPendingNews.mockReset();
    delete process.env.AI_NEWS_MAX_BATCHES;
  });

  it('repeats batches until the configured batch budget is reached', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome());

    const result = await runEnrichmentBatches(supabase, { maxBatches: 3 });

    expect(mocks.enrichPendingNews).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      inspected: 60,
      generated: 60,
      batches: 3,
      stopReason: 'batch-budget',
    });
  });

  it('defaults to ten batches per invocation', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome());

    const result = await runEnrichmentBatches(supabase);

    expect(DEFAULT_AI_BATCHES_PER_RUN).toBe(10);
    expect(result.batches).toBe(DEFAULT_AI_BATCHES_PER_RUN);
  });

  it('never exceeds the hard batch ceiling', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome());

    const result = await runEnrichmentBatches(supabase, { maxBatches: 500 });

    expect(result.batches).toBe(MAX_AI_BATCHES_PER_RUN);
  });

  it('stops as soon as the queue returns nothing', async () => {
    mocks.enrichPendingNews
      .mockResolvedValueOnce(outcome())
      .mockResolvedValueOnce(outcome({ inspected: 0, generated: 0 }));

    const result = await runEnrichmentBatches(supabase, { maxBatches: 10 });

    expect(mocks.enrichPendingNews).toHaveBeenCalledTimes(2);
    expect(result.stopReason).toBe('queue-empty');
  });

  it('treats a short batch as an exhausted queue', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome({ inspected: 7, generated: 7 }));

    const result = await runEnrichmentBatches(supabase, { maxBatches: 10 });

    expect(mocks.enrichPendingNews).toHaveBeenCalledTimes(1);
    expect(result.stopReason).toBe('queue-empty');
    expect(result.generated).toBe(7);
  });

  it('stops when the provider runs out of quota instead of burning the remaining batches', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome({ generated: 0, quotaExhausted: true }));

    const result = await runEnrichmentBatches(supabase, { maxBatches: 10 });

    expect(mocks.enrichPendingNews).toHaveBeenCalledTimes(1);
    expect(result.stopReason).toBe('quota-exhausted');
  });

  it('stops when a batch makes no progress, so a hard row cannot spin the loop', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome({ generated: 0, failed: 20 }));

    const result = await runEnrichmentBatches(supabase, { maxBatches: 10 });

    expect(mocks.enrichPendingNews).toHaveBeenCalledTimes(1);
    expect(result.stopReason).toBe('no-progress');
    expect(result.failed).toBe(20);
  });

  it('does not start a batch once the time budget is spent', async () => {
    mocks.enrichPendingNews.mockResolvedValue(outcome());

    const result = await runEnrichmentBatches(supabase, { maxBatches: 10, timeBudgetMs: 0 });

    expect(mocks.enrichPendingNews).not.toHaveBeenCalled();
    expect(result.batches).toBe(0);
    expect(result.stopReason).toBe('time-budget');
  });

  it('reports a truncated batch as a time-budget stop and keeps its partial totals', async () => {
    mocks.enrichPendingNews.mockResolvedValue(
      outcome({ generated: 5, deferred: 15, truncated: true }),
    );

    const result = await runEnrichmentBatches(supabase, { maxBatches: 10 });

    expect(mocks.enrichPendingNews).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ generated: 5, deferred: 15, stopReason: 'time-budget' });
  });

  it('asks for the oldest outstanding rows inside the window and carries failures forward', async () => {
    mocks.enrichPendingNews
      .mockResolvedValueOnce(outcome({ generated: 19, failed: 1, failedIds: [11] }))
      .mockResolvedValueOnce(outcome({ inspected: 0, generated: 0 }));

    await runEnrichmentBatches(supabase, { batchSize: 20, maxBatches: 10 });

    expect(mocks.enrichPendingNews).toHaveBeenNthCalledWith(
      1,
      supabase,
      20,
      expect.objectContaining({
        order: 'oldest',
        excludeIds: [],
        sinceDays: 21,
      }),
    );
    expect(mocks.enrichPendingNews).toHaveBeenNthCalledWith(
      2,
      supabase,
      20,
      expect.objectContaining({ order: 'oldest', excludeIds: [11] }),
    );
  });
});
