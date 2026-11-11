import type { SupabaseClient } from '@supabase/supabase-js';

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
const MAX_NAME_TOKENS = 6;

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
    const normalized = normalizeArtistText(raw);
    if (!normalized) continue;

    const tokens = normalized.split(' ');
    if (tokens.length > MAX_NAME_TOKENS) continue;
    if (tokens.length === 1 && tokens[0].length < MIN_SINGLE_WORD_ARTIST_LENGTH) continue;

    indexed.add(normalized);
    firstTokens.add(tokens[0]);
  }

  return { names: indexed, firstTokens };
}

/** Does this headline name an artist the site already knows? */
export function titleMentionsKnownArtist(
  title: string | null | undefined,
  index: ArtistNameIndex | null | undefined,
): boolean {
  if (!index || index.names.size === 0) return false;

  const tokens = normalizeArtistText(title).split(' ').filter(Boolean);
  if (tokens.length === 0) return false;

  for (let start = 0; start < tokens.length; start += 1) {
    if (!index.firstTokens.has(tokens[start])) continue;

    for (let length = 1; length <= MAX_NAME_TOKENS && start + length <= tokens.length; length += 1) {
      if (index.names.has(tokens.slice(start, start + length).join(' '))) return true;
    }
  }

  return false;
}

/**
 * Loads the names once per run.
 *
 * Errors return an empty index rather than throwing: losing artist recognition
 * should make the gate stricter, never crash an ingest run.
 */
export async function loadKnownArtistNames(supabase: SupabaseClient | null): Promise<string[]> {
  if (!supabase) return [];

  const names = new Set<string>();

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
