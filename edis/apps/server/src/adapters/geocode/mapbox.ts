import { env } from '../../core/env';
import { fetchJson, toQueryString } from '../../core/fetcher';
import { GeoContext } from '../../core/types';
import { normalizeGeo } from '../../core/normalize';

const BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export const search = async (query: string, country?: string, limit = 5): Promise<GeoContext[]> => {
  if (!env.MAPBOX_TOKEN) {
    throw new Error('MAPBOX_TOKEN is required for Mapbox geocoding');
  }
  const params = toQueryString({
    access_token: env.MAPBOX_TOKEN,
    limit,
    country
  });
  const response = await fetchJson<any>(`${BASE_URL}/${encodeURIComponent(query)}.json?${params}`);
  return (response.features ?? []).map((feature: any) => {
    const context = feature.context || [];
    const countryCtx = context.find((c: any) => c.id.startsWith('country'));
    const regionCtx = context.find((c: any) => c.id.startsWith('region'));
    const placeCtx = context.find((c: any) => c.id.startsWith('place'));
    return normalizeGeo({
      displayName: feature.place_name,
      country: countryCtx?.text ?? feature.place_name,
      countryCode: (countryCtx?.short_code ?? '').toUpperCase(),
      admin1: regionCtx?.text,
      admin2: placeCtx?.text,
      city: feature.text,
      lat: feature.center[1],
      lon: feature.center[0],
      bbox: feature.bbox
        ? [feature.bbox[1], feature.bbox[0], feature.bbox[3], feature.bbox[2]]
        : undefined
    });
  });
};
