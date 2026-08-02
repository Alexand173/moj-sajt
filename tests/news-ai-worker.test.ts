import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ id: 'worker-client' })),
  enrichPendingNews: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/news-ai-enrichment', () => ({
  enrichPendingNews: mocks.enrichPendingNews,
}));

import {
  createNewsAiWorkerClient,
  getNewsAiWorkerConfig,
  runNewsAiWorker,
} from '@/lib/news-ai-worker';

describe('news AI worker', () => {
  beforeEach(() => {
    mocks.createClient.mockClear();
    mocks.enrichPendingNews.mockReset();
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
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.enrichPendingNews).not.toHaveBeenCalled();
  });

  it('uses the service-role client and processes pending rows when configured', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    mocks.enrichPendingNews.mockResolvedValue({
      inspected: 1,
      generated: 1,
      fallback: 0,
      skipped: 0,
      failed: 0,
    });

    const result = await runNewsAiWorker(3);

    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    expect(mocks.enrichPendingNews).toHaveBeenCalledWith({ id: 'worker-client' }, 3);
    expect(result).toMatchObject({
      configured: true,
      missing: [],
      inspected: 1,
      generated: 1,
    });
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
