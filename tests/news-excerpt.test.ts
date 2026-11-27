import { describe, expect, it } from 'vitest';
import { cleanNewsExcerpt, isScraperStub } from '@/lib/news-excerpt';

/**
 * The scraper stores its own metadata as the excerpt of every OFFICIAL row. The
 * relevance gate already ignored it, but the cards rendered it: a review card
 * carried an italic `"SOURCE: GRAMILANO.COM"` between its headline and its body,
 * which is what the 27 Nov screenshot showed on every tile.
 */
describe('scraper metadata is never shown as copy', () => {
  it('recognises the two stubs the scraper writes', () => {
    expect(isScraperStub('SOURCE: GRAMILANO.COM')).toBe(true);
    expect(isScraperStub('Music update from gramilano.com')).toBe(true);
    expect(isScraperStub('"SOURCE: THEJAZZMANN.COM"')).toBe(true);
    expect(isScraperStub('A review of the new record')).toBe(false);
    expect(isScraperStub(null)).toBe(false);
  });

  it('leaves nothing to render when the excerpt is only metadata', () => {
    expect(cleanNewsExcerpt('SOURCE: GRAMILANO.COM')).toBeNull();
    expect(cleanNewsExcerpt('Music update from ludwig-van.com')).toBeNull();
    expect(cleanNewsExcerpt('   ')).toBeNull();
  });

  it('keeps a real sentence that sits next to a stub line', () => {
    expect(cleanNewsExcerpt('SOURCE: PITCHFORK.COM\nA record that earns its runtime.'))
      .toBe('A record that earns its runtime.');

    expect(cleanNewsExcerpt('A record that earns its runtime.\nSOURCE: PITCHFORK.COM'))
      .toBe('A record that earns its runtime.');
  });

  it('does not double the quotation marks the card adds itself', () => {
    expect(cleanNewsExcerpt('"The best metal record of the year."'))
      .toBe('The best metal record of the year.');
  });
});
