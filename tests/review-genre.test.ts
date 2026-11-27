import { describe, expect, it } from 'vitest';
import { detectReviewGenre, reviewPlaceholder } from '@/lib/review-genre';

/**
 * The reviews page only publishes rows that carry an image, but a stored URL is not
 * a promise — four of forty cards came back as black rectangles because
 * `static.punknews.org` refuses hotlinks. The stand-in is chosen by genre so the
 * replacement still says what kind of record the card is about.
 */
describe('review genre detection', () => {
  it('reads the genre from the headline before anything else', () => {
    expect(detectReviewGenre({ title: "MOTÖRHEAD'S CLASSIC 'ORGASMATRON' GETS A MIGHTY 40TH ANNIVERSARY SONIC UPGRADE" })).toBe('metal');
    expect(detectReviewGenre({ title: 'GUINNESS CORK JAZZ 2026 REVIEW: JASON MORAN' })).toBe('jazz');
    expect(detectReviewGenre({ title: 'DADDY YANKEE’S LATIN GRAMMYS MEDLEY' })).toBe('latin');
    expect(detectReviewGenre({ title: 'POST-PUNK TRIO TVOD TAKE THE FARM OUT OF THE CITY' })).toBe('rock');
    expect(detectReviewGenre({ title: 'Talking hip-hop with the Bronx veteran' })).toBe('hiphop');
  });

  it('does not read heavy metal as rock, nor a rap chart story as pop', () => {
    expect(detectReviewGenre({ title: 'Review: a heavy metal band returns with riffs' })).toBe('metal');
    expect(detectReviewGenre({ title: 'Rapper takes the chart by surprise in a ballad' })).toBe('hiphop');
  });

  it('falls back to the channel when the headline says nothing', () => {
    expect(detectReviewGenre({ title: 'A night at the Bimhuis', region: 'jazz' })).toBe('jazz');
    expect(detectReviewGenre({ title: 'Una noche en Bogotá', region: 'latino' })).toBe('latin');
  });

  it('ends on a generic concert photograph when even the channel is silent', () => {
    expect(detectReviewGenre({ title: 'The record that refused to be finished', region: 'us' })).toBe('world');
  });

  it('gives each genre its own picture and its own credit', () => {
    const urls = new Set(
      (['metal', 'rock', 'pop', 'hiphop', 'jazz', 'latin', 'electronic', 'world'] as const)
        .map((genre) => reviewPlaceholder(genre).url),
    );

    expect(urls.size).toBe(8);
    expect(reviewPlaceholder('metal').alt).toContain('placeholder photo');
    expect(reviewPlaceholder('jazz').url).toContain('images.unsplash.com');
  });
});
