/**
 * Ticketmaster sends two names for a music event: the event name, which usually
 * reads like `Artist: Tour Name`, and the first entry in `_embedded.attractions`,
 * which is the artist. The concert sync used to store the event name, so rows
 * ended up with `Metallica: Life Burns Faster` where the artist belongs.
 *
 * The attraction is authoritative. When an event has none — a candlelight series,
 * a festival bill — the event name is kept but stripped of a trailing tour
 * descriptor, and only when what remains still looks like a name.
 */

/** Separators that introduce a tour or edition after the artist name. */
const SUFFIX_SEPARATORS = /\s+(?:[—–|]|-)\s+|:\s+/;

const MIN_NAME_LENGTH = 2;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * `Metallica: Life Burns Faster` → `Metallica`, `Aitana` → `Aitana`.
 * Returns the original string when stripping would leave too little to be a name.
 */
export function cleanArtistName(value: string): string {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return '';

  const separator = SUFFIX_SEPARATORS.exec(trimmed);
  if (!separator || separator.index < MIN_NAME_LENGTH) return trimmed;

  const head = trimmed.slice(0, separator.index).trim();
  return head.length >= MIN_NAME_LENGTH ? head : trimmed;
}

export function pickArtistName(eventName: unknown, attractionName: unknown): string {
  const attraction = asTrimmedString(attractionName);
  if (attraction) return attraction;

  const cleaned = cleanArtistName(asTrimmedString(eventName));
  return cleaned || 'Unknown';
}
