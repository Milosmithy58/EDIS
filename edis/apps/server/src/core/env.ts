import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

const envCandidates = [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../.env')];

for (const envPath of envCandidates) {
  if (!existsSync(envPath)) {
    continue;
  }

  const envFile = readFileSync(envPath, 'utf-8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');

    if (!key) {
      continue;
    }

    const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');

    if (value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  break;
}

if (process.env.NODE_ENV === 'test') {
  process.env.ADMIN_TOKEN ??= 'test-admin-token';
  process.env.SECRETBOX_KEY ??= Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
  process.env.KEYS_STORE_PATH ??= './secrets/test-keys.enc';
  process.env.SCRAPE_SOURCES_PATH ??= './secrets/test-sources.enc';
  process.env.GEOCODER_PROVIDER ??= 'nominatim';
  process.env.WEBZIO_TOKEN ??= 'test-webzio-token';
}

export const EnvSchema = z
  .object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADMIN_TOKEN: z.string().min(12, 'ADMIN_TOKEN must be set and at least 12 characters long'),
  AUTH_JWT_SECRET: z.string().min(16, 'AUTH_JWT_SECRET must be set and at least 16 characters long'),
  SECRETBOX_KEY: z.string().min(1, 'SECRETBOX_KEY must be a base64-encoded 32-byte key'),
  KEYS_STORE_PATH: z.string().default('./secrets/keys.enc'),
  SCRAPE_SOURCES_PATH: z.string().default('./secrets/sources.enc'),
  GEOCODER_PROVIDER: z.enum(['nominatim']).default('nominatim'),
  GNEWS_API_KEY: z.string().optional(),
  NEWSAPI_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
  FBI_CRIME_API_KEY: z.string().optional(),
  LESSCRIME_DATASET_URL: z.string().url().optional(),
  ENABLE_OPENWEATHER: z.string().optional(),
  ENABLE_NEWSAPI: z.string().optional(),
  NEWS_PROVIDER: z.enum(['gnews', 'newsapi', 'webzio']).default('webzio'),
  WEATHER_PROVIDER: z.enum(['visualcrossing', 'openmeteo', 'openweather']).optional(),
  WEBZIO_TOKEN: z.string().optional(),
  VISUALCROSSING_API_KEY: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.NEWS_PROVIDER === 'webzio' && !value.WEBZIO_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEBZIO_TOKEN'],
        message: 'WEBZIO_TOKEN is required when NEWS_PROVIDER=webzio.'
      });
    }
  });

export const env = EnvSchema.parse(process.env);

export const flags = {
  openWeather: env.ENABLE_OPENWEATHER === 'true' && Boolean(env.OPENWEATHER_API_KEY),
  newsApi: env.ENABLE_NEWSAPI === 'true',
  weatherProvider: env.WEATHER_PROVIDER
};

export const newsProvider = env.NEWS_PROVIDER;
