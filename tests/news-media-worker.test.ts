import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ id: 'media-worker-client' })),
  enrichGeneratedNewsMedia: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/news-media-enrichment', () => ({
  enrichGeneratedNewsMedia: mocks.enrichGeneratedNewsMedia,
}));

import {
  createNewsMediaWorkerClient,
  getNewsMediaWorkerConfig,
  runNewsMediaWorker,
} from '@/lib/news-media-worker';

describe('news media worker', () => {
  beforeEach(() => {
    mocks.createClient.mockClear();
    mocks.enrichGeneratedNewsMedia.mockReset();
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('reports missing Supabase configuration without starting work', async () => {
    const result = await runNewsMediaWorker();

    expect(result).toMatchObject({
      configured: false,
      missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      inspected: 0,
      updated: 0,
      failed: 0,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.enrichGeneratedNewsMedia).not.toHaveBeenCalled();
  });

  it('uses the service-role client and runs generated-only enrichment', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    mocks.enrichGeneratedNewsMedia.mockResolvedValue({
      inspected: 1,
      updated: 1,
      videoFound: 1,
      imageFallbacks: 0,
      skipped: 0,
      noMedia: 0,
      failed: 0,
    });

    const result = await runNewsMediaWorker(4);

    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    expect(mocks.enrichGeneratedNewsMedia).toHaveBeenCalledWith({ id: 'media-worker-client' }, 4);
    expect(result).toMatchObject({ configured: true, missing: [], inspected: 1, updated: 1 });
  });

  it('prefers the server Supabase URL when both URL variables exist', () => {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    expect(getNewsMediaWorkerConfig().supabaseUrl).toBe('https://server.supabase.co');
    expect(createNewsMediaWorkerClient()).toEqual({ id: 'media-worker-client' });
  });
});
