import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_NEWS_DEADLINE_SAFETY_MS,
  enrichPendingNews,
  getAiNewsBatchSize,
  getAiNewsConcurrency,
  getAiNewsWindowDays,
  type AiNewsCategory,
} from './news-ai-enrichment';

/** How many 20-row batches one invocation will attempt. */
export const DEFAULT_AI_BATCHES_PER_RUN = 10;
export const MAX_AI_BATCHES_PER_RUN = 25;
/**
 * Wall-clock budget for a whole invocation.
 *
 * Vercel allows 300s per invocation on both Hobby and Pro with fluid compute, so
 * 270s is a real ceiling rather than an estimate; the remaining 30s is headroom
 * for the response to leave before the platform kills the function.
 */
export const DEFAULT_AI_RUN_BUDGET_MS = 270_000;
export const MAX_AI_RUN_BUDGET_MS = 290_000;
const MIN_AI_RUN_BUDGET_MS = 15_000;

export type EnrichmentStopReason =
  | 'queue-empty'
  | 'batch-budget'
  | 'time-budget'
  | 'quota-exhausted'
  | 'no-progress';

export interface NewsAiBatchLoopResult {
  inspected: number;
  generated: number;
  fallback: number;
  skipped: number;
  failed: number;
  /** Rows that were selected but never started, because a budget ran out. */
  deferred: number;
  /** How many batches actually ran. */
  batches: number;
  /** Why the loop ended — the only way to tell "done" from "ran out of time". */
  stopReason: EnrichmentStopReason;
  durationMs: number;
}

export interface EnrichmentLoopOptions {
  categories?: AiNewsCategory[];
  /** Rows per batch. Defaults to 20. */
  batchSize?: number;
  /** Batches attempted per invocation. Defaults to 10. */
  maxBatches?: number;
  /**
   * Wall-clock budget for all batches. Defaults to 270s. Pass `Infinity` from a
   * local script, where no platform is going to kill the process.
   */
  timeBudgetMs?: number;
  sinceDays?: number;
  concurrency?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getAiNewsBatchesPerRun(): number {
  const configured = Number.parseInt(process.env.AI_NEWS_MAX_BATCHES || '', 10);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_AI_BATCHES_PER_RUN;

  return clamp(configured, 1, MAX_AI_BATCHES_PER_RUN);
}

export function getAiNewsTimeBudgetMs(): number {
  const configured = Number.parseInt(process.env.AI_NEWS_RUN_BUDGET_MS || '', 10);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_AI_RUN_BUDGET_MS;

  return clamp(configured, MIN_AI_RUN_BUDGET_MS, MAX_AI_RUN_BUDGET_MS);
}

/**
 * Drains the queue instead of sipping it once per day.
 *
 * Each iteration asks for the oldest batch still outstanding and processes it,
 * then asks again. The loop ends when the queue is empty, when the batch count
 * is reached, or when the wall-clock budget is spent — and it reports which of
 * those happened, so a truncated run is never mistaken for a finished one.
 *
 * The deadline is passed *into* the batch, because a single batch of 20 rewrites
 * can itself outlive the budget: without an intra-batch check the function would
 * be killed mid-write, which is how work gets lost silently.
 */
export async function runEnrichmentBatches(
  supabase: SupabaseClient,
  options: EnrichmentLoopOptions = {},
): Promise<NewsAiBatchLoopResult> {
  const batchSize = options.batchSize ?? getAiNewsBatchSize();
  const maxBatches = clamp(options.maxBatches ?? getAiNewsBatchesPerRun(), 1, MAX_AI_BATCHES_PER_RUN);
  const requestedBudget = options.timeBudgetMs ?? getAiNewsTimeBudgetMs();
  const budgetMs = Number.isFinite(requestedBudget)
    ? clamp(requestedBudget, 0, MAX_AI_RUN_BUDGET_MS)
    : Number.POSITIVE_INFINITY;
  const sinceDays = options.sinceDays ?? getAiNewsWindowDays();
  const concurrency = options.concurrency ?? getAiNewsConcurrency();

  const startedAt = Date.now();
  const deadlineAt = startedAt + budgetMs;
  const enrichmentDeadline = Number.isFinite(deadlineAt) ? deadlineAt : undefined;
  const failedIds: Array<string | number> = [];

  const totals = {
    inspected: 0,
    generated: 0,
    fallback: 0,
    skipped: 0,
    failed: 0,
    deferred: 0,
  };

  let batches = 0;
  let stopReason: EnrichmentStopReason = 'batch-budget';

  while (batches < maxBatches) {
    // Checked before asking for a batch, so a run never starts work it cannot finish.
    if (Date.now() >= deadlineAt - AI_NEWS_DEADLINE_SAFETY_MS) {
      stopReason = 'time-budget';
      break;
    }

    const outcome = await enrichPendingNews(supabase, batchSize, {
      categories: options.categories,
      sinceDays,
      order: 'oldest',
      concurrency,
      deadlineAt: enrichmentDeadline,
      // Copied, not shared: the batch must see the failures known *before* it
      // started, not the ones its own siblings add while it is still running.
      excludeIds: [...failedIds],
    });

    batches += 1;
    totals.inspected += outcome.inspected;
    totals.generated += outcome.generated;
    totals.fallback += outcome.fallback;
    totals.skipped += outcome.skipped;
    totals.failed += outcome.failed;
    totals.deferred += outcome.deferred;
    failedIds.push(...outcome.failedIds);

    if (outcome.quotaExhausted) {
      stopReason = 'quota-exhausted';
      break;
    }
    if (outcome.truncated) {
      stopReason = 'time-budget';
      break;
    }
    if (outcome.inspected === 0) {
      stopReason = 'queue-empty';
      break;
    }
    // Every row in the batch failed to persist or to generate a usable rewrite.
    // Asking again would return the same rows, so stop rather than spin.
    if (outcome.generated + outcome.fallback === 0) {
      stopReason = 'no-progress';
      break;
    }
    // A short batch means the queue is exhausted, not that it is still full.
    if (outcome.inspected < batchSize) {
      stopReason = 'queue-empty';
      break;
    }
  }

  return {
    ...totals,
    batches,
    stopReason,
    durationMs: Date.now() - startedAt,
  };
}
