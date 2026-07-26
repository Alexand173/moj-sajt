import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAiNewsArticle, getNewsSourceName, type AiNewsArticle } from './ai-news';

const DEFAULT_AI_NEWS_BATCH_SIZE = 5;
const MAX_AI_NEWS_BATCH_SIZE = 20;

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

export function getAiNewsStatus(result: Pick<AiNewsArticle, 'isAiGenerated' | 'similarityCheckPassed'>): AiNewsStatus {
  return result.isAiGenerated && result.similarityCheckPassed ? 'generated' : 'fallback';
}

export function getAiNewsBatchSize(): number {
  const configuredSize = Number.parseInt(process.env.AI_NEWS_BATCH_SIZE || '', 10);

  if (!Number.isFinite(configuredSize)) return DEFAULT_AI_NEWS_BATCH_SIZE;

  return Math.min(Math.max(configuredSize, 1), MAX_AI_NEWS_BATCH_SIZE);
}

/**
 * Processes a small, budget-safe batch of LATEST NewsAPI rows waiting for an AI rewrite.
 * OFFICIAL rows are source links only and are intentionally excluded from this pipeline.
 * Rows remain pending when the server has no OpenAI key, so they can be processed
 * automatically after the deployment is configured correctly.
 */
export async function enrichPendingNews(
  supabase: SupabaseClient,
  requestedLimit = getAiNewsBatchSize(),
): Promise<AiNewsEnrichmentSummary> {
  const { data, error } = await supabase
    .from('news')
    .select('id, title, excerpt, content, url, category')
    .eq('category', 'LATEST')
    .or('ai_status.is.null,ai_status.eq.pending')
    .order('created_at', { ascending: true })
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
