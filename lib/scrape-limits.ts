/**
 * What counts as a headline worth scraping off a listing page.
 *
 * The scraper reads `h2` and `h3` elements, and on a real news index those
 * include the site's own furniture: "Read more", "Load more", "See all",
 * "Sign up". A length floor was the original guard, and it was set at 26
 * characters — which silently dropped real headlines, because a music headline
 * can be very short. "Blackpink – Go" is 14 characters, and the whole point of
 * trusting a music publication is that its short titles are still music news.
 *
 * The floor is now low enough to keep those, and the shape checks below are what
 * remove the furniture instead of a length cut-off.
 */

/**
 * Shortest title kept. Below this a string is a label, not a headline: "Live",
 * "Albums", "Trending". Eight characters still admits "Blackpink – Go" (14),
 * "Korn – Freak" (12) and "Måneskin" (8).
 */
export const MIN_SCRAPED_TITLE_LENGTH = 8;

/** Navigation and marketing chrome that appears as a heading on listing pages. */
const FURNITURE_PATTERNS: RegExp[] = [
  /^(read|see|view|show|load|discover)\s+(more|all|less|now)\b/i,
  /^(more|all)\s+(news|stories|articles|reviews)\b/i,
  /^(sign|log)\s*(in|up)\b/i,
  /^subscribe\b/i,
  /^(share|follow|listen|watch)\b\s*$/i,
  /^(home|menu|search|next|previous)\s*$/i,
  /^(advertisement|sponsored)\b/i,
  /^(cookie|privacy|terms)\b/i,
  /^https?:\/\//i,
];

/** A title that is only a domain, e.g. "billboard.com". */
const DOMAIN_ONLY = /^[\w-]+(\.[\w-]+)+$/;

/**
 * Is this heading a headline the site would publish?
 *
 * A pure predicate, so the scraper and the source probe reach the same verdict —
 * they used to carry the same length literal in two files, which is how a rule
 * drifts without anyone noticing.
 */
export function isUsableScrapedTitle(title: string | null | undefined): title is string {
  const value = title?.replace(/\s+/g, ' ').trim();
  if (!value || value.length < MIN_SCRAPED_TITLE_LENGTH) return false;

  // A headline has at least one letter; a date or a count does not.
  if (!/\p{L}/u.test(value)) return false;
  if (DOMAIN_ONLY.test(value)) return false;

  return !FURNITURE_PATTERNS.some((pattern) => pattern.test(value));
}
