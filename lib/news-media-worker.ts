import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  enrichGeneratedNewsMedia,
  type NewsMediaEnrichmentSummary,
} from './news-media-enrichment';

export interface NewsMediaWorkerResult extends NewsMediaEnrichmentSummary {
  configured: boolean;
  missing: string[];
}

export interface NewsMediaWorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

const EMPTY_SUMMARY: NewsMediaEnrichmentSummary = {
  inspected: 0,
  updated: 0,
  videoFound: 0,
  imageFallbacks: 0,
  skipped: 0,
  noMedia: 0,
  failed: 0,
};

export function getNewsMediaWorkerConfig(): NewsMediaWorkerConfig {
  return {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '',
  };
}

export function createNewsMediaWorkerClient(config = getNewsMediaWorkerConfig()): SupabaseClient {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Runs the generated-only related-media worker. YouTube is optional at this
 * boundary because Wikimedia can still provide the layout1 fallback image.
 */
export async function runNewsMediaWorker(requestedLimit?: number): Promise<NewsMediaWorkerResult> {
  const config = getNewsMediaWorkerConfig();
  const missing: string[] = [];

  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    return {
      ...EMPTY_SUMMARY,
      configured: false,
      missing,
    };
  }

  const summary = await enrichGeneratedNewsMedia(createNewsMediaWorkerClient(config), requestedLimit);
  return {
    ...summary,
    configured: true,
    missing: [],
  };
}
