import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ id: 'worker-client' })),
  runEnrichmentBatches: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/news-ai-batch-loop', () => ({
  runEnrichmentBatches: mocks.runEnrichmentBatches,
}));

import {
  createNewsAiWorkerClient,
  getNewsAiWorkerConfig,
  runNewsAiWorker,
} from '@/lib/news-ai-worker';

function loopResult(overrides: Record<string, unknown> = {}) {
  return {
    inspected: 20,
    generated: 20,
    fallback: 0,
    skipped: 0,
    failed: 0,
    deferred: 0,
    batches: 1,
    stopReason: 'queue-empty',
    durationMs: 1_000,
    ...overrides,
  };
}

describe('news AI worker', () => {
  beforeEach(() => {
    mocks.createClient.mockClear();
    mocks.runEnrichmentBatches.mockReset();
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('reports missing configuration without starting Supabase or OpenAI work', async () => {
    const result = await runNewsAiWorker();

    expect(result).toMatchObject({
      configured: false,
      missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'],
      inspected: 0,
      generated: 0,
      skipped: 0,
      failed: 0,
      batches: 0,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.runEnrichmentBatches).not.toHaveBeenCalled();
  });

  it('uses the service-role client and drains the LATEST queue in batches', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    mocks.runEnrichmentBatches.mockResolvedValue(loopResult({ batches: 4, generated: 80 }));

    const result = await runNewsAiWorker(3);

    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    expect(mocks.runEnrichmentBatches).toHaveBeenCalledWith(
      { id: 'worker-client' },
      expect.objectContaining({ categories: ['LATEST'], batchSize: 3 }),
    );
    expect(result).toMatchObject({
      configured: true,
      missing: [],
      batches: 4,
      generated: 80,
    });
  });

  it('spends the whole run on the official queue when asked', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    mocks.runEnrichmentBatches.mockResolvedValue(loopResult());

    await runNewsAiWorker(undefined, { officialOnly: true });

    expect(mocks.runEnrichmentBatches).toHaveBeenCalledTimes(1);
    expect(mocks.runEnrichmentBatches).toHaveBeenCalledWith(
      { id: 'worker-client' },
      expect.objectContaining({ categories: ['OFFICIAL'], batchSize: undefined }),
    );
  });

  it('runs both queues and adds their totals when both are requested', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    mocks.runEnrichmentBatches
      .mockResolvedValueOnce(loopResult({ batches: 2, generated: 40, inspected: 40 }))
      .mockResolvedValueOnce(loopResult({ batches: 1, generated: 10, inspected: 10, stopReason: 'queue-empty' }));

    const result = await runNewsAiWorker(undefined, { includeOfficial: true });

    expect(mocks.runEnrichmentBatches).toHaveBeenCalledTimes(2);
    // Official first: those rows are worthless until rewritten, and a run that
    // dies mid-flight must not leave them for another whole cycle.
    expect(mocks.runEnrichmentBatches.mock.calls.map((call) => (call[1] as { categories: string[] }).categories[0]))
      .toEqual(['OFFICIAL', 'LATEST']);
    expect(result).toMatchObject({
      batches: 3,
      generated: 50,
      inspected: 50,
      configured: true,
    });
  });

  it('forwards the tuning options into the batch loop', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    mocks.runEnrichmentBatches.mockResolvedValue(loopResult());

    await runNewsAiWorker(undefined, { maxBatches: 6, sinceDays: 30, concurrency: 6 });

    expect(mocks.runEnrichmentBatches).toHaveBeenCalledWith(
      { id: 'worker-client' },
      expect.objectContaining({ maxBatches: 6, sinceDays: 30, concurrency: 6 }),
    );
  });

  it('prefers SUPABASE_URL when both server URL variables exist', () => {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'openai-key';

    expect(getNewsAiWorkerConfig().supabaseUrl).toBe('https://server.supabase.co');
    expect(createNewsAiWorkerClient()).toEqual({ id: 'worker-client' });
  });
});
