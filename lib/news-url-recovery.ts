/**
 * Finding an article's original URL from its headline.
 *
 * A NewsAPI row can arrive without a `url`. When that happens the only way back
 * to the publisher is to ask NewsAPI for the headline again and accept a result
 * whose title is the same one. That lookup existed inline inside
 * `resolveNewsSource`, and the null-URL cleanup needed the identical rule, so it
 * lives here once.
 *
 * Matching is strict on purpose. A fuzzy match attaches the wrong publisher,
 * which is worse than no source at all: the article page would link to something
 * unrelated and the rewrite would cite the wrong newsroom. Different outlets do
 * republish the same headline, and that is fine — the first exact match is a
 * real article with that title.
 */

export interface NewsApiTitleArticle {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  source?: { name?: string | null } | null;
}

const NEWS_API_TIMEOUT_MS = 8_000;
/**
 * Ten, not five. The exact-title check rejects most of a page, so the page has
 * to be wide enough to still contain the real article when three unrelated
 * stories rank above it.
 */
const NEWS_API_PAGE_SIZE = 10;
/** NewsAPI rejects a `q` longer than 500 characters. Headlines never reach 200. */
const MAX_QUERY_TITLE_CHARACTERS = 200;

/**
 * Title identity, insensitive to typography and nothing else.
 *
 * Apostrophes, curly quotes, em dashes and punctuation are normalised because
 * the same headline is encoded differently by a feed and by a page: "Guns N'
 * Roses" and "Guns N’ Roses" are one story. Word order and every word itself
 * must still agree, so this cannot turn "Eminem announces tour" into "Eminem
 * cancels tour".
 */
export function normalizeArticleTitle(title: string | null | undefined): string {
  return (title || '')
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201B\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The first article whose title is the same headline, or null. */
export function findExactTitleMatch<T extends NewsApiTitleArticle>(
  articles: readonly T[] | null | undefined,
  title: string | null | undefined,
): T | null {
  const wanted = normalizeArticleTitle(title);
  if (!wanted) return null;

  for (const article of articles || []) {
    if (normalizeArticleTitle(article.title) === wanted) return article;
  }

  return null;
}

export type NewsApiLookupError =
  | 'missing-key'
  | 'unauthorized'
  | 'rate-limited'
  | 'api-error'
  | 'network';

export interface NewsApiTitleLookup {
  /** The article with this headline, when NewsAPI still holds it. */
  match: NewsApiTitleArticle | null;
  /** Everything the query returned, for a caller that wants to look itself. */
  candidates: NewsApiTitleArticle[];
  error?: NewsApiLookupError;
  message?: string;
}

/**
 * Asks NewsAPI for one headline and returns the article whose title matches.
 *
 * `searchIn=title` narrows the search to titles rather than title and body,
 * which is what an exact-title match wants: a body mention of the headline is
 * not the article. Never throws — a rate limit or a network failure is reported
 * in `error`, because a caller rewriting an article should still publish it
 * without a source rather than crash.
 */
export async function lookupArticleByTitle(input: {
  title: string;
  apiKey?: string | null;
  timeoutMs?: number;
}): Promise<NewsApiTitleLookup> {
  const apiKey = (input.apiKey ?? process.env.NEWS_API_KEY)?.trim();
  if (!apiKey) return { match: null, candidates: [], error: 'missing-key', message: 'NEWS_API_KEY is not set.' };

  const phrase = input.title.replace(/"/g, ' ').trim().slice(0, MAX_QUERY_TITLE_CHARACTERS);
  if (!phrase) return { match: null, candidates: [], error: 'api-error', message: 'Empty title.' };

  const endpoint = 'https://newsapi.org/v2/everything'
    + `?q=${encodeURIComponent(`"${phrase}"`)}`
    + '&searchIn=title&language=en'
    + `&pageSize=${NEWS_API_PAGE_SIZE}`
    + '&sortBy=relevancy';

  let response: Response;
  try {
    response = await fetch(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(input.timeoutMs ?? NEWS_API_TIMEOUT_MS),
      headers: { 'X-Api-Key': apiKey },
    });
  } catch (error) {
    return {
      match: null,
      candidates: [],
      error: 'network',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    return {
      match: null,
      candidates: [],
      error: response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rate-limited' : 'api-error',
      message: `HTTP ${response.status}`,
    };
  }

  const data = (await response.json().catch(() => null)) as
    | { articles?: NewsApiTitleArticle[]; status?: string; code?: string; message?: string }
    | null;

  if (!data || data.status === 'error') {
    const code = data?.code || '';
    return {
      match: null,
      candidates: [],
      error: code.includes('RateLimited') ? 'rate-limited'
        : code.includes('apiKey') ? 'unauthorized'
          : 'api-error',
      message: data?.message || 'NewsAPI returned no usable body.',
    };
  }

  const candidates = data.articles || [];
  return { match: findExactTitleMatch(candidates, input.title), candidates };
}
