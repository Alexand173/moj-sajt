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

import { findArtistMentions, type ArtistNameIndex } from './news-artists';

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

/**
 * Anchors: vocabulary that is music and nothing else. Three points each, and the
 * only tier that can establish a story's subject.
 *
 * This replaced a flat "strong" list that mixed real anchors with words a
 * newsroom uses for anything. A score cannot tell those apart, which is why an
 * olive-oil "festival" and a Beyoncé album both read as three points of music.
 * The tiers below are the difference between *what the story is about* and *what
 * word happens to be in it*.
 */
const ANCHOR_MUSIC_TERMS = buildTermPattern([
  'albums?', 'singles?', 'eps?', 'mixtapes?', 'tours?', 'concerts?', 'gigs?',
  'discography', 'setlists?', 'tracklists?', 'remix(?:es)?', 'vinyl', 'songwriters?', 'rappers?',
  'vocalists?', 'drummers?', 'guitarists?', 'bassists?', 'bands?', 'orchestras?', 'symphon(?:y|ies)',
  // `k[ -]pop` missed the spelling newsrooms actually use: Forbes wrote "KPop"
  // and "KPop Idol Departure" 14 times, and none of it matched a hyphen or a space.
  'opera', 'jazz', 'hip[ -]?hop', 'k[- ]?pop', 'reggaeton', 'afrobeats?', 'grime', 'house music',
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
  // Songs and releases, named plainly. "new song" was a soft term, which meant a
  // release announcement could not establish its own subject.
  'songs?', 'album review', 'new album', 'tour dates?',
  // Instruments. "Joe Bonamassa on how Albert Collins taught him to wield his
  // guitar" is a music feature that scored nothing, because only "guitarists"
  // was in the list — the instrument a player holds was not music evidence.
  'guitars?', 'bass guitars?', 'drum kits?', 'drums?', 'pianos?', 'synthesi[sz]ers?', 'synths?',
  'microphones?', 'amps?', 'amplifiers?', 'effect pedals?',
  // Owned names. A festival's name is music evidence no register contains, and it
  // is what rescues "Anyma's Coachella Set Canceled Due to Strong Wind Conditions"
  // — a music story with no music vocabulary at all.
  'glastonbury', 'coachella', 'tomorrowland', 'lollapalooza', 'sziget', 'primavera sound',
  'rock en seine', 'sxsw', 'sanremo', 'download festival', 'reading (?:and|&) leeds',
  // Programme vocabulary no other kind of listing uses.
  'line-?ups?', 'headliners?', 'headlining',
  // Genres. Bare where the word is music in practice; compound where it is not,
  // because "rock" is also a verb and "metal" is also a material. The French row
  // "…un voyage rock et disco psychédélique" scored zero without these.
  'punk', 'disco', 'techno', 'reggae', 'grunge', 'ska', 'funk', 'blues', 'r&b', 'rnb',
  'amapiano', 'dembow', 'corridos?', 'sertanejo', 'bossa nova', 'fado',
  'rock (?:band|music|album|star|song|tour|festival|opera)', 'heavy metal', 'death metal',
  'hard rock', 'indie rock', 'alt-?rock', 'metal bands?',
  // "Country" is a nation; the artist is the compound ("Country star Gabby
  // Barrett says…"). "rock and roll" is the phrase NPR used for the Grateful Dead.
  'country (?:music|star|stars|singer|singers|album|song|band)',
  'rock and roll', 'listening bars?', 'bluegrass', 'americana', 'gospel music',
  // Festival journalism is music journalism even when it never says "music".
  'music festivals?', 'festival season', 'festival line-?up',
  'roskilde', 'werchter', 'hellfest', 'wacken', 'rock am ring', 'reading festival',
  // Further instruments: "Istanbul cymbals: from war tool to pulse of global music"
  // had the word music in it and no anchor.
  'percussion', 'cymbals?', 'saxophones?', 'trumpets?', 'trombones?', 'flutes?', 'cellos?',
  'violas?', 'harps?', 'banjos?', 'mandolins?', 'playlists?',
]);

/**
 * Support: one point each. These appear in music stories constantly and in other
 * stories occasionally, so they raise a score but can never establish a subject.
 *
 * `festival` sits here rather than in the anchors. "Umbria tells its story
 * through olive oil … the festival celebrating the region's signature product"
 * scored three points as an anchor and passed; as support it still boosts a real
 * festival announcement, but cannot carry a food column on its own.
 */
const SUPPORT_MUSIC_TERMS = buildTermPattern([
  'music', 'musical', 'artists?', 'producers?', 'labels?', 'charts?',
  'recordings?', 'perform(?:ance|s|ed)?', 'stage', 'studio', 'mix(?:es)?',
  'beats?', 'lyrics', 'awards?', 'live', 'ensemble', 'quartet', 'trio',
  'tribute', 'reissues?', 'streaming', 'catalogues?', 'catalogs?', 'vocals?',
  'festivals?',
]);

/**
 * Ambiguous: half a point, and never able to outvote an off-topic hit.
 *
 * "record" is a chart position and also a record profit; "release" is a single
 * and also a press release; "sets" is a DJ set and also "sets the agenda".
 * Counting them at full weight is what let a business story win a tie it should
 * have lost.
 */
const AMBIGUOUS_MUSIC_TERMS = buildTermPattern([
  'records?', 'release[sd]?', 'act', 'material', 'score', 'sets?', 'number', 'entry', 'shows?',
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
    pattern: /\b(?:basketball|wnba|nba(?!\s*young-?boy)|three-pointer|all-star 3-point|ice hockey|nhl|stanley cup|rugby|six nations|premier league|la liga|serie a|bundesliga|champions league|world cup|uefa|fifa|soccer|football (?:club|team|match|league)|quarterback|touchdown|super bowl (?:winner|champions|championship game)|playoff berth|transfer window|hat[- ]trick|medal table)\b/i,
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
  'second half', 'opening round', 'course record', 'tee time', 'playoff push',
  'playoff run', 'power rankings',
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
    // "guided tours" is the phrase that let "Umbria tells its story through olive
    // oil" score: "tours" is an anchor, and a wine or olive-oil festival runs them.
    pattern: /\b(brunch|food guide|restaurant review|tourist trap|travel guide|capsule hotel|hotel review|guided tours?|wine tasting|tasting menu|olive oil)\b/i,
    reason: 'travel-food',
  },
  {
    /**
     * Stage theatre. Promoting "music" in a headline made "Playwright of New
     * Musical, 'In America,' Hal Harper Renounces Pen Name" publishable — the
     * word "musical" is the show's genre, not its subject, and a Broadway
     * opening is theatre coverage. Named by its own vocabulary so a concert at a
     * theatre is unaffected.
     */
    pattern: /\b(?:playwright|broadway (?:production|show|musical)|west end (?:production|show)|theatre company|regional theatre)\b/i,
    reason: 'theatre',
  },
  {
    // "What kind of music do hedgehogs like?" — the word music names the animal's
    // stimulus, not the story's subject. Promoting "music" in a headline is what
    // makes this block necessary.
    pattern: /\b(?:what|which) kind of music do\b|\bmusic (?:for|and) (?:animals|dogs|cats|plants|hedgehogs)\b/i,
    reason: 'nature-curiosity',
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
  {
    /**
     * A film franchise is not a genre.
     *
     * "SDCC: Hasbro Unveils 'KPop Demon Hunters' Rumi Premium Electronic Sword",
     * "Mattel's 'KPop Demon Hunters' SDCC Exclusive Figures Go On Sale This Week"
     * and "KPop Demon Hunters Rumi & Jinu in The Daily LITG" all scored 9 for one
     * reason: `kpop` is an anchor and toy vocabulary scores nothing against it.
     *
     * Blocked by context, never by name. The film's soundtrack and its singles are
     * music news, so the phrase on its own is not the subject — the merchandise is.
     */
    // Two lookaheads from the start of the text, so the order does not matter: the
    // sword can be named before the film and the film before the figures. The
    // context list covers merchandise *and* screen coverage — a toy, a quote, a
    // cast interview — because both are the film rather than its music.
    pattern: /(?=[\s\S]*\bk-?pop demon hunters?\b)(?=[\s\S]*\b(?:figures?|toys?|dolls?|swords?|comics?|merch(?:andise)?|box office|sequels?|trailers?|plush|funko|lego|quotes?|greatest line|best line|characters?|cast|movie|netflix|episodes?|series)\b)/i,
    reason: 'screen-merchandise',
  },
];

const SOFTWARE_WORD = /\b(dl|tool|cli|apps?|software|plugin|library|script|bot|api|version)\b/i;
const VERSION_NUMBER = /\bv?\d+\.\d+\.\d+\b/i;

/**
 * The word that names the subject, when it is in the headline.
 *
 * "music" is support in the body — "amid growing interest in music" is a mention.
 * In a headline it is the subject itself: "British music festivals stage tentative
 * revival" is a music-business story, and 513 held rows in the cleanup report were
 * held by this word alone. It establishes a subject without being an anchor, and
 * unlike `festival` it is not a word other kinds of story use.
 */
const HEADLINE_SUBJECT_TERMS = buildTermPattern(['music', 'musical']);

/**
 * Words a headline puts before a name it is only mentioning.
 *
 * "Tom Dreesen, Stand-Up Comedian Who Opened for Frank Sinatra, Dies at 86" is a
 * comedian's obituary. The artist is real and correctly recognised; the `for` is
 * what says he is not the subject, without having to know who Tom Dreesen was.
 */
const MENTION_PREPOSITIONS: Set<string> = new Set([
  'for', 'with', 'featuring', 'feat', 'alongside', 'like', 'about', 'by', 'to', 'of',
]);

/** An anchor outweighs a single off-topic mention of a film or a chart. */
const ANCHOR_WEIGHT = 3;
const SUPPORT_WEIGHT = 1;
/** Half a point: enough to tip a close call, never enough to make one. */
const AMBIGUOUS_WEIGHT = 0.5;
const OFF_TOPIC_WEIGHT = 2;
/** Enough to be about music: one anchor, plus whatever support it has. */
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

/**
 * The scraper writes its own metadata into the body of every OFFICIAL row:
 *
 *   excerpt  "SOURCE: EFE.COM"
 *   content  "Music update from efe.com"
 *
 * These are not the story. Judged at face value they hand every scraped row one
 * free point from the word "Music" — which is why 1,943 rows in the cleanup report
 * scored exactly "1 vs 0": a Spanish election report and a cancelled Coachella set
 * were indistinguishable, because neither headline was being read at all.
 *
 * A stub is replaced with nothing, so the headline is what gets judged.
 */
const SCRAPER_STUB_PATTERNS: RegExp[] = [
  /^SOURCE:\s*[\w.-]+\s*$/i,
  /^Music update from\s+[\w.\-]+\s*$/i,
];

function stripScraperStub(input: RelevanceInput): RelevanceInput {
  const clean = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    return SCRAPER_STUB_PATTERNS.some((pattern) => pattern.test(trimmed)) ? null : value ?? null;
  };

  return { title: input.title, url: input.url, excerpt: clean(input.excerpt), content: clean(input.content) };
}

export function assessNewsRelevance(
  input: RelevanceInput,
  policy: RelevancePolicy = 'news-api',
  options: RelevanceOptions = {},
): RelevanceAssessment {
  const judged = stripScraperStub(input);
  const text = [judged.title, judged.excerpt, judged.content].filter(Boolean).join(' \n ');

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

  const title = String(judged.title || '');
  const matchedMusic = [
    ...collectMatches(text, ANCHOR_MUSIC_TERMS),
    ...collectMatches(text, SUPPORT_MUSIC_TERMS),
    ...collectMatches(text, AMBIGUOUS_MUSIC_TERMS),
  ];
  const matchedOffTopic = collectMatches(text, OFF_TOPIC_TERMS);

  /**
   * An artist's name is the one piece of music evidence no word list contains.
   * "JAŸ-Z Adds London Stadium Show To 30-Year Celebration Run" and "Lindsey
   * Buckingham shares surprising update about relationship with Stevie Nicks" are
   * music stories that score zero on vocabulary alone. The charts and the tour
   * data already know those names, so they are worth a strong term each.
   */
  const titleMentions = findArtistMentions(title, options.knownArtists);
  /**
   * Named in the headline *as the subject*, not merely named.
   *
   * "Tom Dreesen, Stand-Up Comedian Who Opened for Frank Sinatra, Dies at 86" names
   * a legacy artist correctly and is a comedian's obituary. A name behind "for",
   * "with", "featuring" or "to" is a mention: it stays evidence that the copy is
   * music-adjacent, but it cannot make the story a music story on its own.
   */
  const artistAsSubject = titleMentions.some(
    (mention) => !MENTION_PREPOSITIONS.has(mention.previousWord ?? ''),
  );
  const bodyMentions = titleMentions.length > 0
    ? titleMentions
    : findArtistMentions(text, options.knownArtists);
  const artistInText = titleMentions.length > 0 || bodyMentions.length > 0;

  if (artistInText) {
    matchedMusic.push('known-artist');
    // Named, so the next report says which entry admitted the row.
    const named = bodyMentions[0]?.name;
    if (named) matchedMusic.push(`artist:${named}`);
  }

  const anchorHits = collectMatches(text, ANCHOR_MUSIC_TERMS).length;
  const supportHits = collectMatches(text, SUPPORT_MUSIC_TERMS).length;
  const ambiguousHits = collectMatches(text, AMBIGUOUS_MUSIC_TERMS).length;
  const anchorScore = anchorHits * ANCHOR_WEIGHT + (artistAsSubject ? ANCHOR_WEIGHT : 0);
  const musicScore = anchorScore
    + supportHits * SUPPORT_WEIGHT
    + ambiguousHits * AMBIGUOUS_WEIGHT;
  const offTopicScore = matchedOffTopic.length * OFF_TOPIC_WEIGHT;

  // Feeds truncate the body, so the headline is often all the evidence there is.
  // A soft "music" in a headline is not enough on its own — that rule is what let
  // junk through originally — but an unmistakable term is: "Scratch DJ Kid Koala
  // ... Animated Feature Debut" is a music story even though "animated feature"
  // scores against it.
  const titleAnchorHits = collectMatches(title, ANCHOR_MUSIC_TERMS).length;
  const titleMusicScore = titleAnchorHits * ANCHOR_WEIGHT
    + collectMatches(title, SUPPORT_MUSIC_TERMS).length * SUPPORT_WEIGHT
    + collectMatches(title, AMBIGUOUS_MUSIC_TERMS).length * AMBIGUOUS_WEIGHT
    + (artistAsSubject ? ANCHOR_WEIGHT : 0);

  /**
   * Two weak sport words and no music subject in the headline is a match report
   * for a sport not yet named. Requiring both halves is what keeps a music story
   * that happens to say "tournament" or "squad" alive.
   *
   * "No music subject" is judged on the *vocabulary* only. This used to be
   * `titleMusicScore === 0`, which an artist name always defeated: "Mystics'
   * Shakira Austin is healthy at last and powering Washington's playoff push" was
   * never examined as sport, because a mononym collision had already supplied three
   * points of headline evidence.
   */
  const titleNamesMusic = HEADLINE_SUBJECT_TERMS.test(title);

  const sportContextBlocked = collectMatches(text, SPORT_CONTEXT_TERMS).length >= SPORT_CONTEXT_LIMIT
    && titleAnchorHits === 0
    && !titleNamesMusic;

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
  /**
   * An anchor has to be present somewhere — that is the whole point of the tier.
   * Where it sits decides how much it proves: an anchor in the headline is the
   * subject; a musical headline word plus one anchor in the body is an obituary
   * ("…the music legend's death" / "the late singer"); two anchors in the body are
   * a story that names its subject in the copy.
   *
   * Support and ambiguous words are not in this expression at all. They can raise
   * a score, they cannot make one.
   */
  // A headline that says "music" has named its subject outright; everything else
  // needs an anchor somewhere. An artist counts only as the *subject*: a name this
  // story merely mentions ("…Opened for Frank Sinatra, Dies at 86") is not one.
  const hasSubjectEvidence = titleNamesMusic || (anchorScore > 0
    && (titleAnchorHits > 0 || artistAsSubject || titleMusicScore >= SUPPORT_WEIGHT || anchorHits >= 2));

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
        // Either a real anchor, or the headline names music: "record" or
        // "release" alone is half a point and cannot open the door.
        && (anchorScore > 0 || titleNamesMusic)
        && ((musicScore >= RELEVANT_MUSIC_SCORE && musicScore >= offTopicScore)
          || (titleAnchorHits > 0 && musicScore > offTopicScore)
          || (titleNamesMusic && musicScore > offTopicScore));

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
  options: RelevanceOptions = {},
): boolean {
  return assessNewsRelevance(input, policy, options).relevant;
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

