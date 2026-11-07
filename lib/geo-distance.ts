/**
 * Great-circle distance between two points on the Earth.
 *
 * The rail ranks concerts by how far they are from the visitor "as the crow
 * flies", which is the only measure available without routing data. It is a
 * lower bound on travel: 250 km of air is never four hours by road, but it is
 * always the right order between two cities on the same continent.
 */

export type Coordinate = {
  latitude: number;
  longitude: number;
};

/** Mean Earth radius (IUGG), kilometres. */
const EARTH_RADIUS_KM = 6371;

export function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false;

  const { latitude, longitude } = value as Partial<Coordinate>;
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Math.abs(latitude as number) <= 90
    && Math.abs(longitude as number) <= 180;
}

/**
 * Accepts the strings geo providers send and rejects anything off the globe,
 * so a malformed header cannot place the visitor at latitude 400.
 */
export function parseCoordinate(latitude: unknown, longitude: unknown): Coordinate | null {
  // A blank header must not read as zero: `Number('')` is 0, which would put the
  // visitor in the Gulf of Guinea and every distance would be nonsense.
  if (typeof latitude === 'string' && !latitude.trim()) return null;
  if (typeof longitude === 'string' && !longitude.trim()) return null;

  const lat = typeof latitude === 'string' ? Number(latitude.trim()) : latitude;
  const lon = typeof longitude === 'string' ? Number(longitude.trim()) : longitude;

  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const coordinate = { latitude: lat, longitude: lon };
  return isCoordinate(coordinate) ? coordinate : null;
}

/** Kilometres between two coordinates; 0 for the same point. */
export function haversineKm(from: Coordinate, to: Coordinate): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
