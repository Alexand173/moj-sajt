import type { ArtistNameIndex } from './news-artists';
import { isPublishableMusicNews, type RelevanceInput } from './news-relevance';
import { getPublisherTrust } from './news-sources';

/**
 * "Is this music news?" — the only version of the question the site asks.
 *
 * `lib/news-relevance` answers it from the words alone; this joins that answer to
 * who published the story. Both halves are needed, and neither belongs in the gate:
 * the wordlist has no publisher knowledge, and the publisher registry has no
 * vocabulary. Splitting them here means every reader — the region feed, the
 * article page, the brief API, related stories, the reviews page, the sitemap and
 * the AI worker — calls one function instead of re-deriving the policy, which is
 * how ingest and cleanup drifted apart in the first place.
 *
 * Pass the row's real `url`: it is what makes a curated music outlet's non-English
 * headline acceptable while holding a general newsroom to the subject test.
 */

export interface MusicStoryOptions {
  /** Names known from the chart and tour data, so an artist-only headline passes. */
  knownArtists?: ArtistNameIndex | null;
}

export function isMusicStory(
  input: RelevanceInput,
  options: MusicStoryOptions = {},
): boolean {
  return isPublishableMusicNews(input, {
    knownArtists: options.knownArtists ?? null,
    publisherTrust: getPublisherTrust(input.url),
  });
}
