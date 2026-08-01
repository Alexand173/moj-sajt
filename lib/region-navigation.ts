export const EUROPA_SUBREGIONS = [
  { name: 'GERMANY', slug: 'germany' },
  { name: 'FRANCE', slug: 'france' },
  { name: 'ITALY', slug: 'italy' },
  { name: 'POLAND', slug: 'poland' },
  { name: 'NORDIC', slug: 'nordic' },
  { name: 'BALTIC', slug: 'baltic' },
  { name: 'BALKAN', slug: 'balkan' },
  { name: 'OTHER', slug: 'other' },
] as const;

export type EuropaSubregionSlug = (typeof EUROPA_SUBREGIONS)[number]['slug'];

export function isEuropaSubregionSlug(value: string): value is EuropaSubregionSlug {
  return EUROPA_SUBREGIONS.some((subregion) => subregion.slug === value);
}
