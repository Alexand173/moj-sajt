import { describe, expect, it } from 'vitest';
import {
  assessNewsRelevance,
  isMusicNews,
  isOffTopicJunk,
  isPublishableMusicNews,
} from '@/lib/news-relevance';

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
 * The rows that were live on the WORLD feed when the gate was audited: every one
 * of them `generated`, published under MusicTop's byline, and every one refused by
 * the gate as it stands — they predated the tightening and were never purged.
 *
 * Each headline is here for its own reason, and the reason is in the test.
 */
describe('the non-music stories that were published', () => {
  it('blocks sport by subject, not by score', () => {
    // Scored zero in both directions, so no scoring rule could ever have refused
    // it. Sport had to be named.
    const verdict = assessNewsRelevance({
      title: 'What is the DLS method? Duckworth–Lewis rules explained for ODIs and T20Is',
      excerpt: 'Wondering how rain-affected matches are decided in cricket? How the DLS method works in ODIs and T20s.',
    });

    expect(verdict.hardBlock).toBe('sport-cricket');
    expect(verdict.relevant).toBe(false);
  });

  it('refuses a business story that mentions K-pop once', () => {
    // The headline of the world feed: a beverage business story. One body mention
    // of K-pop scored 3 and carried it past a bar of 2.
    const verdict = assessNewsRelevance({
      title: "SOJU, I LOVE YOU: WORLD'S BEST-SELLING SPIRIT GETS LOCAL BOOST - NEWS | INDAILY, INSIDE SOUTH AUSTRALIA",
      excerpt: 'An Adelaide young business leader is looking to expand a locally made South Korean beverage amid growing interest in K-pop and K-dramas.',
    });

    expect(verdict.relevant).toBe(false);
  });

  it('refuses a motivational column and a property dispute', () => {
    expect(assessNewsRelevance({ title: 'Where Leaders Go Wrong with Emotional Intelligence' }).hardBlock).toBe('self-help');
    expect(assessNewsRelevance({ title: 'The Difference Between Being Interested and Being Committed' }).relevant).toBe(false);
    expect(assessNewsRelevance({ title: 'Renovation contractor ordered to refund Rs 11 lakh after abandoning promised materials' }).hardBlock).toBe('legal-property');
    expect(assessNewsRelevance({ title: 'Afreximbank targets over $540m deals at Lagos CANEX' }).relevant).toBe(false);
  });

  it('refuses celebrity physique gossip with no music in it', () => {
    expect(assessNewsRelevance({
      title: 'Pumped Robbie Williams, 52, displays his very buff physique as he poses for a shirtless backstage photo ahead of his tour',
    }).relevant).toBe(false);
  });

  it('keeps music-business reporting only from the music trade press', () => {
    // The trade-off, stated rather than hidden: business vocabulary outweighs the
    // single word "music", so a general newsroom's earnings story is refused. The
    // trade press is in the curated registry and is trusted by publisher, which is
    // where this reporting actually comes from.
    const earnings = {
      title: 'Music company revenue beats forecasts as streaming grows',
      excerpt: 'The group reported quarterly results with recorded music revenue up.',
    };

    expect(assessNewsRelevance(earnings, 'news-api').relevant).toBe(false);
    expect(assessNewsRelevance(earnings, 'music-publication').relevant).toBe(true);
  });

  it('blocks the subjects that survived the first sweep', () => {
    // Each was still live on the world feed after the 263-row purge.
    expect(assessNewsRelevance({
      title: 'IS SNL NEW TONIGHT? HOST, MUSICAL GUEST, EPISODE GUIDE',
    }).hardBlock).toBe('tv-listing');
    expect(assessNewsRelevance({
      title: "Inside 20 years of NYC's edgiest comedy festival — and the quest to find the next Jerry Seinfeld",
    }).hardBlock).toBe('comedy-arts');
    expect(assessNewsRelevance({
      title: 'A country escape straight out of a fairytale, a spectacular bottomless brunch in Sydney',
    }).hardBlock).toBe('travel-food');
    expect(assessNewsRelevance({
      title: 'VOXELCRAFT - MULTIPLAYER SANDBOX ENGINE BY TOPSONGAMES',
    }).hardBlock).toBe('video-game');
    expect(assessNewsRelevance({
      title: "Art Week Tokyo's Most Dynamic Event Is Tucked into a Capsule Hotel",
    }).hardBlock).toBe('comedy-arts');

    // A deal story with no music vocabulary: refused on score, not by subject.
    const deal = assessNewsRelevance({
      title: 'Afreximbank targets over $540m deals at Lagos CANEX',
      excerpt: 'The African Export-Import Bank has set its sights on securing creative industry deals.',
    });
    expect(deal.relevant).toBe(false);
    expect(deal.musicScore).toBeLessThan(2);
  });

  it('does not block an exhibition that is about music', () => {
    // The reason "exhibition" is in no pattern: this is a music story, and a hard
    // block on the venue word would refuse it outright — the console names were
    // removed from the video-game list for the same reason.
    const verdict = assessNewsRelevance({
      title: "Stormzy's Glastonbury stab-proof shield goes on display in landmark exhibition of Black British music",
      excerpt: "The exhibition traces Black British music through artefacts, from early grime recordings to the stage outfits of festival sets.",
    });

    expect(verdict.hardBlock).toBeNull();
    expect(verdict.relevant).toBe(true);
  });

  it('still keeps the obituary that only says "music legend" in the headline', () => {
    // The evidence rule must not undo the false-negative work: one soft headline
    // word is a subject, one strong body word is a mention.
    const verdict = assessNewsRelevance({
      title: "Montrealers honour Leonard Cohen, ten years after the music legend's death",
      excerpt: "A steady stream of Montrealers visited Cohen's grave to honour the late singer, ten years after his death.",
    });

    expect(verdict.relevant).toBe(true);
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

/**
 * The rule behind the reviews cleanup and the reviews page filter. It has to be
 * narrow: it removes a game review, not a dance review that happens to carry no
 * genre vocabulary.
 */
describe('off-topic junk rule', () => {
  it('flags a blocked subject regardless of wording', () => {
    expect(isOffTopicJunk({ title: 'GAME REVIEW #8: Wolves vs. Bucks game thread' })).toBe(true);
    expect(isOffTopicJunk({ title: 'Call of Duty: Modern Warfare 4 review' })).toBe(true);
    expect(isOffTopicJunk({ title: 'qobuz-dl-ultra 2.4.3.1' })).toBe(true);
    expect(isOffTopicJunk({ title: 'Shark PowerDetect Transformer review: a strong, versatile vacuum' })).toBe(true);
  });

  it('leaves audio gear alone, because it is music news', () => {
    expect(isOffTopicJunk({ title: 'Review: the best studio headphones for tracking guitar' })).toBe(false);
    expect(isOffTopicJunk({ title: 'The best turntables for vinyl, reviewed' })).toBe(false);
  });

  it('flags a story with no music evidence and off-topic evidence', () => {
    expect(isOffTopicJunk({ title: 'The 3 Best Movies to Watch on Netflix This Week' })).toBe(true);
    expect(isOffTopicJunk({ title: 'Senate passes the budget after a late-night vote' })).toBe(true);
  });

  it('keeps a review that simply lacks genre vocabulary', () => {
    expect(isOffTopicJunk({ title: 'Review: Tango after dark at Sadler’s Wells' })).toBe(false);
    expect(isOffTopicJunk({ title: 'Interview: U2 on fifty years together' })).toBe(false);
  });

  it('keeps a story that mentions music alongside another subject', () => {
    expect(isOffTopicJunk({
      title: 'Beyoncé announces a live album and a concert film',
      excerpt: 'A documentary accompanies the album.',
    })).toBe(false);
  });

  it('flags a books column even when its excerpt mentions music', () => {
    // "October's Best Reviewed Fiction" quotes a book called "Music Against the
    // Night", so scoring alone lets it through; the phrase is blocked instead.
    expect(isOffTopicJunk({
      title: "October's Best Reviewed Fiction",
      excerpt: "Including Yiyun Li's Music Against the Night.",
    })).toBe(true);
  });

  it('keeps a music story whose headline names only the artist', () => {
    // Both were swept up by an earlier, title-only version of the rule, and had
    // to be restored. The excerpt is what carries the evidence.
    expect(isOffTopicJunk({
      title: 'Rostam shares latest LP preview',
      excerpt: 'The song arrives ahead of the album.',
    })).toBe(false);

    expect(isOffTopicJunk({
      title: 'Machel Montano talks new documentary: interview',
      excerpt: 'The soca star discusses the film and his new album.',
    })).toBe(false);
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

describe('digests', () => {
  /**
   * A digest is several unrelated stories under one headline, so no single
   * rewrite of it can be about the right subject. The first case is the row that
   * reached the feed and was published with a full brief; the rest are the format
   * markers that let that class through once one of the stories is music.
   */
  it('refuses a multi-story wrapper even when one story is music', () => {
    const verdict = assessNewsRelevance({
      title: 'Canada to hit U.S. with retaliatory tariffs. And, remembering music legend Dolly Parton',
      excerpt: 'Remembering the legacy of country star and icon Dolly Parton, who died at 80.',
    });

    expect(verdict.hardBlock).toBe('digest');
    expect(verdict.relevant).toBe(false);
  });

  it('refuses the named digest formats', () => {
    const titles = [
      'Up First: tariff vote, visa revocations, Nevada voters',
      'Morning briefing: five new albums worth your commute',
      'Top stories: Beyoncé adds eight dates to the Cowboy Carter tour',
      'The week in music: news round-up',
    ];

    for (const title of titles) {
      expect(assessNewsRelevance({ title }).hardBlock, title).toBe('digest');
    }
  });

  it('keeps a music story that merely uses the word newsletter', () => {
    // The reason the block is format-based rather than a bare /newsletter/: this
    // is one story, from the band, about one tour.
    expect(isMusicNews({ title: "Band's newsletter confirms reunion tour" })).toBe(true);
    expect(isOffTopicJunk({ title: 'Sleaford Mods newsletter teases new album' })).toBe(false);
  });
});

describe('console brands', () => {
  it('does not treat a console mentioned in the copy as a game story', () => {
    // A console can be an exhibit, a sample source, or a collector's item. This
    // headline is about a music exhibition at the V&A and was blocked as a
    // video-game story because the copy lists the Nintendo used in JME's early
    // tunes.
    expect(isMusicNews({
      title: "Stormzy's Glastonbury stab-proof vest goes on display in landmark exhibition of Black British music",
      excerpt: "Other items include the Nintendo used in JME's early tunes, imagery of Skepta and Jammer at fabric, and original sketches of the 2-Tone label logo",
    })).toBe(true);
  });

  it('still blocks a story whose subject is a game', () => {
    expect(isMusicNews({
      title: 'Battlefield 6 patch notes: the Operation Augur update',
      excerpt: 'Gameplay changes, esports balance and a new map.',
    })).toBe(false);
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

/**
 * Sport on the EUROPA feed, 2026-11-12.
 *
 * Every golf title below was published as music news. The mechanism was the same
 * one: `tour` is a strong music term, so "European tour" scored 3 for music and 0
 * against, and a golf headline satisfied the subject test on the word "Tour".
 * Naming the sport is what stops it — not another scoring tweak.
 */
describe('sport that reached the EUROPA feed', () => {
  const publishedGolfTitles = [
    'Rory McIlroy takes a shot at Bryson DeChambeau after LIV Golf collapse',
    "Luiten Backs McIlroy's Plan To Cut PGA Tour Cards",
    'LIV Golf bankruptcy: Lawyers target January liquidation',
    "McIlroy's Card Cut Plan Wins Over DP World Tour Veteran",
    'McIlroy vs Chacarra vs Reed: Race to Dubai title up for grabs in European tour finale',
    "Tour Confidential: Lingering LIV Golf questions, Jon Rahm's statement win",
    'Jon Rahm beats Rory McIlroy to win Abu Dhabi Championship in first start since LIV Golf exit',
    "Pelaez Trevino's Hole-In-One Secures China Championship Title",
  ];

  it('reads the body when the headline names no sport', () => {
    // The one that survived the first sweep: it says "LIV absence", not "LIV
    // Golf", and names the competition only in the copy.
    const verdict = assessNewsRelevance({
      title: 'Rahm returns from LIV absence to claim Abu Dhabi title',
      excerpt: 'He held off Tyrrell Hatton by two strokes to win the Abu Dhabi Championship in Dubai.',
    });

    expect(verdict.hardBlock).toBe('sport-golf');
    expect(verdict.relevant).toBe(false);
  });

  it('refuses every golf story that was published', () => {
    for (const title of publishedGolfTitles) {
      const verdict = assessNewsRelevance({ title });
      expect(verdict.hardBlock, title).toBe('sport-golf');
      expect(verdict.relevant, title).toBe(false);
    }
  });

  it('refuses the other sports by name', () => {
    const cases: Array<[string, string]> = [
      ['World Series Game 7: the bullpen collapses again', 'sport-baseball'],
      ['NASCAR playoff picture shifts after Martinsville chaos', 'sport-motorsport'],
      ['Verstappen fastest in final practice ahead of the Singapore Grand Prix', 'sport-motorsport'],
      ['Alcaraz survives five sets to reach the Wimbledon final', 'sport-tennis'],
      ['Usyk retains the heavyweight title with a knockout win in Riyadh', 'sport-combat'],
      ['NBA: Lakers edge the Celtics in overtime', 'sport-team'],
      ['NHL: the Stanley Cup final goes to a seventh game', 'sport-team'],
      ['Paris Olympic games: who to watch in the 100m final', 'sport-athletics'],
      ['Paris fashion week: the five looks that mattered', 'fashion'],
      ['Referendum result: parliament approves the new constitution', 'politics'],
    ];

    for (const [title, reason] of cases) {
      const verdict = assessNewsRelevance({ title });
      expect(verdict.hardBlock, title).toBe(reason);
      expect(verdict.relevant, title).toBe(false);
    }
  });

  it('keeps the stories where a sport is only the stage', () => {
    const kept = [
      // The halftime headliner is a music story, so bare "super bowl" is not blocked.
      'Kendrick Lamar announced as the Super Bowl halftime show headliner',
      // Venue names: "olympic" is blocked only as "olympic games".
      'Coldplay add a second night at the Olympic Stadium',
      // December 26 is a date, not a combat sport.
      'Boxing Day concert at Alexandra Palace returns for 2026',
      // A band's European tour is exactly what this feed is for.
      'Mariah Carey announces 2027 European tour dates',
      // "NBA" is also a rapper's stage name, and this is an album announcement.
      'NBA YoungBoy announces a new album',
      // A music festival named Slam Dunk, not the basketball move.
      'Slam Dunk Festival director to step down',
      // A concert postponed *by* a playoff run is still a music story.
      "Bruce Springsteen's Philadelphia concert postponed by 76ers playoff victories",
      // A head of government announcing a concert is a concert announcement.
      'Albanian Prime Minister announces Kanye West concert in Tirana',
    ];

    for (const title of kept) {
      expect(assessNewsRelevance({ title }).hardBlock, title).toBeNull();
    }

    expect(isMusicNews({ title: 'Mariah Carey announces 2027 European tour dates' })).toBe(true);
  });

  it('keeps a performance clip and a performance at a fashion event', () => {
    // The schedule is not music ("IS SNL NEW TONIGHT? HOST, MUSICAL GUEST"), but
    // the performance is — and so is a duet staged at the Met Gala.
    const kept = [
      "Watch Olivia Rodrigo perform 'Drop Dead' on SNL",
      "Watch Sabrina Carpenter and Stevie Nicks Perform 'Landslide' at the Met Gala",
    ];

    for (const title of kept) {
      expect(assessNewsRelevance({ title }).hardBlock, title).toBeNull();
    }
  });

  it('catches an unnamed sport from two weak hints and a headline with no music', () => {
    const verdict = assessNewsRelevance({
      title: 'Standings tighten as the final round approaches',
      excerpt: 'The head coach says the squad is ready for the season opener.',
    });

    expect(verdict.hardBlock).toBe('sport');
    expect(verdict.relevant).toBe(false);
  });
});

describe('the verdict used at publish and read time', () => {
  it('trusts a music publication with a headline no word list recognises', () => {
    expect(isPublishableMusicNews({
      title: 'Xiu Xiu – Xiu Mutha Fuckin Xiu',
      url: 'https://www.nme.com/reviews/xiu-xiu',
    }, { publisherTrust: 'music' })).toBe(true);
  });

  it('holds a general newsroom to the subject test', () => {
    // Variety's music feed carried this, and its headline says nothing musical.
    expect(isPublishableMusicNews({
      title: 'Seville European Film Festival Honors Agnieszka Holland, Thierry Frémaux and Cartoon Saloon',
      url: 'https://variety.com/2026/film/festivals/seville-european-film-festival',
    }, { publisherTrust: 'general' })).toBe(false);
  });

  it('refuses a named subject even when the publisher is a music outlet', () => {
    // A publisher's reputation does not turn golf into music.
    expect(isPublishableMusicNews({
      title: 'LIV Golf is shutting down after two seasons',
      url: 'https://www.billboard.com/music/liv-golf-shutting-down',
    }, { publisherTrust: 'music' })).toBe(false);
  });
});
