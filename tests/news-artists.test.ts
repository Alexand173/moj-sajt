import { describe, expect, it } from 'vitest';
import { buildArtistNameIndex, normalizeArtistText, titleMentionsKnownArtist } from '@/lib/news-artists';
import { assessNewsRelevance } from '@/lib/news-relevance';

/**
 * Artist recognition is the gate's answer to its own blind spot: an artist's name
 * is music evidence that no keyword list can hold. It was added after a sample of
 * the "no music words at all" bucket showed real coverage inside it — Lindsey
 * Buckingham and Stevie Nicks, JAŸ-Z's stadium show, Sarah McLachlan on tour.
 */

const index = buildArtistNameIndex([
  'JAŸ-Z',
  'Lindsey Buckingham',
  'Stevie Nicks',
  'Ella Langley',
  'Shakira',
  'The National',
]);

describe('artist name matching', () => {
  it('normalises accents, punctuation and case', () => {
    expect(normalizeArtistText('JAŸ-Z')).toBe('jay z');
    expect(normalizeArtistText('Beyoncé')).toBe('beyonce');
  });

  it('finds a multi-word artist with punctuation in the headline', () => {
    expect(titleMentionsKnownArtist('JAŸ-Z Adds London Stadium Show To 30-Year Celebration Run', index)).toBe(true);
    expect(titleMentionsKnownArtist('Lindsey Buckingham shares surprising update about Stevie Nicks', index)).toBe(true);
  });

  it('does not match on substrings or unrelated copy', () => {
    // "Ella" alone is not "Ella Langley"; "Queensland" is not "Queen".
    expect(titleMentionsKnownArtist('Ella Fitzgerald had a remarkable range', index)).toBe(false);
    expect(titleMentionsKnownArtist('A council in Queensland approved new bins', index)).toBe(false);
    expect(titleMentionsKnownArtist('', index)).toBe(false);
  });

  it('ignores very short names that would match ordinary words', () => {
    // A one-word name has to be at least six characters, so "Salt" or "Air" — band
    // names that are also common nouns — never turn prose into a music story.
    const short = buildArtistNameIndex(['Salt', 'Air', 'Queen']);
    expect(short.names.size).toBe(0);
    expect(titleMentionsKnownArtist('Salt and pepper on the table', short)).toBe(false);
  });

  it('does nothing when the site has no artists loaded', () => {
    expect(titleMentionsKnownArtist('Anything at all', null)).toBe(false);
    expect(titleMentionsKnownArtist('Anything at all', buildArtistNameIndex([]))).toBe(false);
  });
});

describe('artist evidence in the gate', () => {
  it('keeps an artist story whose headline has no music vocabulary', () => {
    const withoutArtists = assessNewsRelevance({
      title: 'Lindsey Buckingham shares surprising update about relationship with Stevie Nicks',
    });
    const withArtists = assessNewsRelevance(
      { title: 'Lindsey Buckingham shares surprising update about relationship with Stevie Nicks' },
      'news-api',
      { knownArtists: index },
    );

    expect(withoutArtists.relevant).toBe(false);
    expect(withArtists.relevant).toBe(true);
    expect(withArtists.matchedMusic).toContain('known-artist');
  });

  it('does not let a hard block be rescued by a name', () => {
    // A quotes column that names a musician is still a quotes column.
    const verdict = assessNewsRelevance(
      { title: "Quote of the Day by Shakira: 'I just want to grow old with a man… – Timeless life lessons'" },
      'news-api',
      { knownArtists: index },
    );

    expect(verdict.hardBlock).toBe('quote-column');
    expect(verdict.relevant).toBe(false);
  });
});
