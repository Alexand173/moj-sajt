import { getTicketRegionLabel } from '@/lib/region-navigation';

/**
 * Article-aware region names for page headings. The navigation labels are
 * uppercase (`US`, `EUROPA`), which reads badly as a sentence, so headings such as
 * "Concert tickets in the US" get their own names.
 */
const HEADLINE_REGIONS: Record<string, string> = {
  us: 'the US',
  uk: 'the UK',
  europa: 'Europe',
  latino: 'Latin America',
  asia: 'Asia',
};

export function getTicketRegionHeadline(region: string): string {
  return HEADLINE_REGIONS[region.trim().toLowerCase()] ?? getTicketRegionLabel(region);
}

/**
 * Intro sentence for a region ticket page. It names the first two artists that
 * actually appear on the page, so the paragraph carries the search terms for the
 * region without inventing names when the feed is thin.
 */
export function getTicketIntroCopy(artists: string[], regionName: string): string {
  const regionLabel = getTicketRegionLabel(regionName);
  const uniqueArtists = Array.from(new Set(artists.map((artist) => artist?.trim()).filter(Boolean))) as string[];
  const [first, second] = uniqueArtists;

  if (first && second) {
    return `Official tour dates for ${first}, ${second} and every other artist playing ${regionLabel} right now. Each listing links straight to the promoter or Ticketmaster, with every date checked against the published schedule.`;
  }

  if (first) {
    return `Official tour dates for ${first} and the rest of the ${regionLabel} schedule — each show linking straight to the promoter or Ticketmaster.`;
  }

  return `Official concert dates for artists playing ${regionLabel}. Each show links straight to the promoter or Ticketmaster.`;
}
