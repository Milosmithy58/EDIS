import { LRUCache } from 'lru-cache';
import { StandardizedLocation } from '../../types/news';

const BASE_URL = 'https://nominatim.openstreetmap.org';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h
const cache = new LRUCache<string, any>({ max: 500, ttl: CACHE_TTL });

let lastRequestAt = 0;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rateLimit = async () => {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < 1000) {
    await delay(1000 - elapsed);
  }
  lastRequestAt = Date.now();
};

const headers = {
  'User-Agent': 'EDIS/1.0 (contact: ops@edis.local)',
  Accept: 'application/json'
};

type SearchInput = {
  query?: string;
  postal?: string;
  country?: string;
};

const toLocation = (payload: any): StandardizedLocation | null => {
  if (!payload) return null;
  const lat = Number(payload.lat);
  const lon = Number(payload.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  const address = payload.address ?? {};
  const adminLevels = [address.state, address.county, address.region, address.state_district]
    .concat([address.city, address.town, address.village, address.municipality])
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
  return {
    lat,
    lon,
    displayName: payload.display_name ?? `${lat},${lon}`,
    countryCode: typeof address.country_code === 'string' ? address.country_code.toUpperCase() : undefined,
    adminLevels: adminLevels.length > 0 ? adminLevels : undefined
  };
};

const runSearch = async (input: SearchInput): Promise<StandardizedLocation | null> => {
  const url = new URL(`${BASE_URL}/search`);
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    dedupe: '1'
  });
  if (input.query) {
    params.set('q', input.query);
  }
  if (input.postal) {
    params.set('postalcode', input.postal);
  }
  if (input.country) {
    params.set('countrycodes', input.country.toLowerCase());
  }
  url.search = params.toString();

  await rateLimit();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as any[];
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }
  return toLocation(payload[0]);
};

const runReverse = async (lat: number, lon: number): Promise<StandardizedLocation | null> => {
  const url = new URL(`${BASE_URL}/reverse`);
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    addressdetails: '1'
  }).toString();
  await rateLimit();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  return toLocation(payload);
};

export type GeocodeInput =
  | string
  | {
      lat: number;
      lon: number;
    }
  | {
      postal: string;
      country?: string;
    };

const isLatLonString = (value: string) => {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
};

export const geocode = async (input: GeocodeInput): Promise<StandardizedLocation | null> => {
  const cacheKey = JSON.stringify(input);
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) as StandardizedLocation | null ?? null;
  }

  let result: StandardizedLocation | null = null;
  try {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        cache.set(cacheKey, null);
        return null;
      }
      const direct = isLatLonString(trimmed);
      if (direct) {
        result = {
          lat: direct.lat,
          lon: direct.lon,
          displayName: `${direct.lat}, ${direct.lon}`
        };
      } else {
        result = await runSearch({ query: trimmed });
      }
    } else if ('lat' in input && 'lon' in input) {
      result = await runReverse(input.lat, input.lon);
    } else if ('postal' in input) {
      result = await runSearch({ postal: input.postal, country: input.country });
    }
  } catch (error) {
    console.warn('Geocoding failed', error);
    result = null;
  }

  cache.set(cacheKey, result ?? null);
  return result;
};
