import { fetchJson, toQueryString } from '../../core/fetcher';
import { GeoContext } from '../../core/types';
import { normalizeGeo } from '../../core/normalize';

const BASE_URL = 'https://nominatim.openstreetmap.org';

type OsmAddress = {
  country?: string;
  country_code?: string;
  state?: string;
  county?: string;
  state_district?: string;
  region?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
};

type OsmBoundingBox = [string, string, string, string];

type OsmSearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  boundingbox?: OsmBoundingBox;
  address?: OsmAddress;
};

const buildGeoContext = (item: OsmSearchResult): GeoContext => {
  const address = item.address ?? {};
  return normalizeGeo({
    displayName: item.display_name,
    country: address.country ?? item.display_name,
    countryCode: (address.country_code ?? '').toUpperCase(),
    admin1: address.state || address.county,
    admin2: address.state_district || address.region,
    city: address.city || address.town || address.village || address.hamlet,
    lat: Number(item.lat),
    lon: Number(item.lon),
    bbox: item.boundingbox
      ? [Number(item.boundingbox[2]), Number(item.boundingbox[0]), Number(item.boundingbox[3]), Number(item.boundingbox[1])]
      : undefined
  });
};

type SearchOptions = {
  query: string;
  country?: string;
  scope?: string;
  limit?: number;
};

export const search = async ({ query, country, scope, limit = 5 }: SearchOptions) => {
  const params = toQueryString({
    q: query,
    format: 'jsonv2',
    addressdetails: 1,
    limit,
    countrycodes: country?.toLowerCase(),
    dedupe: 1
  });
  const results = await fetchJson<OsmSearchResult[]>(`${BASE_URL}/search?${params}`, {
    headers: {
      'User-Agent': 'EDIS/1.0 (https://example.com)',
      Accept: 'application/json'
    }
  });
  const matchesScope = (item: OsmSearchResult) => {
    const type = item.type ?? '';
    const address = item.address ?? {};

    if (!scope) return true;

    if (scope === 'country') {
      return type === 'country' || Boolean(address.country);
    }

    if (scope === 'admin') {
      const adminMatch = address.state || address.county || address.region || address.state_district;
      return ['state', 'county', 'administrative', 'region', 'province'].includes(type) || Boolean(adminMatch);
    }

    const cityLike = address.city || address.town || address.village || address.hamlet || address.municipality;
    return ['city', 'town', 'village', 'hamlet', 'municipality', 'administrative'].includes(type) || Boolean(cityLike);
  };

  return results.filter(matchesScope).map(buildGeoContext);
};

type ReverseOptions = {
  lat: number;
  lon: number;
};

export const reverse = async ({ lat, lon }: ReverseOptions) => {
  const params = toQueryString({
    lat,
    lon,
    format: 'jsonv2',
    addressdetails: 1
  });
  const payload = await fetchJson<OsmSearchResult | null>(`${BASE_URL}/reverse?${params}`, {
    headers: {
      'User-Agent': 'EDIS/1.0 (https://example.com)',
      Accept: 'application/json'
    }
  });
  if (!payload) return [];
  return [buildGeoContext(payload)];
};
