import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  runEnrichmentBatches,
  type NewsAiBatchLoopResult,
} from './news-ai-batch-loop';

export interface NewsAiWorkerResult extends NewsAiBatchLoopResult {
  configured: boolean;
  missing: string[];
}

export interface NewsAiWorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  openAiKey: string;
}

export interface NewsAiWorkerOptions {
  /** Also rewrite scraped OFFICIAL publisher rows, in their own sequence of batches. */
  includeOfficial?: boolean;
  /** Process only the scraped OFFICIAL publisher rows. */
  officialOnly?: boolean;
  /** Batches attempted per invocation. Defaults to 10. */
  maxBatches?: number;
  /** Wall-clock budget for the run. Defaults to 270s. */
  timeBudgetMs?: number;
  /** Lookback window in days. Defaults to 21. */
  sinceDays?: number;
  /** Articles rewritten in parallel per batch. Defaults to 4. */
  concurrency?: number;
  /** Repair only rows whose earlier rewrite fell back, ignoring the window. */
  fallbackOnly?: boolean;
}

const EMPTY_RESULT: NewsAiBatchLoopResult = {
  inspected: 0,
  generated: 0,
  fallback: 0,
  skipped: 0,
  failed: 0,
  deferred: 0,
  batches: 0,
  stopReason: 'queue-empty',
  durationMs: 0,
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

function sumResults(first: NewsAiBatchLoopResult, second: NewsAiBatchLoopResult): NewsAiBatchLoopResult {
  const firstWasCutShort = first.stopReason === 'time-budget' ||
    first.stopReason === 'quota-exhausted' ||
    first.stopReason === 'no-progress';

  return {
    inspected: first.inspected + second.inspected,
    generated: first.generated + second.generated,
    fallback: first.fallback + second.fallback,
    skipped: first.skipped + second.skipped,
    failed: first.failed + second.failed,
    deferred: first.deferred + second.deferred,
    batches: first.batches + second.batches,
    // If the LATEST pass was cut short, that is the reason worth reporting: the
    // queue is still longer than one invocation can serve.
    stopReason: firstWasCutShort ? first.stopReason : second.stopReason,
    durationMs: first.durationMs + second.durationMs,
  };
}

/**
 * Runs the background worker that turns pending news rows into persisted
 * OpenAI editorial reports. It is intentionally independent of request-time
 * article rendering so an OpenAI outage never breaks a page.
 *
 * One invocation now runs a sequence of batches rather than a single one, which
 * is what lets the twice-daily cron actually drain a backlog instead of
 * chipping at it.
 */
export async function runNewsAiWorker(
  requestedLimit?: number,
  options: NewsAiWorkerOptions = {},
): Promise<NewsAiWorkerResult> {
  const config = getNewsAiWorkerConfig();
  const missing: string[] = [];

  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.openAiKey) missing.push('OPENAI_API_KEY');

  if (missing.length > 0) {
    return {
      ...EMPTY_RESULT,
      configured: false,
      missing,
    };
  }

  const client = createNewsAiWorkerClient(config);
  const tuning = {
    maxBatches: options.maxBatches,
    timeBudgetMs: options.timeBudgetMs,
    sinceDays: options.sinceDays,
    concurrency: options.concurrency,
    fallbackOnly: options.fallbackOnly,
  };

  if (options.officialOnly) {
    return {
      ...(await runEnrichmentBatches(client, { ...tuning, categories: ['OFFICIAL'], batchSize: requestedLimit })),
      configured: true,
      missing: [],
    };
  }

  if (!options.includeOfficial) {
    return {
      ...(await runEnrichmentBatches(client, { ...tuning, categories: ['LATEST'], batchSize: requestedLimit })),
      configured: true,
      missing: [],
    };
  }

  // OFFICIAL goes first. Those rows are the scraped publisher items, they are
  // what the official brief reader depends on, and they arrive with a stub
  // `content` field ("Music update from pizzicato.lu"), so they are worthless
  // until rewritten. Running LATEST first meant a run that died mid-flight left
  // the official queue untouched for another whole cycle.
  const officialResult = await runEnrichmentBatches(client, {
    ...tuning,
    categories: ['OFFICIAL'],
    batchSize: requestedLimit,
  });
  const latestResult = await runEnrichmentBatches(client, {
    ...tuning,
    categories: ['LATEST'],
    batchSize: requestedLimit,
  });

  return {
    ...sumResults(officialResult, latestResult),
    configured: true,
    missing: [],
  };
}
