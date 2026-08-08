export const NEWS_REGION_QUERIES = [
  { region: 'us', query: 'music tour' },
  {
    region: 'uk',
    query: '("UK music" OR "British music" OR "London music" OR "Manchester music" OR "Glasgow music" OR "UK concert" OR "UK festival")',
  },
  { region: 'latino', query: 'reggaeton OR shakira OR "bad bunny" OR "latin music"' },
  { region: 'asia', query: 'kpop music' },
  { region: 'europa', query: 'europe music' },
  { region: 'world', query: 'world hits' },
  { region: 'jazz', query: 'jazz music' },
  { region: 'classical', query: 'classical music' },
] as const;

export type NewsRegion = (typeof NEWS_REGION_QUERIES)[number]['region'];

export function normalizeNewsRegion(region: string): string {
  return region.trim().toLowerCase();
}
