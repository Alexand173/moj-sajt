import { describe, expect, it } from 'vitest';
import { assessNewsRelevance, isMusicNews } from '@/lib/news-relevance';

/**
 * These headlines are the ones that actually reached the feed and were published
 * as music news — either because the old filter accepted a single keyword or
 * because it was bypassed for the region. Both sides are pinned: the off-topic
 * items must be refused, and real music stories must not be collateral damage.
 */

const offTopicHeadlines = [
  'qobuz-dl-ultra 2.4.3.1',
  "Capcom's Onimusha: Way of the Sword gets a release date",
  'The Best Netflix Movies of 2026 (So Far)',
  'Quote of the Day by Jim Carrey: "It is better to risk starving to death than..."',
  'Senate passes the budget after a late-night vote',
];

const musicHeadlines = [
  'Madonna, 68, Beats Taylor Swift With 11 MTV Video Music Awards Nominations',
  'Opera for the Dead and ocean-inspired works shine at Art Music Awards',
  'Da Baddest Takes A Bow?! Trina Announces Plans For Her Final Album',
  'Oscar and Grammy Winning KPop Demon Hunters Team Heads to TAIPEI MUSIC EXPO 2026',
  'Karol G anuncia nueva gira por estadios: conciertos en Madrid y Barcelona',
  'Nine Inch Nails add three UK dates to the Peel It Back tour',
];

describe('news relevance gate', () => {
  it('refuses non-music stories that reached the feed before', () => {
    for (const headline of offTopicHeadlines) {
      const verdict = assessNewsRelevance({ title: headline });
      expect(verdict.relevant, `${headline} should be refused`).toBe(false);
    }
  });

  it('keeps real music stories', () => {
    for (const headline of musicHeadlines) {
      const verdict = assessNewsRelevance({ title: headline });
      expect(verdict.relevant, `${headline} should be kept`).toBe(true);
    }
  });

  it('blocks a software changelog without needing to outscore it', () => {
    const verdict = assessNewsRelevance({ title: 'qobuz-dl-ultra 2.4.3.1' });

    expect(verdict.hardBlock).toBe('software-release');
    expect(verdict.relevant).toBe(false);
  });

  it('refuses the sports and games items that reached the reviews page', () => {
    // Both were published as music reviews before the gate reached that path.
    const verdicts = [
      assessNewsRelevance({ title: 'GAME REVIEW #8: Wolves vs. Bucks game thread' }),
      assessNewsRelevance({ title: 'Call of Duty: Modern Warfare 4 review - a price worth paying' }),
    ];

    for (const verdict of verdicts) {
      expect(verdict.hardBlock).toBe('video-game');
      expect(verdict.relevant).toBe(false);
    }
  });

  it('blocks a video game when it is mentioned', () => {
    const verdict = assessNewsRelevance({
      title: 'Capcom reveals the soundtrack for its next game',
      excerpt: 'The album of music from the game arrives with the PlayStation release.',
    });

    expect(verdict.hardBlock).toBe('video-game');
    expect(verdict.relevant).toBe(false);
  });

  it('does not decide on a single soft word', () => {
    const verdict = assessNewsRelevance({ title: 'What to Watch: the week in film and television' });

    expect(verdict.musicScore).toBeLessThan(2);
    expect(verdict.relevant).toBe(false);
  });

  it('outweighs an incidental film mention inside a music story', () => {
    const verdict = assessNewsRelevance({
      title: 'Beyoncé announces a live album and a concert film',
      excerpt: 'The album follows the tour and arrives with a documentary on the same stage show.',
    });

    expect(verdict.relevant).toBe(true);
  });

  it('refuses empty input rather than guessing', () => {
    expect(assessNewsRelevance({}).hardBlock).toBe('empty');
    expect(isMusicNews({ title: '   ' })).toBe(false);
  });
});

/**
 * Three real headlines the gate rejected while they were being published as
 * music news. Each scored a single point from one soft word, so the fix had to
 * supply the missing evidence instead of lowering the bar: a performer's craft
 * (singer, DJ, turntables) and the AI music platforms are music vocabulary.
 */
describe('headlines the ingest audit caught as false negatives', () => {
  it('keeps an obituary that names the performer, not the genre', () => {
    const verdict = assessNewsRelevance({
      title: "Montrealers honour Leonard Cohen, ten years after the music legend's death",
      excerpt: "A steady stream of Montrealers visited Cohen's grave to honour the late singer, ten years after his death.",
    });

    expect(verdict.relevant).toBe(true);
  });

  it('keeps a lawsuit against an AI music platform', () => {
    const verdict = assessNewsRelevance({
      title: 'Elvis Presley AI Lawsuit: Suno Sued Over Illegal Voice Cloning',
      excerpt: 'An Elvis Presley lawsuit against Suno claims the AI music company stole his singing voice.',
    });

    expect(verdict.relevant).toBe(true);
  });

  it('keeps a DJ profile whose body is mostly about animation', () => {
    const verdict = assessNewsRelevance({
      title: 'Scratch DJ Kid Koala Learned To Speak In Frames For His Animated Feature Debut',
      excerpt: 'Using turntables to give his robot character a human touch.',
    });

    expect(verdict.relevant).toBe(true);
  });

  it('does not take a strong headline term as a blank cheque', () => {
    // K-pop is unmistakable music vocabulary, but the story is a merchandise and
    // streaming tie-in, and the off-topic weight has to win.
    const verdict = assessNewsRelevance({
      title: 'K-pop group tie-in: video game, Netflix series finale and movie trailer',
    });

    expect(verdict.titleMusicScore).toBeGreaterThan(0);
    expect(verdict.relevant).toBe(false);
  });
});

describe('term matching', () => {
  it('does not read a music word out of a longer word', () => {
    // "operation" contains "opera", "steps" contains "eps", "backstage" contains
    // "stage". Substring hits used to inflate the score enough to publish junk.
    const verdict = assessNewsRelevance({ title: 'Hospital operation delays: what steps come next' });

    expect(verdict.matchedMusic).not.toContain('opera');
    expect(verdict.matchedMusic).not.toContain('eps');
    expect(verdict.relevant).toBe(false);
  });

  it('matches an accented first letter, which ASCII word boundaries would miss', () => {
    const verdict = assessNewsRelevance({ title: 'Álbum sorpresa de Bad Bunny rompe récords' });

    expect(verdict.relevant).toBe(true);
  });
});

describe('trusted music publications', () => {
  it('keeps non-English music coverage that a keyword list in English would drop', () => {
    const titles = [
      'Tonhalle Düsseldorf knackt erstmals die Marke von 6.000 Konzertabonnements',
      'Review: Hungarian National Ballet dances The Fountain of Bakhchisarai with polish',
      'Sanremo 2027, gli indizi di De Martino: Noemi, Brancale e Gaia nel toto-nomi',
      'Messiah di Händel, Christophe Rousset riscopre il capolavoro',
    ];

    for (const title of titles) {
      expect(isMusicNews({ title }, 'music-publication'), title).toBe(true);
    }
  });

  it('still drops a piece from a music outlet that is plainly another subject', () => {
    expect(isMusicNews(
      { title: 'Netflix brings together 150 Korean films in new "This is K-cinema" collection' },
      'music-publication',
    )).toBe(false);

    expect(isMusicNews(
      { title: 'La Fiscalía de Paraguay allana un inmueble del expresidente Peña' },
      'music-publication',
    )).toBe(false);
  });
});
