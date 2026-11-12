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

/**
 * The roster is built from the chart, the tour feed and the names that recur across
 * accepted headlines. The third source harvests capitalised runs, so a title-case
 * headline's verb phrase became a person: the held sample admitted
 * "Brittany Mahomes breaks silence…" and "PSG Winger Fires Back…" because
 * "breaks silence" and "fires back" were indexed as artists.
 */
describe('what counts as a name', () => {
  it('refuses event titles, verb fragments and anything with digits', () => {
    const polluted = buildArtistNameIndex([
      'breaks silence',
      'fires back',
      'jay z brings',
      'get last minute tickets',
      '2026 8TURN 2nd World Tour in Mexico',
      'Eagles - Suite Reservation',
      'ACOUSTIC ALCHEMY — WORLD TOUR',
      'a name that is far too long to be a person at all really',
      // An event and a film title, both of which recur often enough for the
      // headline harvest to treat them as people.
      'Super Bowl',
      'KPop Demon Hunters',
      'Take That',
      'Bring Me the Horizon',
    ]);

    expect(polluted.names.has('breaks silence')).toBe(false);
    expect(polluted.names.has('fires back')).toBe(false);
    expect(polluted.names.has('jay z brings')).toBe(false);
    expect(polluted.names.has('get last minute tickets')).toBe(false);
    expect(polluted.names.has('2026 8turn 2nd world tour in mexico')).toBe(false);
    expect(polluted.names.has('eagles suite reservation')).toBe(false);
    expect(polluted.names.has('acoustic alchemy world tour')).toBe(false);
    expect(polluted.names.has('super bowl')).toBe(false);
    expect(polluted.names.has('kpop demon hunters')).toBe(false);

    // Real names that happen to look like fragments survive.
    expect(polluted.names.has('take that')).toBe(true);
    expect(polluted.names.has('bring me the horizon')).toBe(true);
  });

  it('stops a headline fragment from being music evidence', () => {
    const fragments = buildArtistNameIndex(['breaks silence', 'fires back']);

    expect(titleMentionsKnownArtist(
      "Patrick Mahomes' wife Brittany Mahomes breaks silence on the dark moments she faces",
      fragments,
    )).toBe(false);
    expect(titleMentionsKnownArtist(
      'PSG Winger Fires Back at Journalist Over Entourage Criticism',
      fragments,
    )).toBe(false);
  });
});

/**
 * A one-word artist is a mononym, and a mononym has the shape of an athlete's first
 * name. "Shakira Austin" is a WNBA player; "Shakira" is the artist.
 */
describe('one-word names', () => {
  it('does not match inside somebody else’s full name', () => {
    expect(titleMentionsKnownArtist(
      "Mystics' Shakira Austin is healthy at last and powering Washington's playoff push",
      index,
    )).toBe(false);
    expect(titleMentionsKnownArtist(
      'Azzi Fudd wins WNBA All-Star 3-point contest; Shakira Austin, Elena Delle Donne',
      index,
    )).toBe(false);
  });

  it('still matches when the artist is the one acting', () => {
    // Title case capitalises the verb, so capitalisation alone cannot decide this.
    expect(titleMentionsKnownArtist('Shakira Announces New Album', index)).toBe(true);
    expect(titleMentionsKnownArtist('Shakira enflamme la plage de Copacabana', index)).toBe(true);
    expect(titleMentionsKnownArtist('Shakira Is Back With A New Single', index)).toBe(true);
  });
});
