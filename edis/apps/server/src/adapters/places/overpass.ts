import { haversineMeters, Coordinates } from '../../core/distance';

const NOMINATIM =
  process.env.OSM_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search';
const OVERPASS =
  process.env.OSM_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const DEFAULT_RADIUS_KM = Number(process.env.PLACES_SEARCH_RADIUS_KM ?? 50);

export type PlaceCategory = 'airport' | 'hospital' | 'police';

export type NearbyPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  address?: string;
  distance_m: number;
};

export type NearbyPlacesResponse = {
  origin: Coordinates;
  results: Record<PlaceCategory, NearbyPlace[]>;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassPayload = {
  elements?: OverpassElement[];
};

export async function geocodeAddress(address: string): Promise<Coordinates> {
  const query = new URLSearchParams({
    format: 'json',
    limit: '1',
    q: address
  });

  const response = await fetch(`${NOMINATIM}?${query.toString()}`, {
    headers: {
      'User-Agent': 'EDIS/places'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to geocode address (${response.status})`);
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Address not found');
  }

  const [first] = data;
  return { lat: Number(first.lat), lon: Number(first.lon) };
}

function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  return `
[out:json][timeout:25];
(
  node["aeroway"="aerodrome"](around:${radiusMeters},${lat},${lon});
  node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  node["amenity"="police"](around:${radiusMeters},${lat},${lon});
);
out center tags;`.trim();
}

function resolveCategory(tags: Record<string, string> = {}): PlaceCategory | null {
  if (tags.aeroway === 'aerodrome') {
    return 'airport';
  }

  if (tags.amenity === 'hospital') {
    return 'hospital';
  }

  if (tags.amenity === 'police') {
    return 'police';
  }

  return null;
}

function formatAddress(tags: Record<string, string> = {}): string | undefined {
  const segments = [
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:country']
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  if (segments.length === 0) {
    return undefined;
  }

  return segments.join(', ');
}

function normalizePlaces(
  origin: Coordinates,
  elements: OverpassElement[]
): NearbyPlacesResponse['results'] {
  const grouped: Record<PlaceCategory, NearbyPlace[]> = {
    airport: [],
    hospital: [],
    police: []
  };

  for (const element of elements) {
    const tags = element.tags ?? {};
    const category = resolveCategory(tags);
    if (!category) {
      continue;
    }

    const coordinates = element.center ?? { lat: element.lat, lon: element.lon };
    if (!coordinates?.lat || !coordinates?.lon) {
      continue;
    }

    const lat = Number(coordinates.lat);
    const lon = Number(coordinates.lon);

    const place: NearbyPlace = {
      id: `${element.type}/${element.id}`,
      name: tags.name?.trim() ||
        (category === 'airport' ? 'Airport' : category === 'hospital' ? 'Hospital' : 'Police Station'),
      category,
      lat,
      lon,
      address: formatAddress(tags),
      distance_m: haversineMeters(origin, { lat, lon })
    };

    grouped[category].push(place);
  }

  for (const category of Object.keys(grouped) as PlaceCategory[]) {
    grouped[category]
      .sort((a, b) => a.distance_m - b.distance_m)
      .splice(3);
  }

  return grouped;
}

export async function findNearbyPlaces(
  address: string,
  radiusKm: number = DEFAULT_RADIUS_KM
): Promise<NearbyPlacesResponse> {
  if (!address.trim()) {
    throw new Error('Address is required');
  }

  const origin = await geocodeAddress(address.trim());
  const normalizedRadiusKm = radiusKm > 0 ? radiusKm : DEFAULT_RADIUS_KM;
  const radiusMeters = normalizedRadiusKm * 1000;
  const query = buildOverpassQuery(origin.lat, origin.lon, radiusMeters);

  const response = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    throw new Error(`Failed to query Overpass (${response.status})`);
  }

  const payload = (await response.json()) as OverpassPayload;
  const elements = Array.isArray(payload.elements) ? payload.elements : [];

  return {
    origin,
    results: normalizePlaces(origin, elements)
  };
}
