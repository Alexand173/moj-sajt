export const NEWS_REGION_QUERIES = [
  { region: 'us', query: 'music tour' },
  {
    region: 'uk',
    query: '("UK music" OR "British music" OR "London music" OR "Manchester music" OR "Glasgow music" OR "UK concert" OR "UK festival" OR "British band" OR "UK tour")',
  },
  { region: 'latino', query: 'reggaeton OR shakira OR "bad bunny" OR "latin music" OR "música latina"' },
  // "kpop music" returned 63 results a month, most of them merchandise: the genre
  // tags people actually write were missing.
  { region: 'asia', query: '("K-pop" OR "J-pop" OR "C-pop" OR "Korean music" OR "K-pop group" OR "K-pop band")' },
  // "European tour" is how golf names its own circuit (European Tour → DP World
  // Tour), and a single day of that query returned nine LIV Golf stories for
  // `europa`: McIlroy, Race to Dubai, Abu Dhabi Championship. A band's European
  // tour is reached by naming the music instead, which is what this asks for.
  { region: 'europa', query: '("European music" OR eurovision OR "europe music" OR "European band" OR "European festival")' },
  // "world hits" pulled in film, books and golf. Name the genre instead.
  { region: 'world', query: '("world music" OR "global music" OR afrobeat OR "Afro-pop" OR "roots music")' },
  { region: 'jazz', query: 'jazz music' },
  { region: 'classical', query: 'classical music' },
] as const;

export type NewsRegion = (typeof NEWS_REGION_QUERIES)[number]['region'];

export function normalizeNewsRegion(region: string): string {
  return region.trim().toLowerCase();
}
