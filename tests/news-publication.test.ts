import { describe, expect, it } from 'vitest';
import { hasRecordedSource, isIndexedNewsArticle, splitIngestableArticles } from '@/lib/news-publication';

/**
 * The rule that took 985 published pages down.
 *
 * Those pages were not broken HTML and not junk — they were real music coverage
 * with a full AI rewrite whose publisher was never recorded, so the page could not
 * credit anyone, link to the report it described, or be checked. "No source" had to
 * become "not published", and it had to be derived from the row rather than stored,
 * so no future write can leave it out of sync.
 */

const rewrite = 'a '.repeat(250).trim();

describe('source presence', () => {
  it('accepts an absolute http(s) URL', () => {
    expect(hasRecordedSource({ url: 'https://www.billboard.com/music/story/' })).toBe(true);
    expect(hasRecordedSource({ url: 'http://example.com/a' })).toBe(true);
  });

  it('rejects everything that is not one, without throwing', () => {
    // The cohort's shape: the column exists and holds nothing.
    expect(hasRecordedSource({ url: null })).toBe(false);
    expect(hasRecordedSource({ url: '' })).toBe(false);
    expect(hasRecordedSource({ url: '   ' })).toBe(false);
    // A bare host is not a link a reader can follow.
    expect(hasRecordedSource({ url: 'billboard.com' })).toBe(false);
    expect(hasRecordedSource({ url: 'javascript:alert(1)' })).toBe(false);
    expect(hasRecordedSource(null)).toBe(false);
    expect(hasRecordedSource(undefined)).toBe(false);
  });
});

describe('ingest guard', () => {
  it('keeps rows with a source and isolates the ones without', () => {
    const batch = [
      { title: 'Doja Cat at the American Airlines Center', url: 'https://example.com/a' },
      { title: 'Untitled provider artefact', url: null },
      { title: 'Empty string URL', url: '' },
    ];

    const { storable, droppedWithoutSource } = splitIngestableArticles(batch);

    expect(storable.map((row) => row.title)).toEqual(['Doja Cat at the American Airlines Center']);
    expect(droppedWithoutSource.map((row) => row.title)).toEqual([
      'Untitled provider artefact',
      'Empty string URL',
    ]);
  });

  it('handles an empty or missing batch', () => {
    expect(splitIngestableArticles([]).storable).toEqual([]);
    expect(splitIngestableArticles(null).droppedWithoutSource).toEqual([]);
  });
});

describe('the sitemap rule', () => {
  it('requires both an attributed source and a validated rewrite', () => {
    const attributed = { url: 'https://www.nme.com/news/music/x', ai_content: rewrite, ai_generated: true, ai_status: 'generated' };
    expect(isIndexedNewsArticle(attributed)).toBe(true);

    // The 779 rows that were indexable with no publisher named.
    expect(isIndexedNewsArticle({ ...attributed, url: null })).toBe(false);
    // A link-out page is live but advertises nothing to search.
    expect(isIndexedNewsArticle({ ...attributed, ai_generated: false, ai_status: 'fallback' })).toBe(false);
    // A rewrite below the 200-word floor stays out, as before.
    expect(isIndexedNewsArticle({ ...attributed, ai_content: 'too short' })).toBe(false);
  });
});
