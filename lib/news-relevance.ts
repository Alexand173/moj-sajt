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
  'fiscalía', 'gobierno', 'elecciones', 'votar', 'presidente', 'parlamento', 'justicia',
  // A books column reached the reviews page as "October's Best Reviewed Fiction".
  'fiction', 'novels?', 'book reviews?',
]);

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
    pattern: /\b(capcom|gameplay|esports|dlc|call of duty|game review|game thread|battle royale|patch notes)\b/i,
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
    pattern: /(?:\.\s+and,\s)|\b(?:up first|morning brief(?:ing)?|evening brief(?:ing)?|daily brief(?:ing)?|top stories|news round-?up)\b/i,
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
export function assessNewsRelevance(
  input: RelevanceInput,
  policy: RelevancePolicy = 'news-api',
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

  const strongHits = collectMatches(text, STRONG_MUSIC_TERMS).length;
  const softHits = collectMatches(text, SOFT_MUSIC_TERMS).length;
  const musicScore = strongHits * STRONG_MUSIC_WEIGHT + softHits * SOFT_MUSIC_WEIGHT;
  const offTopicScore = matchedOffTopic.length * OFF_TOPIC_WEIGHT;

  // Feeds truncate the body, so the headline is often all the evidence there is.
  // A soft "music" in a headline is not enough on its own — that rule is what let
  // junk through originally — but an unmistakable term is: "Scratch DJ Kid Koala
  // ... Animated Feature Debut" is a music story even though "animated feature"
  // scores against it.
  const titleStrongHits = collectMatches(title, STRONG_MUSIC_TERMS).length;
  const titleMusicScore = titleStrongHits * STRONG_MUSIC_WEIGHT
    + collectMatches(title, SOFT_MUSIC_TERMS).length * SOFT_MUSIC_WEIGHT;

  const hardBlock = HARD_BLOCKS.find((block) => block.pattern.test(text))?.reason
    // "qobuz-dl-ultra 2.4.3.1" reads as a changelog entry, not a headline: a
    // version number only blocks when software vocabulary sits next to it.
    ?? (VERSION_NUMBER.test(text) && SOFTWARE_WORD.test(text) ? 'software-release' : null);

  const relevant = hardBlock
    ? false
    : policy === 'music-publication'
      // A curated music outlet does not need to prove its subject in English. It
      // is only overruled when it is plainly reporting something else.
      ? !(musicScore === 0 && offTopicScore >= TRUSTED_SOURCE_REJECT_SCORE)
      // A tie is allowed: "album ... film" is a music story that mentions a film,
      // while "film ... music" is a film story that mentions music. An
      // unmistakable music term in the headline is enough on its own, because
      // feeds truncate the body and an obituary or a DJ profile rarely says
      // "music" twice.
      : (musicScore >= RELEVANT_MUSIC_SCORE && musicScore >= offTopicScore) ||
        (titleStrongHits > 0 && musicScore > offTopicScore);

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
