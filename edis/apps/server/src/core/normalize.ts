import { CrimeDTO, GeoContext, NewsDTO, WeatherDTO } from './types';

export type NewsItem = {
  id: string;
  title: string;
  summary?: string;
  url: string;
  image?: string;
  published?: string;
  location?: { city?: string; state?: string; lat?: number; lon?: number };
  source: string;
  source_type: 'api' | 'rss' | 'scrape' | 'dataset';
  source_url?: string;
  categories?: string[];
  scraped_at: string;
  raw_exists: boolean;
};

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

export const createNewsItem = (
  input: Omit<NewsItem, 'id' | 'scraped_at' | 'raw_exists'> & Partial<Pick<NewsItem, 'id' | 'scraped_at' | 'raw_exists'>>
): NewsItem => ({
  ...input,
  id: input.id ?? '',
  scraped_at: input.scraped_at ?? new Date().toISOString(),
  raw_exists: input.raw_exists ?? false
});
