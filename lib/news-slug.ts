/**
 * News article URLs carry the numeric id first and the headline slug after it:
 * `/news/uk/22901-kanye-west-postpones-marseille-concert`.
 *
 * The id keeps lookups cheap and stays unique even when two articles share a
 * headline; the slug adds the words people search for. Keeping the id first also
 * means a title edit produces a *derivable* canonical slug, so the old address can
 * redirect instead of 404. This module is dependency-free so client components can
 * build the same URLs the server renders.
 */

const MAX_SLUG_LENGTH = 80;
/** Below this the truncated slug would be too short to be worth keeping. */
const MIN_TRUNCATED_LENGTH = 24;

export function slugifyNewsTitle(title: string | null | undefined): string {
  const normalized = (title || '')
    .normalize('NFKD')
    // Strip diacritics so "Beyoncé" becomes "beyonce" rather than "%C3%A9".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    // Possessives collapse cleanly: "West's" → "wests".
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) return '';
  if (normalized.length <= MAX_SLUG_LENGTH) return normalized;

  const cut = normalized.slice(0, MAX_SLUG_LENGTH);
  const lastDash = cut.lastIndexOf('-');

  return (lastDash >= MIN_TRUNCATED_LENGTH ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

/**
 * The path segment for an article: `22901-kanye-west-postpones-marseille-concert`.
 * Falls back to the bare id when a headline has no Latin characters to slugify —
 * better a plain id than an empty or percent-encoded path.
 */
export function getNewsArticleSegment(id: string | number, title: string | null | undefined): string {
  const slug = slugifyNewsTitle(title);
  return slug ? `${id}-${slug}` : String(id);
}

export function buildNewsArticlePath(
  region: string,
  id: string | number,
  title: string | null | undefined,
): string {
  return `/news/${encodeURIComponent(region.toLowerCase())}/${getNewsArticleSegment(id, title)}`;
}

/**
 * Splits a route segment back into the numeric id and any slug that followed it.
 * Accepts the legacy id-only form (`22901`) so old links still resolve.
 */
export function parseNewsArticleSegment(segment: string): { id: string; slug: string } {
  const match = /^(\d+)(?:-(.*))?$/.exec(segment);
  if (!match) return { id: segment, slug: '' };

  return { id: match[1], slug: match[2] || '' };
}
