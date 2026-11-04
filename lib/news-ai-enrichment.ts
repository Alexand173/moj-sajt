import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAiNewsArticle, getNewsSourceName, type AiNewsArticle } from './ai-news';

const DEFAULT_AI_NEWS_BATCH_SIZE = 20;
/** Kept at 20 so a single round trip stays small; throughput comes from batching, not batch size. */
export const MAX_AI_NEWS_BATCH_SIZE = 20;
/**
 * How far back the worker is allowed to look.
 *
 * This used to be five days, and it was the tightest constraint in the whole
 * pipeline: anything the worker could not reach in time simply fell out of the
 * query and was never rewritten at all. Twenty-one days gives a backlog room to
 * drain instead of quietly expiring.
 */
export const DEFAULT_AI_NEWS_WINDOW_DAYS = 21;
export const MAX_AI_NEWS_WINDOW_DAYS = 90;
const MIN_AI_NEWS_WINDOW_DAYS = 1;
/** Articles rewritten in parallel inside one batch. */
export const DEFAULT_AI_NEWS_CONCURRENCY = 4;
export const MAX_AI_NEWS_CONCURRENCY = 8;
/** A fallback rewrite is retried, but not before this cooldown has passed. */
const FALLBACK_RETRY_HOURS = 6;
/**
 * Margin kept free at the end of a deadline so a request already in flight can
 * finish and persist instead of being killed mid-write by the platform.
 */
export const AI_NEWS_DEADLINE_SAFETY_MS = 2_000;

export type AiNewsCategory = 'LATEST' | 'OFFICIAL';

type AiNewsStatus = 'generated' | 'fallback';

/** `oldest` drains the backlog; `newest` is only useful for manual spot checks. */
export type AiNewsOrder = 'oldest' | 'newest';

interface PendingNewsArticle {
  id: string | number;
  title: string;
  excerpt: string | null;
  content: string | null;
  url: string | null;
  category: string | null;
}

export interface AiNewsEnrichmentSummary {
  inspected: number;
  generated: number;
  fallback: number;
  skipped: number;
  failed: number;
}

/** What a single batch reports back, including how and why it ended. */
export interface AiNewsBatchOutcome extends AiNewsEnrichmentSummary {
  /** Rows selected for the batch but never started because the deadline arrived. */
  deferred: number;
  /** True when the deadline cut the batch short rather than the queue emptying. */
  truncated: boolean;
  /** Rows whose write failed, so the caller can keep them out of the next query. */
  failedIds: Array<string | number>;
  /** Set when the provider refused the request for quota or rate-limit reasons. */
  quotaExhausted: boolean;
}

export interface EnrichPendingNewsOptions {
  /** Categories that receive an independent rewrite. Defaults to LATEST. */
  categories?: AiNewsCategory[];
  /** Only rows created within this window are processed. Defaults to 21 days. */
  sinceDays?: number;
  /** Defaults to `oldest` so the longest-waiting row is always served first. */
  order?: AiNewsOrder;
  /** Ids to keep out of the selection, so one failing row cannot stall a run. */
  excludeIds?: Array<string | number>;
  /** Wall-clock instant after which no further article is started. */
  deadlineAt?: number;
  /** Articles rewritten in parallel. Defaults to 4. */
  concurrency?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readPositiveIntegerEnv(name: string): number | null {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getAiNewsStatus(result: Pick<AiNewsArticle, 'isAiGenerated' | 'similarityCheckPassed'>): AiNewsStatus {
  return result.isAiGenerated && result.similarityCheckPassed ? 'generated' : 'fallback';
}

export function getAiNewsBatchSize(): number {
  const configuredSize = readPositiveIntegerEnv('AI_NEWS_BATCH_SIZE');
  if (configuredSize === null) return DEFAULT_AI_NEWS_BATCH_SIZE;

  return clamp(configuredSize, 1, MAX_AI_NEWS_BATCH_SIZE);
}

export function getAiNewsWindowDays(): number {
  const configuredDays = readPositiveIntegerEnv('AI_NEWS_WINDOW_DAYS');
  if (configuredDays === null) return DEFAULT_AI_NEWS_WINDOW_DAYS;

  return clamp(configuredDays, MIN_AI_NEWS_WINDOW_DAYS, MAX_AI_NEWS_WINDOW_DAYS);
}

export function getAiNewsConcurrency(): number {
  const configuredConcurrency = readPositiveIntegerEnv('AI_NEWS_CONCURRENCY');
  if (configuredConcurrency === null) return DEFAULT_AI_NEWS_CONCURRENCY;

  return clamp(configuredConcurrency, 1, MAX_AI_NEWS_CONCURRENCY);
}

/**
 * PostgREST takes ids unquoted inside `in.(…)`, so anything that is not a plain
 * token is dropped rather than risking a malformed filter that fails the query.
 */
function toFilterIdList(ids: Array<string | number>): string {
  return ids
    .map((id) => String(id).trim())
    .filter((id) => /^[A-Za-z0-9_-]+$/.test(id))
    .join(',');
}

/**
 * Processes a small, budget-safe batch of news rows waiting for an AI rewrite.
 * Both NewsAPI (LATEST) and scraped publisher (OFFICIAL) rows go through the
 * same generation, similarity-score validation, and persistence path; callers
 * choose the categories they can afford in the current run.
 *
 * Rows are selected oldest-first by default. Newest-first kept re-serving the
 * freshest rows, so the tail of the backlog never advanced and eventually aged
 * out of the window — which is exactly how a queue stalls while capacity sits
 * idle.
 *
 * Rows remain pending when the server has no OpenAI key, so they can be processed
 * automatically after the deployment is configured correctly.
 */
export async function enrichPendingNews(
  supabase: SupabaseClient,
  requestedLimit = getAiNewsBatchSize(),
  options: EnrichPendingNewsOptions = {},
): Promise<AiNewsBatchOutcome> {
  const categories = options.categories?.length ? options.categories : (['LATEST'] as AiNewsCategory[]);
  const sinceDays = clamp(options.sinceDays ?? getAiNewsWindowDays(), MIN_AI_NEWS_WINDOW_DAYS, MAX_AI_NEWS_WINDOW_DAYS);
  const order: AiNewsOrder = options.order ?? 'oldest';
  const ascending = order === 'oldest';
  const concurrency = clamp(options.concurrency ?? getAiNewsConcurrency(), 1, MAX_AI_NEWS_CONCURRENCY);
  const batchLimit = clamp(Math.floor(requestedLimit) || 1, 1, MAX_AI_NEWS_BATCH_SIZE);
  const windowStart = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const fallbackRetryBefore = new Date(Date.now() - FALLBACK_RETRY_HOURS * 60 * 60 * 1000).toISOString();
  // `fallback` rows are rewrites that failed the similarity gate. They are
  // retried so one bad generation cannot leave a story permanently without a
  // brief, but only after a cooldown so a hard row cannot crowd fresh rows out
  // of every batch.
  const statusFilter = [
    'ai_status.is.null',
    'ai_status.eq.pending',
    `and(ai_status.eq.fallback,ai_generated_at.lt.${fallbackRetryBefore})`,
    'and(ai_status.eq.fallback,ai_generated_at.is.null)',
  ].join(',');
  const excludedIds = toFilterIdList(options.excludeIds ?? []);

  const baseQuery = supabase
    .from('news')
    .select('id, title, excerpt, content, url, category')
    .in('category', categories)
    .gte('created_at', windowStart)
    .or(statusFilter);
  // A row whose write failed stays pending, so without this it would be handed
  // back at the head of the next batch and burn the rest of the run.
  const filteredQuery = excludedIds ? baseQuery.not('id', 'in', `(${excludedIds})`) : baseQuery;

  const { data, error } = await filteredQuery
    // `created_at` is not unique across bulk inserts, so `id` breaks ties and
    // keeps the order — and therefore the paging — repeatable.
    .order('created_at', { ascending })
    .order('id', { ascending })
    .limit(batchLimit);

  if (error) throw new Error(`Could not load pending AI news rows: ${error.message}`);

  const pendingArticles = (data || []) as PendingNewsArticle[];
  const summary: AiNewsBatchOutcome = {
    inspected: pendingArticles.length,
    generated: 0,
    fallback: 0,
    skipped: 0,
    failed: 0,
    deferred: 0,
    truncated: false,
    failedIds: [],
    quotaExhausted: false,
  };

  if (!process.env.OPENAI_API_KEY?.trim()) {
    summary.skipped = pendingArticles.length;
    return summary;
  }

  let cursor = 0;
  const deadlineAt = options.deadlineAt;

  const nextArticle = (): PendingNewsArticle | null => {
    if (summary.quotaExhausted) return null;
    if (deadlineAt && Date.now() >= deadlineAt - AI_NEWS_DEADLINE_SAFETY_MS) {
      summary.truncated = cursor < pendingArticles.length;
      return null;
    }

    return cursor < pendingArticles.length ? pendingArticles[cursor++] : null;
  };

  const rewriteArticle = async (article: PendingNewsArticle): Promise<void> => {
    try {
      const sourceName = getNewsSourceName(article.url);
      const aiResult = await generateAiNewsArticle({
        title: article.title,
        excerpt: article.excerpt,
        existingContent: article.content,
        sourceUrl: article.url,
        sourceName,
      });

      // A quota refusal is transient, so the row is left untouched instead of
      // being stamped `fallback` and locked out for the retry cooldown. The run
      // stops because every further request would fail the same way.
      if (aiResult.failureReason === 'quota') {
        summary.quotaExhausted = true;
        return;
      }

      const aiStatus = getAiNewsStatus(aiResult);

      const { error: updateError } = await supabase
        .from('news')
        .update({
          ai_content: aiResult.articleContent,
          ai_similarity_score: aiResult.similarityScore,
          ai_generated: aiResult.isAiGenerated,
          ai_status: aiStatus,
          // Records the last attempt so fallback rows respect the retry cooldown.
          ai_generated_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      if (updateError) {
        summary.failed += 1;
        summary.failedIds.push(article.id);
        console.warn(`Could not persist AI news fields for "${article.title}":`, updateError.message);
        return;
      }

      if (aiStatus === 'generated') summary.generated += 1;
      else summary.fallback += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failedIds.push(article.id);
      console.warn(`AI enrichment failed for "${article.title}":`, error);
    }
  };

  // A fixed pool of workers drains the batch in parallel. The generation is I/O
  // bound — a source fetch plus one model call — so concurrency is what turns a
  // wall-clock budget into articles; even at 8 the request rate stays far below
  // the provider's per-minute ceiling. Every failure is caught per article, so a
  // single bad rewrite cannot take the batch down with it.
  const workerCount = Math.min(concurrency, pendingArticles.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (let article = nextArticle(); article; article = nextArticle()) {
        await rewriteArticle(article);
      }
    }),
  );

  summary.deferred = Math.max(
    0,
    pendingArticles.length - summary.generated - summary.fallback - summary.failed,
  );

  return summary;
}

/**
 * Dedicated entry point for the scraped publisher rows. They use the same
 * generation and similarity gates as LATEST, but are processed as their own
 * batch so a large LATEST backlog cannot starve them.
 */
export async function enrichPendingOfficialNews(
  supabase: SupabaseClient,
  requestedLimit = getAiNewsBatchSize(),
  options: Omit<EnrichPendingNewsOptions, 'categories'> = {},
): Promise<AiNewsBatchOutcome> {
  return enrichPendingNews(supabase, requestedLimit, { ...options, categories: ['OFFICIAL'] });
}
