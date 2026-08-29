import type { SupabaseClient } from '@supabase/supabase-js';
import { hasValidatedAiContent } from './news-indexability';
import {
  getMediaIdentity,
  getSafeMediaUrl,
  getStoredNewsMediaUrl,
  getYouTubeVideoId,
  isLikelyEditorialImageUrl,
  persistResolvedNewsMedia,
  resolveRelatedNewsMedia,
  type PersistedNewsMedia,
} from './news-media';

const DEFAULT_NEWS_MEDIA_BATCH_SIZE = 20;
const MAX_NEWS_MEDIA_BATCH_SIZE = 20;
const NEWS_MEDIA_LOOKBACK_DAYS = 5;

interface GeneratedNewsArticle extends PersistedNewsMedia {
  id: string | number;
  title: string;
  excerpt: string | null;
  image: string | null;
  ai_content: string | null;
  ai_generated: boolean | null;
  ai_status: string | null;
  created_at: string | null;
}

export interface NewsMediaEnrichmentSummary {
  inspected: number;
  updated: number;
  videoFound: number;
  imageFallbacks: number;
  skipped: number;
  noMedia: number;
  failed: number;
}

export function getNewsMediaBatchSize(): number {
  const configuredSize = Number.parseInt(process.env.AI_NEWS_MEDIA_BATCH_SIZE || '', 10);

  if (!Number.isFinite(configuredSize)) return DEFAULT_NEWS_MEDIA_BATCH_SIZE;

  return Math.min(Math.max(configuredSize, 1), MAX_NEWS_MEDIA_BATCH_SIZE);
}

function splitArticleParagraphs(value: string | null | undefined): string[] {
  return (value || '').split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function normalizeStoredMedia(article: GeneratedNewsArticle): PersistedNewsMedia {
  const headlineUrl = getSafeMediaUrl(article.image);
  const headlineIdentity = headlineUrl ? getMediaIdentity(headlineUrl) : null;
  const layout1Candidate = getStoredNewsMediaUrl(article.layout1);
  const layout1 = layout1Candidate
    && (!headlineIdentity || getMediaIdentity(layout1Candidate) !== headlineIdentity)
    ? layout1Candidate
    : null;
  const layout2Candidate = getSafeMediaUrl(article.layout2);
  const layout2 = layout2Candidate
    && isLikelyEditorialImageUrl(layout2Candidate)
    && (!headlineIdentity || getMediaIdentity(layout2Candidate) !== headlineIdentity)
    && (!layout1 || getMediaIdentity(layout2Candidate) !== getMediaIdentity(layout1))
    ? layout2Candidate
    : null;

  return { layout1, layout2 };
}

function hasCompleteStoredMedia(article: GeneratedNewsArticle, needsSecondImage: boolean): boolean {
  const storedMedia = normalizeStoredMedia(article);
  return Boolean(storedMedia.layout1 && (!needsSecondImage || storedMedia.layout2));
}

function createEmptySummary(): NewsMediaEnrichmentSummary {
  return {
    inspected: 0,
    updated: 0,
    videoFound: 0,
    imageFallbacks: 0,
    skipped: 0,
    noMedia: 0,
    failed: 0,
  };
}

/**
 * Populates layout1/layout2 only for validated generated LATEST articles.
 * The five-day window matches the AI queue so each scheduled run remains
 * bounded while rows still inside the queue window can be retried later.
 */
export async function enrichGeneratedNewsMedia(
  supabase: SupabaseClient,
  requestedLimit = getNewsMediaBatchSize(),
): Promise<NewsMediaEnrichmentSummary> {
  const lookback = new Date(Date.now() - NEWS_MEDIA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('news')
    .select('id, title, excerpt, image, ai_content, ai_generated, ai_status, created_at, layout1, layout2')
    .eq('category', 'LATEST')
    .eq('ai_status', 'generated')
    .eq('ai_generated', true)
    .or('layout1.is.null,layout2.is.null')
    .gte('created_at', lookback)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_NEWS_MEDIA_BATCH_SIZE));

  if (error) throw new Error(`Could not load generated news media rows: ${error.message}`);

  const articles = (data || []) as GeneratedNewsArticle[];
  const summary = createEmptySummary();
  summary.inspected = articles.length;

  for (const article of articles) {
    const paragraphs = splitArticleParagraphs(article.ai_content);
    const needsSecondImage = paragraphs.length >= 6;

    if (!hasValidatedAiContent(article) || paragraphs.length < 3 || hasCompleteStoredMedia(article, needsSecondImage)) {
      summary.skipped += 1;
      continue;
    }

    const existingMedia = normalizeStoredMedia(article);
    const rawMedia: PersistedNewsMedia = {
      layout1: article.layout1?.trim() || null,
      layout2: article.layout2?.trim() || null,
    };

    try {
      const resolution = await resolveRelatedNewsMedia({
        title: article.title,
        excerpt: article.excerpt,
        excludedUrls: [article.image, existingMedia.layout1, existingMedia.layout2],
        needsSecondImage,
      });
      const nextMedia = persistResolvedNewsMedia(resolution, existingMedia, needsSecondImage);
      const changedFields = Object.fromEntries(
        (['layout1', 'layout2'] as const)
          .filter((field) => nextMedia[field] !== existingMedia[field] || rawMedia[field] !== existingMedia[field])
          .map((field) => [field, nextMedia[field]]),
      );

      if (Object.keys(changedFields).length === 0) {
        summary.noMedia += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('news')
        .update(changedFields)
        .eq('id', article.id);

      if (updateError) {
        summary.failed += 1;
        console.warn(`Could not persist related media for "${article.title}":`, updateError.message);
        continue;
      }

      summary.updated += 1;
      if (resolution.video && getYouTubeVideoId(nextMedia.layout1)) summary.videoFound += 1;
      if (!resolution.video && getSafeMediaUrl(nextMedia.layout1)) summary.imageFallbacks += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn(`Related media enrichment failed for "${article.title}":`, error);
    }
  }

  return summary;
}
