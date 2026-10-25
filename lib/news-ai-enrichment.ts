import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAiNewsArticle, getNewsSourceName, type AiNewsArticle } from './ai-news';

const DEFAULT_AI_NEWS_BATCH_SIZE = 20;
const MAX_AI_NEWS_BATCH_SIZE = 20;
const DEFAULT_AI_NEWS_WINDOW_DAYS = 5;
/** A fallback rewrite is retried, but not before this cooldown has passed. */
const FALLBACK_RETRY_HOURS = 6;

export type AiNewsCategory = 'LATEST' | 'OFFICIAL';

type AiNewsStatus = 'generated' | 'fallback';

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

export interface EnrichPendingNewsOptions {
  /** Categories that receive an independent rewrite. Defaults to LATEST. */
  categories?: AiNewsCategory[];
  /** Only rows created within this window are processed. Defaults to five days. */
  sinceDays?: number;
}

export function getAiNewsStatus(result: Pick<AiNewsArticle, 'isAiGenerated' | 'similarityCheckPassed'>): AiNewsStatus {
  return result.isAiGenerated && result.similarityCheckPassed ? 'generated' : 'fallback';
}

export function getAiNewsBatchSize(): number {
  const configuredSize = Number.parseInt(process.env.AI_NEWS_BATCH_SIZE || '', 10);

  if (!Number.isFinite(configuredSize)) return DEFAULT_AI_NEWS_BATCH_SIZE;

  return Math.min(Math.max(configuredSize, 1), MAX_AI_NEWS_BATCH_SIZE);
}

/**
 * Processes a small, budget-safe batch of news rows waiting for an AI rewrite.
 * Both NewsAPI (LATEST) and scraped publisher (OFFICIAL) rows go through the
 * same generation, similarity-score validation, and persistence path; callers
 * choose the categories they can afford in the current run.
 * Rows remain pending when the server has no OpenAI key, so they can be processed
 * automatically after the deployment is configured correctly.
 */
export async function enrichPendingNews(
  supabase: SupabaseClient,
  requestedLimit = getAiNewsBatchSize(),
  options: EnrichPendingNewsOptions = {},
): Promise<AiNewsEnrichmentSummary> {
  const categories = options.categories?.length ? options.categories : (['LATEST'] as AiNewsCategory[]);
  const sinceDays = options.sinceDays ?? DEFAULT_AI_NEWS_WINDOW_DAYS;
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
  const { data, error } = await supabase
    .from('news')
    .select('id, title, excerpt, content, url, category')
    .in('category', categories)
    .gte('created_at', windowStart)
    .or(statusFilter)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_AI_NEWS_BATCH_SIZE));

  if (error) throw new Error(`Could not load pending AI news rows: ${error.message}`);

  const pendingArticles = (data || []) as PendingNewsArticle[];
  const summary: AiNewsEnrichmentSummary = {
    inspected: pendingArticles.length,
    generated: 0,
    fallback: 0,
    skipped: 0,
    failed: 0,
  };

  if (!process.env.OPENAI_API_KEY?.trim()) {
    summary.skipped = pendingArticles.length;
    return summary;
  }

  for (const article of pendingArticles) {
    try {
      const sourceName = getNewsSourceName(article.url);
      const aiResult = await generateAiNewsArticle({
        title: article.title,
        excerpt: article.excerpt,
        existingContent: article.content,
        sourceUrl: article.url,
        sourceName,
      });
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
        console.warn(`Could not persist AI news fields for "${article.title}":`, updateError.message);
        continue;
      }

      if (aiStatus === 'generated') summary.generated += 1;
      else summary.fallback += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn(`AI enrichment failed for "${article.title}":`, error);
    }
  }

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
): Promise<AiNewsEnrichmentSummary> {
  return enrichPendingNews(supabase, requestedLimit, { categories: ['OFFICIAL'] });
}
