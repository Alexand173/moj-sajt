import { hasValidatedAiContent, type NewsIndexabilityFields } from './news-indexability';

/**
 * What may be published, as opposed to what exists.
 *
 * A news row can hold a perfect editorial rewrite and still not be publishable:
 * if it has no source, nobody can check it, the page cannot link to the report it
 * describes, and there is no one to credit. That is not a hypothetical — 985 rows
 * carry `url: null`, and 985 pages were being served as if they had a source.
 *
 * The rule is derived, not stored. There is no `unpublished` flag to fall out of
 * sync and no migration to run: a row without a URL is not published, everywhere,
 * at once. `hasValidatedAiContent` keeps its own meaning — "the rewrite passed" —
 * because a link-out page for a publisher we cannot rewrite (a paywalled or
 * fetch-denied newsroom) is legitimately published without a rewrite.
 */

export interface NewsSourceFields {
  url?: string | null;
}

/**
 * Does this row name where the reporting came from?
 *
 * Only http(s) counts. An empty string, a bare hostname and a `javascript:` value
 * are all the same thing to a reader: no source.
 */
export function hasRecordedSource(article: NewsSourceFields | null | undefined): boolean {
  const value = article?.url?.trim();
  if (!value) return false;

  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * The sitemap rule: an attributed page with a validated rewrite.
 *
 * Stricter than "is published" on purpose. A fallback or link-out page is a real
 * page and stays live, but it has no independent reporting of our own to offer
 * Google, so the sitemap never advertises it — and this is the same rule the
 * article page uses to decide `noindex`.
 */
export function isIndexedNewsArticle(
  article: (NewsIndexabilityFields & NewsSourceFields) | null | undefined,
): boolean {
  return hasValidatedAiContent(article as NewsIndexabilityFields)
    && hasRecordedSource(article);
}
