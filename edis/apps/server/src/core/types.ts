export type GeoContext = {
  query: string;
  country: string;
  countryCode: string;
  admin1?: string;
  admin2?: string;
  city?: string;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
};

export type WeatherDTO = {
  current: {
    tempC: number;
    windKph: number;
    conditions: string;
    icon?: string;
  };
  hourly: Array<{
    timeISO: string;
    tempC: number;
    precipMm: number;
    windKph: number;
  }>;
  daily: Array<{
    dateISO: string;
    maxC: number;
    minC: number;
    precipMm: number;
    summary: string;
  }>;
  meta?: {
    source: string;
    sourceLabel?: string;
    url?: string;
    updatedISO?: string;
  };
};

export type CrimeDTO = {
  period: string;
  totalsByCategory: Array<{
    category: string;
    count: number;
  }>;
  total: number;
  source: string;
  url?: string;
};

export type NewsDTO = {
  items: Array<{
    title: string;
    url: string;
    source: string;
    publishedAtISO: string;
    imageUrl?: string;
  }>;
  total: number;
  source: string;
};

export type ErrorDTO = {
  message: string;
  status: number;
  retryable?: boolean;
};
