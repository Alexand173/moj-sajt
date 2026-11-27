/**
 * The scraper's own metadata, as it is stored on a row.
 *
 * `app/api/scrape-official` writes every OFFICIAL row with
 *
 *   excerpt: "SOURCE: GRAMILANO.COM"
 *   content: "Music update from gramilano.com"
 *
 * The relevance gate already ignores those lines when it scores a story
 * (`lib/news-relevance`), but the *display* never did: a card rendered the excerpt
 * verbatim, so a review card carried an italic `"SOURCE: GRAMILANO.COM"` between
 * its headline and its body, and the reviews grid showed nothing else.
 *
 * One rule, two readers: the gate and the components both ask this module, so a
 * stub can never be scored as text while being shown as copy.
 */
const SCRAPER_STUB_PATTERNS: RegExp[] = [
  /^["“']?SOURCE:\s*[\w.-]+\s*["”']?$/i,
  /^["“']?Music update from\s+[\w.\-]+\s*["”']?$/i,
];

export function isScraperStub(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  return SCRAPER_STUB_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * The excerpt a reader should see, or `null` when there is nothing but metadata.
 *
 * Line by line rather than all-or-nothing: an excerpt can hold a real sentence and
 * a stub, and dropping the whole thing would lose the sentence.
 */
export function cleanNewsExcerpt(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const kept = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isScraperStub(line));

  const text = kept
    .join(' ')
    .replace(/\s+/g, ' ')
    // The card supplies its own quotation marks, so a stored pair must not double.
    .replace(/^["“']+|["”']+$/g, '')
    .trim();

  return text || null;
}
