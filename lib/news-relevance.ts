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
  /** Set when the story matches a category that is never music news. */
  hardBlock: string | null;
  matchedMusic: string[];
  matchedOffTopic: string[];
};

/** Unambiguous music vocabulary: worth two points each. */
const STRONG_MUSIC_TERMS = new RegExp(
  [
    'albums?', 'singles?', 'eps?', 'mixtapes?', 'tours?', 'concerts?', 'gigs?', 'festivals?',
    'discography', 'setlists?', 'tracklists?', 'remix(?:es)?', 'vinyl', 'songwriters?', 'rappers?',
    'vocalists?', 'drummers?', 'guitarists?', 'bassists?', 'bands?', 'orchestras?', 'symphon(?:y|ies)',
    'opera', 'jazz', 'hip[ -]hop', 'k[ -]pop', 'reggaeton', 'afrobeats?', 'grime', 'house music',
    'billboard', 'grammys?', 'mtv', 'vmas?', 'mercury prize', 'spotify', 'soundcloud',
    'ballet', 'violin(?:ist)?s?', 'cellists?', 'pianists?', 'conductors?', 'philharmonic',
    'música', 'álbum', 'gira', 'conciertos?', 'cantantes?', 'banda', 'canción(?:es)?',
    'konzert(?:e|abonnement)?s?', 'konzerthaus', 'canzoni', 'morceaux', 'chansons?', 'musique',
    'opéra', 'orchestre', 'violon', 'filarmonica', 'concerto',
  ].join('|'),
  'gi',
);

/** Supporting vocabulary: worth one point each, never enough on its own. */
const SOFT_MUSIC_TERMS = new RegExp(
  [
    'music', 'musical', 'songs?', 'artists?', 'producers?', 'labels?', 'charts?', 'records?',
    'recordings?', 'release[sd]?', 'perform(?:ance|s|ed)?', 'stage', 'studio', 'mix(?:es)?',
    'beats?', 'lyrics', 'awards?', 'live', 'ensemble', 'quartet', 'trio',
  ].join('|'),
  'gi',
);

/** Things that make a story not-a-music-story. Two points each against it. */
const OFF_TOPIC_TERMS = new RegExp(
  [
    'video games?', 'gameplay', 'gaming', 'esports', 'box office', 'netflix', 'tv series',
    'season finale', 'episode \\d+', 'film', 'movies?', 'documentary', 'trailer', 'sitcom',
    'election', 'senator', 'congress', 'senate', 'prime minister', 'stock market', 'shares', 'earnings report',
    'ipo', 'crypto', 'bitcoin', 'smartphone', 'iphone', 'android', 'chatgpt', 'software', 'downloader',
    'changelog', 'github', 'plugin', 'browser extension',
    'fiscalía', 'gobierno', 'elecciones', 'votar', 'presidente', 'parlamento', 'justicia',
  ].join('|'),
  'gi',
);

/** Categories that are never music news, however many music words appear. */
const HARD_BLOCKS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(capcom|playstation|xbox|nintendo|gameplay|esports|dlc)\b/i, reason: 'video-game' },
  {
    pattern: /\b(downloader|changelog|release notes|command[- ]line|open[- ]source|github)\b/i,
    reason: 'software',
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
      hardBlock: 'empty',
      matchedMusic: [],
      matchedOffTopic: [],
    };
  }

  const matchedMusic = [
    ...collectMatches(text, STRONG_MUSIC_TERMS),
    ...collectMatches(text, SOFT_MUSIC_TERMS),
  ];
  const matchedOffTopic = collectMatches(text, OFF_TOPIC_TERMS);

  const strongHits = collectMatches(text, STRONG_MUSIC_TERMS).length;
  const softHits = collectMatches(text, SOFT_MUSIC_TERMS).length;
  const musicScore = strongHits * STRONG_MUSIC_WEIGHT + softHits * SOFT_MUSIC_WEIGHT;
  const offTopicScore = matchedOffTopic.length * OFF_TOPIC_WEIGHT;

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
      // while "film ... music" is a film story that mentions music, and the
      // off-topic terms are weighted to break it that way.
      : musicScore >= RELEVANT_MUSIC_SCORE && musicScore >= offTopicScore;

  return {
    relevant,
    musicScore,
    offTopicScore,
    hardBlock,
    matchedMusic: Array.from(new Set(matchedMusic)).slice(0, 8),
    matchedOffTopic: matchedOffTopic.slice(0, 8),
  };
}

/** Convenience for ingest paths that only need the verdict. */
export function isMusicNews(
  input: RelevanceInput,
  policy: RelevancePolicy = 'news-api',
): boolean {
  return assessNewsRelevance(input, policy).relevant;
}
