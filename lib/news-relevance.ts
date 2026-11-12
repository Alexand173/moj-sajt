/**
 * Does a story belong in a music news feed?
 *
 * The scraper used to accept anything a music feed returned, which is how a
 * Qobuz downloader release, a Capcom game preview, a Netflix roundup and a Jim
 * Carrey quote all became "music news" — and, once rewritten, cost an AI call
 * each and published with MusicTop's editorial byline. A keyword filter already
 * existed for one ingest path but it accepted a single hit ("music") and skipped
 * the check entirely for Latin America.
 *
 * The rule here is deliberately simple and auditable: music terms score, off-topic
 * terms score against, and a story has to clear a small bar rather than match one
 * word. Unmistakable non-music categories are blocked outright instead of being
 * outscored, because a game preview that happens to mention a soundtrack should
 * never win on points.
 */

import { titleMentionsKnownArtist, type ArtistNameIndex } from './news-artists';

export type RelevanceInput = {
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  url?: string | null;
};

/**
 * Where the story came from decides how suspicious to be.
 *
 * `news-api` is a general news firehose, so a story has to prove it is about
 * music. `music-publication` is one of the outlets in the scraper's curated list:
 * a title like "Tonhalle Düsseldorf knackt die Marke von 6.000 Konzertabonnements"
 * is obviously music to its readers and to that outlet, but no keyword list in
 * English will ever see it, so those sources are trusted except when the story is
 * plainly about something else.
 */
export type RelevancePolicy = 'news-api' | 'music-publication';

export type RelevanceAssessment = {
  relevant: boolean;
  musicScore: number;
  offTopicScore: number;
  /** Music weight found in the headline alone; a strong signal at ingest. */
  titleMusicScore: number;
  /** Set when the story matches a category that is never music news. */
  hardBlock: string | null;
  matchedMusic: string[];
  matchedOffTopic: string[];
};

/**
 * Wraps a term list in Unicode-aware word boundaries.
 *
 * The lists used to be joined into a bare alternation, so "opera" matched inside
 * "operation", "stage" inside "backstage" and "eps" inside "steps" — scores were
 * inflated by substring accidents, which is how off-topic stories cleared the
 * bar. `\b` cannot be used instead because it is ASCII-only: "álbum" and "opéra"
 * start with a letter that `\b` does not consider a word character, so an
 * accented first term would silently never match.
 */
function buildTermPattern(alternatives: string[]): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  );
}

/** Unambiguous music vocabulary: worth three points each. */
const STRONG_MUSIC_TERMS = buildTermPattern([
  'albums?', 'singles?', 'eps?', 'mixtapes?', 'tours?', 'concerts?', 'gigs?', 'festivals?',
  'discography', 'setlists?', 'tracklists?', 'remix(?:es)?', 'vinyl', 'songwriters?', 'rappers?',
  'vocalists?', 'drummers?', 'guitarists?', 'bassists?', 'bands?', 'orchestras?', 'symphon(?:y|ies)',
  'opera', 'jazz', 'hip[ -]hop', 'k[ -]pop', 'reggaeton', 'afrobeats?', 'grime', 'house music',
  'billboard', 'grammys?', 'mtv', 'vmas?', 'mercury prize', 'spotify', 'soundcloud',
  'ballet', 'violin(?:ist)?s?', 'cellists?', 'pianists?', 'conductors?', 'philharmonic',
  'música', 'álbum', 'gira', 'conciertos?', 'cantantes?', 'banda', 'canción(?:es)?',
  'konzert(?:e|abonnement)?s?', 'konzerthaus', 'canzoni', 'morceaux', 'chansons?', 'musique',
  'opéra', 'orchestre', 'violon', 'filarmonica', 'concerto',
  // Who makes the music. Without these, an obituary or a profile of a performer
  // scored as "not music" unless the headline happened to say "music".
  'singers?', 'musicians?', 'composers?', 'frontm[ae]n', 'songst(?:er|ress)', 'crooners?',
  'turntablists?', 'turntables?', 'djs?', 'beatmakers?', 'classical', 'soundtracks?',
  'conservator(?:y|ies)', 'recitals?', 'choirs?', 'sopranos?', 'mezzos?', 'tenors?', 'arias?',
  // AI music services: a lawsuit or a model launch is music-industry news, and
  // the company name was the only thing the headline gave away.
  'suno', 'udio', 'elevenlabs',
  // The contest is a music institution; its stories rarely say "music".
  'eurovision',
]);

/** Supporting vocabulary: worth one point each, never enough on its own. */
const SOFT_MUSIC_TERMS = buildTermPattern([
  'music', 'musical', 'songs?', 'artists?', 'producers?', 'labels?', 'charts?', 'records?',
  'recordings?', 'release[sd]?', 'perform(?:ance|s|ed)?', 'stage', 'studio', 'mix(?:es)?',
  'beats?', 'lyrics', 'awards?', 'live', 'ensemble', 'quartet', 'trio',
  'tribute', 'reissues?', 'playlists?', 'streaming', 'catalogues?', 'catalogs?', 'vocals?',
]);

/** Things that make a story not-a-music-story. Two points each against it. */
const OFF_TOPIC_TERMS = buildTermPattern([
  'video games?', 'gameplay', 'gaming', 'esports', 'box office', 'netflix', 'tv series',
  'season finale', 'episode \\d+', 'film', 'movies?', 'documentary', 'trailer', 'sitcom',
  // "shares" alone was an off-topic term for the stock market, and it matched the
  // verb in "Rostam shares new single" — the single most common music headline
  // pattern there is. Financial context is named instead.
  'election', 'senator', 'congress', 'senate', 'prime minister', 'stock market', 'share prices?', 'stocks?', 'earnings report',
  'ipo', 'crypto', 'bitcoin', 'smartphone', 'iphone', 'android', 'chatgpt', 'software', 'downloader',
  'changelog', 'github', 'plugin', 'browser extension',
  // Business and trade. Scored, not blocked: a music-business story ("Warner
  // Music revenue rises") is music news, and blocking the word would silence the
  // trade press the registry deliberately includes. "Afreximbank targets over
  // $540m deals at Lagos CANEX" carried no music vocabulary at all, so it loses on
  // score instead.
  'tariffs?', 'exports?', 'imports?', 'exporter', 'trade deals?', 'trade war',
  'revenue', 'turnover', 'shareholders?', 'acquisitions?', 'mergers?',
  'quarterly results', 'quarterly earnings', 'profit warning', 'interest rates?',
  'fiscalía', 'gobierno', 'elecciones', 'votar', 'presidente', 'parlamento', 'justicia',
  // A books column reached the reviews page as "October's Best Reviewed Fiction".
  'fiction', 'novels?', 'book reviews?',
]);

/**
 * Sport, named by family.
 *
 * The single sport entry this replaces listed six competitions, so golf — which
 * filled the `europa` feed with nine LIV Golf and DP World Tour stories in one
 * day — was not a subject at all. Worse, `tour` is a strong music term, so
 * "Race to Dubai title up for grabs in European tour finale" scored 3 for music
 * and 0 against, and cleared the subject test on the word "Tour" alone.
 *
 * Every family is blocked by name rather than scored, because a sports story can
 * carry music vocabulary honestly — a walk-on song, a player's playlist — and the
 * subject is what decides, not the vocabulary.
 *
 * Three exceptions are deliberate, and they are expressed in the wording so they
 * never need a whitelist:
 *
 * - `olympic` alone is not blocked: the Olympic Stadium hosts concerts.
 * - bare `super bowl` is not blocked: the halftime headliner is music news.
 * - `boxing` is not blocked when the next word is `day`: December 26 is a date.
 */
const SPORT_BLOCKS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // "Race to Dubai" is golf's season-long points race, and it was the one story
    // in the batch that named no other golf word: "Race to Dubai title up for
    // grabs in European tour finale" is a golf story whose only strong music term
    // was "tour".
    pattern: /\b(?:golf(?:er|ers|ing)?|liv golf|dp world tour|pga|lpga|ryder cup|solheim cup|race to dubai|world tour championship|abu dhabi championship|dubai desert classic|hole[- ]in[- ]one|birdie putt|bogeys?|fairway|tee shot|green jacket|augusta national|masters tournament)\b/i,
    reason: 'sport-golf',
  },
  {
    pattern: /\b(?:baseball|mlb|world series|pitchers?|home runs?|bullpen|innings?|batting average|strikeout)\b/i,
    reason: 'sport-baseball',
  },
  {
    pattern: /\b(?:nascar|formula (?:one|1)|f1|grand prix|motogp|indycar|pole position|pit stop|chequered flag|lap record)\b/i,
    reason: 'sport-motorsport',
  },
  {
    pattern: /\b(?:tennis|wimbledon|roland garros|atp tour|wta|grand slam title|match point)\b/i,
    reason: 'sport-tennis',
  },
  {
    pattern: /\b(?:boxing(?!\s+day)|heavyweight title|welterweight|knockout win|title bout|ufc|mma fight)\b/i,
    reason: 'sport-combat',
  },
  {
    // Not bare "super bowl": the halftime headliner is a music story. The sport
    // is named by its champions and its game, never by the show.
    pattern: /\b(?:basketball|nba(?!\s*young-?boy)|three-pointer|ice hockey|nhl|stanley cup|rugby|six nations|premier league|la liga|serie a|bundesliga|champions league|world cup|uefa|fifa|soccer|football (?:club|team|match|league)|quarterback|touchdown|super bowl (?:winner|champions|championship game)|playoff berth|transfer window|hat[- ]trick|medal table)\b/i,
    reason: 'sport-team',
  },
  {
    // The row that prompted the first version of this block: "What is the DLS
    // method? Duckworth–Lewis rules explained for ODIs and T20Is".
    pattern: /\b(?:cricket|wickets?|innings|test match|one[- ]day international|t20is?|odi|goalkeepers?)\b/i,
    reason: 'sport-cricket',
  },
  {
    // Not bare "olympic": the Olympic Stadium hosts concerts.
    pattern: /\b(?:olympic games|winter olympics|paralympic|marathon record|triathlon|darts championship|snooker|tour de france|kentucky derby|grand national|horse racing)\b/i,
    reason: 'sport-athletics',
  },
];

/**
 * The net for a sport nobody has named yet.
 *
 * These words are common in match reports and rare in music writing, but each is
 * weak on its own — "championship" appears in a contest for unsigned bands — so
 * two of them together are required, and only when the headline says nothing
 * musical. A named sport above is refused on the first hit instead.
 */
const SPORT_CONTEXT_TERMS = buildTermPattern([
  'championships?', 'tournament', 'leaderboard', 'final round', 'title race',
  'standings', 'head coach', 'squad', 'season opener', 'transfer fee',
  'second half', 'opening round', 'course record', 'tee time',
]);
const SPORT_CONTEXT_LIMIT = 2;

/** Categories that are never music news, however many music words appear. */
const HARD_BLOCKS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // "GAME REVIEW #8: Wolves vs. Bucks game thread" and "Call of Duty: Modern
    // Warfare 4 review" both reached the reviews page: a franchise report or a
    // fixture thread is never music, so it is blocked instead of scored.
    //
    // Console and franchise names were in this list until they blocked
    // "Stormzy's Glastonbury stab-proof vest goes on display in landmark
    // exhibition of Black British music" — the excerpt mentions the Nintendo in
    // JME's early tunes, because the console is part of the exhibit. A brand is a
    // mention; "gameplay", "esports" and "game review" are the subject.
    pattern: /\b(capcom|gameplay|esports|dlc|call of duty|game review|game thread|battle royale|patch notes|sandbox engine|multiplayer|early access)\b/i,
    reason: 'video-game',
  },
  {
    pattern: /\b(downloader|changelog|release notes|command[- ]line|open[- ]source|github)\b/i,
    reason: 'software',
  },
  {
    // "Shark PowerDetect Transformer review: a strong, versatile vacuum" reached
    // the reviews page: a home-appliance verdict has no music words to score
    // against, so it needs a category block rather than a score. Audio gear is
    // deliberately absent — headphones and turntables are music news.
    pattern: /\b(vacuums?|air fryers?|mattress(?:es)?|blenders?|dishwashers?|toasters?|microwave ovens?)\b/i,
    reason: 'consumer-product',
  },
  {
    // Phrase-level, not the bare word "fiction": a band may be called Fiction,
    // but "October's Best Reviewed Fiction" is a books column, and its excerpt
    // quotes a book called "Music Against the Night", so scoring alone lets it
    // through.
    pattern: /\b(reviewed fiction|book reviews?|best books?)\b/i,
    reason: 'books',
  },
  // Every sport in `SPORT_BLOCKS`, spread so one list answers "is this a sport?"
  // and the reason names the family that matched.
  ...SPORT_BLOCKS,
  {
    // "Where Leaders Go Wrong with Emotional Intelligence" and "The Difference
    // Between Being Interested and Being Committed" were both published as music
    // news. A motivational column has no music words to score against, so it needs
    // a category rather than a score.
    pattern: /\b(emotional intelligence|self[- ]help|productivity hacks?|success advice|life coach(?:ing)?|mindfulness)\b/i,
    reason: 'self-help',
  },
  {
    // "Renovation contractor ordered to refund Rs 11 lakh after abandoning promised
    // materials" — a property dispute, in the WORLD feed, under MusicTop's byline.
    pattern: /\b(real estate|property dispute|refund order|land dispute|contractor|tenants? (?:rights|dispute)|renovation contractor)\b/i,
    reason: 'legal-property',
  },
  {
    /**
     * Government, named by institution rather than by the single word
     * "election", which is already scored against: a music-business story can
     * legitimately mention an election's effect on touring.
     *
     * Deliberately not bare "parliament" — Parliament is a band — and not bare
     * "congress" — the Congress Theater is a venue. Only phrases that can be
     * nothing but government are blocked.
     */
    pattern: /\b(?:election results|ballot box|referendum|parliamentary (?:election|vote)|senate (?:vote|hearing|panel|confirm)|congressional (?:hearing|vote|panel)|white house|kremlin|coalition government|minister of (?:state|foreign|finance))\b/i,
    reason: 'politics',
  },
  {
    /**
     * Fashion coverage: the Met Gala and the shows around it are style reporting
     * with a red carpet, not music news, however many performers appear in them.
     */
    // "met gala" alone is not blocked: "Watch Sabrina Carpenter and Stevie Nicks
    // Perform 'Landslide' at the Met Gala" is a performance. The looks, the photos
    // and the carpet are the fashion story.
    pattern: /\b(?:fashion week|runway show|haute couture|street style|met gala (?:looks?|outfits?|photos?|dress|gown|beauty|fashion)|fashion house)\b/i,
    reason: 'fashion',
  },
  {
    /**
     * Screen-industry events. "Seville European Film Festival Honors Agnieszka
     * Holland" reached `europa` from Variety's feed and was safe on score alone:
     * "festival" is worth 3 for music and "film" only 2 against, so a film
     * festival beat the tie by a single word.
     *
     * Not a bare "film" block: a music documentary, a biopic or a concert film is
     * music news, and those headlines say "film" without being about the film
     * industry.
     */
    pattern: /\b(?:film festival|film awards?|movie premiere|cinema awards?)\b/i,
    reason: 'film-industry',
  },
  {
    /**
     * Television listings. "IS SNL NEW TONIGHT? HOST, MUSICAL GUEST, EPISODE…"
     * scored on "musical" and "guest" and was published as world news. A listing
     * names a broadcast, not a music story, however many words about music it
     * contains.
     */
    // Narrowed from a bare `snl`: a performance clip ("Watch Olivia Rodrigo
    // Perform 'Drop Dead' on SNL") is music news, and 73 such rows were queued for
    // removal. What is not music is the schedule — who is hosting, who is the
    // musical guest, which episode is new tonight.
    pattern: /\b(?:is snl new tonight|snl new tonight|snl (?:host|musical guest)|saturday night live (?:host|musical guest)|late[- ]night show|talk show|episode guide|tv listing|what to watch (?:tonight|this week))\b/i,
    reason: 'tv-listing',
  },
  {
    /**
     * Comedy and art-world events: "Inside 20 years of NYC's edgiest comedy
     * festival" and "Art Week Tokyo's Most Dynamic Event Is Tucked into a Capsule
     * Hotel". Deliberately not the bare word "exhibition": "Stormzy's stab-proof
     * vest goes on display in landmark exhibition of Black British music" is a
     * music story, and a hard block would kill it.
     */
    pattern: /\b(comedy festival|stand[- ]up special|art fair|art week|gallery opening)\b/i,
    reason: 'comedy-arts',
  },
  {
    /**
     * Travel and food guides: "A country escape straight out of a fairytale, a
     * spectacular bottomless brunch in Sydney" and "6 Red Flags You're About To
     * Eat At A Tourist Trap Restaurant". Both were published under WORLD.
     */
    pattern: /\b(brunch|food guide|restaurant review|tourist trap|travel guide|capsule hotel|hotel review)\b/i,
    reason: 'travel-food',
  },
  {
    // A quotes column is not music news even when the person quoted is a musician:
    // "Quote of the Day by Shakira: 'I just want to grow old with a man who… –
    // Timeless life lessons'" is a self-help page that happens to name an artist,
    // and artist recognition would otherwise rescue it.
    pattern: /\b(quote of the day|life lessons|inspiring lessons)\b/i,
    reason: 'quote-column',
  },
  {
    /**
     * Body-and-appearance gossip. Scored first and it was not enough: the headline
     * that prompted this — "Pumped Robbie Williams, 52, displays his very buff
     * physique as he poses for a shirtless backstage photo ahead of his tour" —
     * says "tour", so it carries real music weight and outscored the gossip.
     * A story whose subject is someone's body is not music news, whatever else the
     * sentence contains.
     */
    pattern: /\b(physique|shirtless|bikini|baby bump|doppelganger|divorce filing|red carpet outfit)\b/i,
    reason: 'celebrity-gossip',
  },
  {
    // A digest is several unrelated stories under one headline, so it is not one
    // story and cannot be rewritten as one. The row that prompted this: "Canada
    // to hit U.S. with retaliatory tariffs. And, remembering music legend Dolly
    // Parton" — a politics newsletter with one obituary in it, published as music
    // news with a full brief.
    //
    // Judged on the format, not on the vocabulary: the current gate already drops
    // that exact headline, but a digest that mentions an album or a tour clears
    // the score, because one of its five stories is music. The signals below are
    // wrappers a single-subject headline never needs.
    //
    // Deliberately not a bare /newsletter/ block: "Band's newsletter confirms
    // reunion tour" is a real music headline.
    // `related stories:` and `drudge` cover the aggregator wrapper: "Europe Hit By
    // More Bomb Threats Targeting TV Studios, Flights... / Drudge Report Feed
    // needs your support!" was published under `europa` as a single story.
    pattern: /(?:\.\s+and,\s)|\b(?:up first|morning brief(?:ing)?|evening brief(?:ing)?|daily brief(?:ing)?|top stories|news round-?up|drudge|feed needs your support)\b|related stories:/i,
    reason: 'digest',
  },
];

const SOFTWARE_WORD = /\b(dl|tool|cli|apps?|software|plugin|library|script|bot|api|version)\b/i;
const VERSION_NUMBER = /\bv?\d+\.\d+\.\d+\b/i;

/** A strong music term outweighs a single off-topic mention of a film or a chart. */
const STRONG_MUSIC_WEIGHT = 3;
const SOFT_MUSIC_WEIGHT = 1;
const OFF_TOPIC_WEIGHT = 2;
/** Enough to be about music: one strong term, or a cluster of soft ones. */
const RELEVANT_MUSIC_SCORE = 2;
/** On a trusted music outlet, this much off-topic weight with no music at all means another subject. */
const TRUSTED_SOURCE_REJECT_SCORE = 2;

function collectMatches(text: string, pattern: RegExp): string[] {
  const matches = text.match(pattern) || [];
  return Array.from(new Set(matches.map((match) => match.toLowerCase())));
}

/**
 * Scores a story on its headline plus whatever body text the feed supplied.
 * The headline carries the most weight in practice, because feeds truncate the
 * body, but all three fields are read so a bare headline can still be judged.
 */
export interface RelevanceOptions {
  /**
   * Names the site already knows, from the chart and tour data. Optional:
   * without it the gate is simply stricter, never wrong.
   */
  knownArtists?: ArtistNameIndex | null;
  /**
   * How far to trust the publisher, resolved by the caller (`lib/news-sources`
   * owns the host lists). `general` means the story comes from a general newsroom
   * whose music section still publishes the occasional non-music piece, so even
   * under the publisher-trust policy it must name its subject in the headline.
   *
   * Passed in rather than imported so this module stays a pure scoring function
   * with no dependency on a 140-entry source registry.
   */
  publisherTrust?: PublisherTrust;
}

/** Who published the story, as far as the registry can tell. */
export type PublisherTrust = 'music' | 'general' | 'unknown';

export function assessNewsRelevance(
  input: RelevanceInput,
  policy: RelevancePolicy = 'news-api',
  options: RelevanceOptions = {},
): RelevanceAssessment {
  const text = [input.title, input.excerpt, input.content].filter(Boolean).join(' \n ');

  if (!text.trim()) {
    return {
      relevant: false,
      musicScore: 0,
      offTopicScore: 0,
      titleMusicScore: 0,
      hardBlock: 'empty',
      matchedMusic: [],
      matchedOffTopic: [],
    };
  }

  const title = String(input.title || '');
  const matchedMusic = [
    ...collectMatches(text, STRONG_MUSIC_TERMS),
    ...collectMatches(text, SOFT_MUSIC_TERMS),
  ];
  const matchedOffTopic = collectMatches(text, OFF_TOPIC_TERMS);

  /**
   * An artist's name is the one piece of music evidence no word list contains.
   * "JAŸ-Z Adds London Stadium Show To 30-Year Celebration Run" and "Lindsey
   * Buckingham shares surprising update about relationship with Stevie Nicks" are
   * music stories that score zero on vocabulary alone. The charts and the tour
   * data already know those names, so they are worth a strong term each.
   */
  const artistInTitle = titleMentionsKnownArtist(title, options.knownArtists);
  const artistInText = artistInTitle || titleMentionsKnownArtist(text, options.knownArtists);
  if (artistInText) matchedMusic.push('known-artist');

  const strongHits = collectMatches(text, STRONG_MUSIC_TERMS).length;
  const softHits = collectMatches(text, SOFT_MUSIC_TERMS).length;
  const musicScore = strongHits * STRONG_MUSIC_WEIGHT
    + softHits * SOFT_MUSIC_WEIGHT
    + (artistInText ? STRONG_MUSIC_WEIGHT : 0);
  const offTopicScore = matchedOffTopic.length * OFF_TOPIC_WEIGHT;

  // Feeds truncate the body, so the headline is often all the evidence there is.
  // A soft "music" in a headline is not enough on its own — that rule is what let
  // junk through originally — but an unmistakable term is: "Scratch DJ Kid Koala
  // ... Animated Feature Debut" is a music story even though "animated feature"
  // scores against it.
  const titleStrongHits = collectMatches(title, STRONG_MUSIC_TERMS).length;
  const titleMusicScore = titleStrongHits * STRONG_MUSIC_WEIGHT
    + collectMatches(title, SOFT_MUSIC_TERMS).length * SOFT_MUSIC_WEIGHT
    + (artistInTitle ? STRONG_MUSIC_WEIGHT : 0);

  /**
   * Two weak sport words and no music subject in the headline is a match report
   * for a sport not yet named. Requiring both halves is what keeps a music story
   * that happens to say "tournament" or "squad" alive.
   */
  const sportContextBlocked = collectMatches(text, SPORT_CONTEXT_TERMS).length >= SPORT_CONTEXT_LIMIT
    && titleMusicScore === 0;

  // "qobuz-dl-ultra 2.4.3.1" reads as a changelog entry, not a headline: a
  // version number only blocks when software vocabulary sits next to it.
  const versionBlocked = VERSION_NUMBER.test(text) && SOFTWARE_WORD.test(text);

  const hardBlock = HARD_BLOCKS.find((block) => block.pattern.test(text))?.reason
    ?? (sportContextBlocked ? 'sport' : null)
    ?? (versionBlocked ? 'software-release' : null);

  /**
   * Is music the subject, or only a mention?
   *
   * "SOJU, I LOVE YOU: WORLD'S BEST-SELLING SPIRIT GETS LOCAL BOOST" scored 3 for
   * one body mention of K-pop, inside a business story about a beverage, and that
   * single mention carried it past the bar. One mention is context; a subject
   * either says something musical in the headline — even a single soft word — or
   * says it twice in the body.
   *
   * One soft headline word is enough because the headline is the subject, not a
   * mention: "…ten years after the music legend's death" is an obituary of a
   * singer, and requiring a *strong* term there would refuse it. The obituary has
   * one strong body hit only, which is why the body clause asks for two.
   *
   * Only the general firehose is held to this. A curated music outlet is trusted
   * by host, so it does not have to prove its subject in English.
   */
  const hasSubjectEvidence = titleMusicScore >= SOFT_MUSIC_WEIGHT || strongHits >= 2;

  const relevant = hardBlock
    ? false
    : policy === 'music-publication'
      // A curated music outlet does not need to prove its subject in English. It
      // is only overruled when it is plainly reporting something else…
      ? !(musicScore === 0 && offTopicScore >= TRUSTED_SOURCE_REJECT_SCORE)
        // …or when it is a general newsroom's music section, which still carries
        // the occasional non-music piece: "Seville European Film Festival Honors
        // Agnieszka Holland" came from Variety's feed with no music word in it.
        && (options.publisherTrust !== 'general' || hasSubjectEvidence)
      // A tie is allowed: "album ... film" is a music story that mentions a film,
      // while "film ... music" is a film story that mentions music. An
      // unmistakable music term in the headline is enough on its own, because
      // feeds truncate the body and an obituary or a DJ profile rarely says
      // "music" twice.
      : hasSubjectEvidence
        && ((musicScore >= RELEVANT_MUSIC_SCORE && musicScore >= offTopicScore)
          || (titleStrongHits > 0 && musicScore > offTopicScore));

  return {
    relevant,
    musicScore,
    offTopicScore,
    titleMusicScore,
    hardBlock,
    matchedMusic: Array.from(new Set(matchedMusic)).slice(0, 8),
    matchedOffTopic: matchedOffTopic.slice(0, 8),
  };
}

/**
 * Is this plainly about something else, rather than merely short of music words?
 *
 * A stricter check than `relevant` on purpose: it is used to remove stored rows
 * and to filter the reviews page, where a legitimate review of a dance piece or a
 * songwriter profile may contain no genre vocabulary at all. It only fires on a
 * hard block (a game, a software release) or on off-topic evidence with no music
 * evidence whatsoever — which is what a fixture thread or a Netflix roundup looks
 * like.
 */
export function isOffTopicJunk(input: RelevanceInput): boolean {
  const assessment = assessNewsRelevance(input);

  // A blocked subject (a game, a software release) is never music, however the
  // headline is worded. Otherwise: no music evidence at all, plus at least one
  // off-topic signal. Requiring both is what keeps a dance review alive.
  if (assessment.hardBlock && assessment.hardBlock !== 'empty') return true;

  return assessment.musicScore === 0 && assessment.offTopicScore >= OFF_TOPIC_WEIGHT;
}

/** Convenience for ingest paths that only need the verdict. */
export function isMusicNews(
  input: RelevanceInput,
  policy: RelevancePolicy = 'news-api',
): boolean {
  return assessNewsRelevance(input, policy).relevant;
}

export interface PublishabilityOptions {
  knownArtists?: ArtistNameIndex | null;
  /** From `getPublisherTrust(url)` in `lib/news-sources`. */
  publisherTrust?: PublisherTrust;
}

/**
 * The one verdict that decides whether a story may be *served*.
 *
 * Ingest alone was never enough: the rule only guarded new arrivals, so a row
 * stored before a subject was named stayed published forever. Golf filled the
 * `europa` feed for exactly that reason — every one of those rows was `generated`,
 * and the region page filters on `ai_status` alone.
 *
 * So the same call is used at four points, and a story that fails any one of them
 * is not music news anywhere:
 *
 * - ingest (`app/api/fetch-news`), before a row is stored
 * - publish (`lib/news-ai-enrichment`), before an AI call is spent
 * - read (region feed, article page, brief API, related stories, reviews)
 * - discovery (`app/sitemap`), so a refused story is never advertised
 *
 * The policy follows the publisher, not the category: a curated music outlet is
 * trusted with a headline no English word list will recognise ("Xiu Xiu – Xiu
 * Mutha Fuckin' Xiu"), while a general newsroom has to name its subject. A hard
 * block overrules both, because a named subject that is never music — golf, an
 * election, a video game — is not rescued by a publisher's reputation.
 */
export function isPublishableMusicNews(
  input: RelevanceInput,
  options: PublishabilityOptions = {},
): boolean {
  const publisherTrust = options.publisherTrust ?? 'unknown';
  const policy: RelevancePolicy = publisherTrust === 'music' ? 'music-publication' : 'news-api';

  return assessNewsRelevance(input, policy, {
    knownArtists: options.knownArtists ?? null,
    publisherTrust,
  }).relevant;
}

