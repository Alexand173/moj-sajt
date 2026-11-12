import type { SupabaseClient } from '@supabase/supabase-js';
import roster from '@/lib/news-artist-roster.json';
import { LEGACY_ARTIST_NAMES } from '@/lib/news-artist-legacy';

/**
 * Recognising an artist in a headline.
 *
 * The vocabulary gate has one blind spot that matters more than any other: an
 * artist's name is not a music word. "JAŸ-Z Adds London Stadium Show To 30-Year
 * Celebration Run" scores nothing — no "tour", no "album" — and neither does
 * "Lindsey Buckingham shares surprising update about relationship with Stevie
 * Nicks". Both are music stories; a keyword list will never say so.
 *
 * The site already knows thousands of artist names: they are in the charts
 * (`songs`) and in the tour data (`koncerts`). Using that as evidence is more
 * accurate than any list written by hand, and it grows as the charts do.
 *
 * Matching is on token boundaries, never substrings — "Queen" must not match
 * "Queensland". Multi-word names are safe to match; a single word has to be at
 * least six characters, because one short common word ("Salt", "Air") would turn
 * ordinary copy into a music story.
 */

export interface ArtistNameIndex {
  /** Normalised full names, space-separated tokens. */
  names: Set<string>;
  /** Distinct first tokens, so a title can be checked without scanning every name. */
  firstTokens: Set<string>;
}

const MIN_SINGLE_WORD_ARTIST_LENGTH = 6;
/** Bounded by `MAX_INDEXED_TOKENS`: anything longer is a release title, not a name. */
const MAX_NAME_TOKENS = 4;

/**
 * What a name may look like, checked before anything is indexed.
 *
 * The roster was 1,786 entries and 331 of them were not artists. Two sources fed
 * it: `koncerti.artist_name`, which sometimes holds the whole event title
 * ("2026 8TURN 2nd World Tour in Mexico", "Eagles - Suite Reservation"), and the
 * headline harvest in `scripts/build-artist-roster`, which takes 2–3 capitalised
 * words from accepted stories and rejects a stoplist that names `announces` but not
 * `breaks`. So "Breaks Silence" and "Fires Back" were indexed as people, and these
 * two rows came back from the held sample as music:
 *
 *   "Brittany Mahomes breaks silence on the dark moments she faces"
 *   "PSG Winger Fires Back at Journalist Over Entourage Criticism"
 *
 * This check lives in the *index builder*, not in the roster script, because the
 * file is only one of the two ways a name arrives: the chart and tour tables are
 * read at every ingest, so a badly written concert row would reintroduce the same
 * junk tomorrow.
 */
const MAX_INDEXED_LENGTH = 48;

/** 4 covers "Bring Me the Horizon" and "Earth Wind and Fire"; 5+ is a title. */
const MAX_INDEXED_TOKENS = 4;

/**
 * Vocabulary of a concert listing rather than of an act's name. Phrase-anchored
 * where the bare word is plausible in a name: "Tour" alone is not a filter, but
 * "world tour" and "in concert" are.
 */
const EVENT_LISTING_PATTERN = /\b(?:world tour|tour dates?|in concert|live at|tickets?|tribute|presents|featuring|residency|fan meetings?|suite reservation|anniversary|weekender|super bowl|halftime show|world cup|olympic games|festival|award show|music awards?)\b/;

/**
 * Titles that recur across headlines often enough to look like a name.
 *
 * The harvest requires a phrase in three different stories, which a film franchise
 * clears easily — "KPop Demon Hunters" is in three headlines a week while it is in
 * cinemas. It is a title, not an act: indexing it let "1 Year Later, Rumi's Best
 * Line Is Still KPop Demon Hunters' Greatest Quote" pass as a music story.
 */
const NON_ARTIST_TITLES: Set<string> = new Set([
  'kpop demon hunters',
  'kpop demon hunter',
  'kpop demon',
]);

/**
 * Words that make a capitalised run a sentence fragment. A title-case headline
 * capitalises its verb, which is how "Breaks Silence" became a name — the roster
 * script's stoplist already covered `announces`, `reveals` and `shares`.
 */
const FRAGMENT_VERBS: Set<string> = new Set([
  'breaks', 'break', 'fires', 'fire', 'brings', 'announce', 'announces', 'announced',
  'get', 'gets', 'got', 'make', 'makes', 'made', 'wins', 'win', 'takes', 'take',
  'hits', 'hit', 'says', 'say', 'said', 'shares', 'share', 'reveals', 'reveal',
  'drops', 'drop', 'adds', 'add', 'confirms', 'confirm', 'slams', 'slam',
  'defends', 'defend', 'admits', 'admit', 'explains', 'explain', 'teases', 'tease',
  'faces', 'face', 'addresses', 'address', 'celebrates', 'celebrate', 'remembers',
  'remember', 'joins', 'join', 'leaves', 'leave', 'returns', 'return', 'revealed',
  'announcing', 'dropping', 'sharing', 'taking', 'winning', 'featuring',
]);

/**
 * Real names that look like fragments, and are the reason the verb list above is
 * not absolute. Normalised, so they are compared the same way as any other entry.
 */
const PHRASE_NAME_ALLOWLIST: Set<string> = new Set([
  'take that',
  'bring me the horizon',
  'earth wind and fire',
  'folds five',
  'the the',
]);

/**
 * Verbs a headline uses after a name in title case. Used only by the one-token
 * rule: "NewJeans Announces Tour" is the artist acting, while "Shakira Austin" is
 * two words of somebody else's name.
 */
const HEADLINE_CONTINUATION_VERBS: Set<string> = new Set([
  'announces', 'announced', 'reveals', 'revealed', 'shares', 'shared', 'drops',
  'dropped', 'adds', 'added', 'confirms', 'confirmed', 'teases', 'teased', 'wins',
  'won', 'slams', 'slammed', 'defends', 'defended', 'admits', 'admitted', 'explains',
  'explained', 'faces', 'faced', 'addresses', 'addressed', 'celebrates', 'celebrated',
  'remembers', 'remembered', 'joins', 'joined', 'leaves', 'left', 'returns',
  'returned', 'brings', 'brought', 'takes', 'took', 'hits', 'hit', 'says', 'said',
  'is', 'was', 'will', 'makes', 'made', 'gets', 'got', 'goes', 'went', 'plays',
  'played', 'performs', 'performed', 'tours', 'touring', 'releases', 'released',
  'cancels', 'cancelled', 'postpones', 'reschedules', 'extends', 'opens', 'closes',
]);

/**
 * Is this a name at all?
 *
 * Exported so the roster builder applies the identical rule to the file it writes,
 * which is what keeps the committed artefact and the runtime index from drifting.
 */
export function isIndexableArtistName(raw: string | null | undefined): boolean {
  const normalized = normalizeArtistText(raw);
  if (!normalized) return false;
  if (PHRASE_NAME_ALLOWLIST.has(normalized)) return true;
  if (NON_ARTIST_TITLES.has(normalized)) return false;

  // A digit is a date, a chart position or a release number, never a name.
  if (/\d/.test(normalized)) return false;
  if (normalized.length > MAX_INDEXED_LENGTH) return false;

  const tokens = normalized.split(' ');
  if (tokens.length > MAX_INDEXED_TOKENS) return false;
  if (EVENT_LISTING_PATTERN.test(normalized)) return false;

  return !tokens.some((token) => FRAGMENT_VERBS.has(token));
}

/**
 * One-word names that are allowed to match on their own.
 *
 * The roster is built from the chart and the tour feed, and those tables contain
 * plenty of one-word names that are ordinary English: the cleanup report held
 * "Yathindra leads voter roll revision drive in Mysuru" and "Gang of robbers
 * posing as trans persons busted" with `known-artist` as the only evidence, which
 * means a chart row named `Busted`, `Gang` or similar was matching the copy.
 *
 * A one-word match is now only taken from the hand-picked legacy list, where each
 * name was chosen because finding it in a headline really does mean the story is
 * about that artist. Multi-word names are unaffected: "Taylor Swift" is not a
 * phrase that turns up in a voter-roll report.
 */
const CURATED_SINGLE_TOKENS: Set<string> = new Set(
  LEGACY_ARTIST_NAMES
    .map((name) => normalizeArtistText(name))
    .filter((normalized) => normalized.length > 0 && !normalized.includes(' ')),
);

/**
 * The committed roster, generated by `npm run news:roster` from the chart, the
 * tour feed and the names that recur across headlines the gate already accepts.
 * See `scripts/build-artist-roster.ts` for how a name earns its place.
 */
const ROSTER = (roster as { names?: unknown }).names;
/**
 * The committed roster plus the legacy seeds, which the chart and the tour feed
 * can never supply: an archive piece about Louis Armstrong is music news even
 * though nothing about him is currently on sale. See `news-artist-legacy`.
 */
const ROSTER_NAMES: string[] = [
  ...LEGACY_ARTIST_NAMES,
  ...(Array.isArray(ROSTER)
    ? ROSTER.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    : []),
];

/** Lowercase, accent-free, punctuation-free tokens. "JAŸ-Z" -> "jay z". */
export function normalizeArtistText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildArtistNameIndex(names: Iterable<string | null | undefined>): ArtistNameIndex {
  const indexed = new Set<string>();
  const firstTokens = new Set<string>();

  for (const raw of names) {
    // Shape first: a concert listing or a headline fragment is not a person,
    // whatever table it came from.
    if (!isIndexableArtistName(raw)) continue;

    const normalized = normalizeArtistText(raw);
    if (!normalized) continue;

    const tokens = normalized.split(' ');
    if (tokens.length > MAX_NAME_TOKENS) continue;
    if (tokens.length === 1) {
      // One word has to be curated, and long enough not to be a common noun.
      if (!CURATED_SINGLE_TOKENS.has(tokens[0])) continue;
      if (tokens[0].length < MIN_SINGLE_WORD_ARTIST_LENGTH) continue;
    }

    indexed.add(normalized);
    firstTokens.add(tokens[0]);
  }

  return { names: indexed, firstTokens };
}

export interface ArtistMention {
  /** The name as the index holds it, normalised. */
  name: string;
  /** The word immediately before it, lowercased, or null when it leads the text. */
  previousWord: string | null;
  /** True when the match is a single curated token rather than a full name. */
  singleToken: boolean;
}

type FlatToken = { token: string; raw: string };

/**
 * Normalised tokens paired with the raw word they came from.
 *
 * The raw word is kept because the one-token rule needs capitalisation, which
 * `normalizeArtistText` throws away. One raw word can yield several normalised
 * tokens — "R&B" gives "r b" — so the mapping is per token, not per word.
 */
function flattenTokens(text: string): FlatToken[] {
  const flat: FlatToken[] = [];

  for (const raw of text.match(/[^\s]+/g) ?? []) {
    for (const token of normalizeArtistText(raw).split(' ')) {
      if (token) flat.push({ token, raw });
    }
  }

  return flat;
}

function isCapitalised(raw: string): boolean {
  const letter = raw.match(/\p{L}/u)?.[0];
  if (!letter) return false;

  return letter === letter.toUpperCase() && letter !== letter.toLowerCase();
}

/**
 * Is this word the second half of a person's name, rather than the next word of a
 * sentence?
 *
 * A one-word artist is a mononym — `Shakira`, `Cazzu`, `NewJeans` — and a mononym
 * has exactly the shape an athlete's first name has. "Mystics' Shakira Austin is
 * healthy at last and powering Washington's playoff push" matched `shakira` and
 * became a music story; "Shakira enflamme la plage de Copacabana" is the artist,
 * because the word after it is lowercase.
 *
 * Capitalisation alone is not enough, because a title-case headline capitalises
 * every word: "NewJeans Announces Tour" must still match. So the next word is also
 * checked against the verbs a headline uses after its subject.
 */
function continuesLongerName(flat: FlatToken[], position: number): boolean {
  const current = flat[position];

  for (let index = position + 1; index < flat.length; index += 1) {
    // A token that shares its raw word with the previous one is the rest of that
    // same word, not the next word.
    if (flat[index].raw === current.raw) continue;
    if (!isCapitalised(flat[index].raw)) return false;

    return !HEADLINE_CONTINUATION_VERBS.has(flat[index].token);
  }

  return false;
}

/**
 * Every known artist this text names, with enough context to tell a subject from a
 * mention.
 *
 * `previousWord` exists for the other half of the problem: "Tom Dreesen, Stand-Up
 * Comedian Who Opened for Frank Sinatra, Dies at 86" names a legacy artist
 * correctly, and is a comedian's obituary. The name is evidence; a name after
 * "for", "with" or "featuring" is not the subject.
 */
export function findArtistMentions(
  text: string | null | undefined,
  index: ArtistNameIndex | null | undefined,
): ArtistMention[] {
  if (!text || !index || index.names.size === 0) return [];

  const flat = flattenTokens(text);
  if (flat.length === 0) return [];

  const mentions: ArtistMention[] = [];

  for (let start = 0; start < flat.length; start += 1) {
    if (!index.firstTokens.has(flat[start].token)) continue;

    for (let length = 1; length <= MAX_NAME_TOKENS && start + length <= flat.length; length += 1) {
      const name = flat.slice(start, start + length).map((entry) => entry.token).join(' ');
      if (!index.names.has(name)) continue;

      // A one-word name that opens a fuller name belongs to somebody else. Keep
      // scanning longer phrases from the same position, because the fuller name
      // may itself be an artist.
      if (length === 1 && continuesLongerName(flat, start)) continue;

      mentions.push({
        name,
        previousWord: start > 0 ? flat[start - 1].token : null,
        singleToken: length === 1,
      });

      // The longest phrase at a position wins: "Stevie Nicks" is not also "Nicks".
      break;
    }

    if (mentions.length >= 24) break;
  }

  return mentions;
}

/** Does this headline name an artist the site already knows? */
export function titleMentionsKnownArtist(
  title: string | null | undefined,
  index: ArtistNameIndex | null | undefined,
): boolean {
  return findArtistMentions(title, index).length > 0;
}

/**
 * Loads the names once per run.
 *
 * Two sources, and the order matters. The committed roster is always available —
 * it is a file, so it works even when the database is slow, and it makes the
 * purge reproducible: the same run judges the same rows the same way next week.
 * The live tables are then merged on top, so an artist who entered the chart this
 * morning is recognised this afternoon without waiting for a roster rebuild.
 *
 * Errors return whatever was loaded rather than throwing: losing artist
 * recognition should make the gate stricter, never crash an ingest run.
 */
export async function loadKnownArtistNames(supabase: SupabaseClient | null): Promise<string[]> {
  const names = new Set<string>(ROSTER_NAMES);

  if (!supabase) return Array.from(names);

  try {
    const { data: songs } = await supabase.from('songs').select('artist_name').limit(20_000);
    for (const row of (songs || []) as Array<{ artist_name: string | null }>) {
      if (row.artist_name?.trim()) names.add(row.artist_name.trim());
    }
  } catch (error) {
    console.warn('Could not load chart artists for the news gate:', error);
  }

  try {
    const { data: concerts } = await supabase.from('koncerti').select('artist_name').limit(20_000);
    for (const row of (concerts || []) as Array<{ artist_name: string | null }>) {
      if (row.artist_name?.trim()) names.add(row.artist_name.trim());
    }
  } catch (error) {
    console.warn('Could not load tour artists for the news gate:', error);
  }

  return Array.from(names);
}
