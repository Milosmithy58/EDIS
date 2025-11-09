import { CrimeDTO, GeoContext, NewsDTO, WeatherDTO } from './types';

type PartialGeo = {
  displayName: string;
  country: string;
  countryCode: string;
  admin1?: string;
  admin2?: string;
  city?: string;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
};

export const normalizeGeo = (input: PartialGeo): GeoContext => ({
  query: input.displayName,
  country: input.country,
  countryCode: input.countryCode,
  admin1: input.admin1,
  admin2: input.admin2,
  city: input.city,
  lat: input.lat,
  lon: input.lon,
  bbox: input.bbox
});

export const normalizeWeather = (input: WeatherDTO): WeatherDTO => input;
export const normalizeCrime = (input: CrimeDTO): CrimeDTO => input;
export const normalizeNews = (input: NewsDTO): NewsDTO => input;
