import { describe, expect, it } from 'vitest';
import { MIN_SCRAPED_TITLE_LENGTH, isUsableScrapedTitle } from '@/lib/scrape-limits';

/**
 * The floor that dropped real headlines. The old rule was `title.length > 25`,
 * applied inline in two files, and it rejected valid short music titles before
 * the relevance gate ever saw them.
 */
describe('isUsableScrapedTitle', () => {
  it('keeps the short music headlines the old 26-character floor dropped', () => {
    expect(isUsableScrapedTitle('Blackpink – Go')).toBe(true);
    expect(isUsableScrapedTitle('Korn – Freak')).toBe(true);
    expect(isUsableScrapedTitle('Måneskin')).toBe(true);
    expect('Blackpink – Go'.length).toBeLessThan(26);
  });

  it('keeps an ordinary headline', () => {
    expect(isUsableScrapedTitle('Carly Rae Jepsen will host the 2027 Junos')).toBe(true);
  });

  it('rejects listing-page furniture instead of measuring length', () => {
    expect(isUsableScrapedTitle('Read more')).toBe(false);
    expect(isUsableScrapedTitle('Load more stories')).toBe(false);
    expect(isUsableScrapedTitle('See all news')).toBe(false);
    expect(isUsableScrapedTitle('Subscribe to our newsletter')).toBe(false);
    expect(isUsableScrapedTitle('Sign up')).toBe(false);
    expect(isUsableScrapedTitle('Advertisement')).toBe(false);
  });

  it('rejects a bare domain, a date and a label', () => {
    expect(isUsableScrapedTitle('billboard.com')).toBe(false);
    expect(isUsableScrapedTitle('12/03/2026')).toBe(false);
    expect(isUsableScrapedTitle('Live')).toBe(false);
    expect(isUsableScrapedTitle('   ')).toBe(false);
    expect(isUsableScrapedTitle(null)).toBe(false);
  });

  it('measures the trimmed value, not the raw one', () => {
    expect(isUsableScrapedTitle('   Blackpink – Go   ')).toBe(true);
    expect(MIN_SCRAPED_TITLE_LENGTH).toBeLessThanOrEqual('Blackpink – Go'.length);
  });
});
