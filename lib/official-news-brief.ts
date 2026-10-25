import { countWords, hasValidatedAiContent } from './news-indexability';

export interface OfficialNewsBriefRow {
  id: string | number;
  title?: string | null;
  excerpt?: string | null;
  url?: string | null;
  category?: string | null;
  created_at?: string | null;
  ai_content?: string | null;
  ai_generated?: boolean | null;
  ai_status?: string | null;
  ai_similarity_score?: number | null;
}

export interface OfficialNewsBrief {
  id: string;
  status: 'ready' | 'pending';
  title: string;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  /** Paragraph-separated editorial brief. Empty until the rewrite passes validation. */
  articleContent: string;
  similarityScore: number | null;
  wordCount: number;
}

export function getBriefSourceName(url: string | null | undefined): string {
  if (!url?.trim()) return 'Original publisher';

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Original publisher';
  }
}

/**
 * Turns a stored OFFICIAL row into the payload the inline reader renders.
 * The source text is only exposed when the same validation gate used for
 * LATEST articles passed, so a failed or pending rewrite never leaks publisher
 * prose into the page.
 */
export function createOfficialNewsBrief(row: OfficialNewsBriefRow): OfficialNewsBrief {
  const isReady = isAiNewsReady(row);
  const articleContent = isReady ? (row.ai_content || '').trim() : '';

  return {
    id: String(row.id),
    status: isReady ? 'ready' : 'pending',
    title: row.title?.trim() || 'Official music news',
    sourceName: getBriefSourceName(row.url),
    sourceUrl: row.url || null,
    publishedAt: row.created_at || null,
    articleContent,
    similarityScore: typeof row.ai_similarity_score === 'number' ? row.ai_similarity_score : null,
    wordCount: countWords(articleContent),
  };
}

function isAiNewsReady(row: OfficialNewsBriefRow): boolean {
  return hasValidatedAiContent({
    ai_content: row.ai_content ?? null,
    ai_generated: row.ai_generated ?? null,
    ai_status: row.ai_status ?? null,
  });
}
