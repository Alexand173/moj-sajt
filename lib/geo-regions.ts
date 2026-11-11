/**
 * Country → ticket region, on its own so the city gazetteer builder can read it
 * without loading the request-time IP database.
 *
 * Regions are the same keys the `/tickets/<region>` routes use.
 */

/**
 * Countries grouped by the region keys the ticket pages use. Exported so the
 * city geocoder can prefer a candidate on the right continent: `Milano` must not
 * resolve to Milano, Texas.
 */
export const REGION_COUNTRIES: Record<string, readonly string[]> = {
  us: ['US', 'CA'],
  uk: ['GB', 'IE'],
  latino: ['MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'DO', 'PR', 'CR', 'PA', 'UY', 'PY', 'BO', 'ES', 'PT'],
  europa: [
    'DE', 'FR', 'IT', 'PL', 'SE', 'NO', 'DK', 'FI', 'IS', 'EE', 'LV', 'LT', 'RS', 'BA', 'BG', 'RO',
    'GR', 'AL', 'HR', 'MK', 'ME', 'XK', 'SI', 'AT', 'BE', 'CH', 'CY', 'CZ', 'HU', 'LU', 'MT', 'NL', 'SK',
  ],
  asia: ['JP', 'KR', 'CN', 'IN', 'TW', 'TH', 'PH', 'ID', 'VN', 'SG', 'MY', 'HK'],
};

const COUNTRY_TO_REGION = new Map<string, string>(
  Object.entries(REGION_COUNTRIES).flatMap(([region, codes]) => codes.map((code) => [code, region] as const)),
);

/**
 * A country the ticket regions do not cover falls to `world`: the visitor still
 * gets a city, but the region pages have no dedicated channel for it.
 */
export function getRegionKeyForCountry(countryCode: string | null): string {
  if (!countryCode) return 'world';
  return COUNTRY_TO_REGION.get(countryCode.trim().toUpperCase()) ?? 'world';
}
