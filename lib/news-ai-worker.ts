import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  enrichPendingNews,
  type AiNewsEnrichmentSummary,
} from './news-ai-enrichment';

export interface NewsAiWorkerResult extends AiNewsEnrichmentSummary {
  configured: boolean;
  missing: string[];
}

export interface NewsAiWorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  openAiKey: string;
}

const EMPTY_SUMMARY: AiNewsEnrichmentSummary = {
  inspected: 0,
  generated: 0,
  fallback: 0,
  skipped: 0,
  failed: 0,
};

export function getNewsAiWorkerConfig(): NewsAiWorkerConfig {
  return {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '',
    openAiKey: process.env.OPENAI_API_KEY?.trim() || '',
  };
}

export function createNewsAiWorkerClient(config = getNewsAiWorkerConfig()): SupabaseClient {
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
 * Runs the background worker that turns pending LATEST news rows into
 * persisted OpenAI editorial reports. It is intentionally independent of
 * request-time article rendering so an OpenAI outage never breaks a page.
 */
export async function runNewsAiWorker(requestedLimit?: number): Promise<NewsAiWorkerResult> {
  const config = getNewsAiWorkerConfig();
  const missing: string[] = [];

  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.openAiKey) missing.push('OPENAI_API_KEY');

  if (missing.length > 0) {
    return {
      ...EMPTY_SUMMARY,
      configured: false,
      missing,
    };
  }

  const summary = await enrichPendingNews(createNewsAiWorkerClient(config), requestedLimit);
  return {
    ...summary,
    configured: true,
    missing: [],
  };
}
