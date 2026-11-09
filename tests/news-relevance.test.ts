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

  it('blocks a video game even when it mentions music', () => {
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
