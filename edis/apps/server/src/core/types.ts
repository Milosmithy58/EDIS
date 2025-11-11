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
  total?: number;
  source: string;
  next?: string;
  notice?: string;
  cached?: boolean;
};

export type ErrorDTO = {
  code?: string;
  message: string;
  source?: string;
  status: number;
  retryable?: boolean;
};

export type TicketDTO = {
  id: string;
  source: {
    id: string;
    name: string;
    url: string;
  };
  title: string;
  description?: string;
  category: 'Transport' | 'Utilities' | 'Council' | 'Police' | 'Health' | 'Weather' | 'Other';
  severity?: 'info' | 'minor' | 'moderate' | 'major' | 'critical';
  status?: 'open' | 'ongoing' | 'resolved' | 'planned';
  startedAt?: string;
  updatedAt?: string;
  location?: { name?: string; lat?: number; lon?: number };
  areaTags?: string[];
  url: string;
};

export type FemaDisasterDTO = {
  disasterNumber: number;
  declarationType: 'DR' | 'EM' | 'FM' | string;
  state: string;
  county: string | null;
  title: string | null;
  incidentBeginDate: string | null;
  incidentEndDate: string | null;
  declarationDate: string | null;
  placeCodes?: string[];
};
