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

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GNEWS_API_KEY: z.string().optional(),
  NEWSAPI_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  FBI_CRIME_API_KEY: z.string().optional(),
  DEFAULT_COUNTRY: z.string().default('UK'),
  ENABLE_OPENWEATHER: z.string().optional(),
  ENABLE_NEWSAPI: z.string().optional()
});

export const env = EnvSchema.parse(process.env);

export const flags = {
  openWeather: env.ENABLE_OPENWEATHER === 'true' && Boolean(env.OPENWEATHER_API_KEY),
  newsApi: env.ENABLE_NEWSAPI === 'true' && Boolean(env.NEWSAPI_API_KEY)
};
