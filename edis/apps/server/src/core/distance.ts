export type Coordinates = {
  lat: number;
  lon: number;
};

/**
 * Calculates the great-circle distance between two coordinates using the Haversine formula.
 * Returns the distance in meters.
 */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
