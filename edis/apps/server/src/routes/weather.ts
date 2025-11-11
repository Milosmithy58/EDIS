import { Router } from 'express';
import etag from 'etag';
import { LRUCache } from 'lru-cache';
import { env, flags } from '../core/env';
import { GeoContext, WeatherDTO } from '../core/types';
import { getKey } from '../core/secrets/secureStore';
import { getWeatherOM } from '../adapters/weather/openmeteo';
import * as openWeather from '../adapters/weather/openweather';
import { getWeatherVC, VisualCrossingUnits } from '../adapters/weather/visualcrossing';

const cache = new LRUCache<string, WeatherDTO>({ max: 200, ttl: 1000 * 60 * 5 });

const router = Router();

const allowedUnits: VisualCrossingUnits[] = ['metric', 'us', 'uk'];

const SOURCE_LABELS: Record<string, string> = {
  visualcrossing: 'Visual Crossing',
  openmeteo: 'Open-Meteo',
  openweather: 'OpenWeather'
};

const normalizeUnits = (unitsQuery?: string, countryCodeOrName?: string): VisualCrossingUnits => {
  if (unitsQuery && allowedUnits.includes(unitsQuery as VisualCrossingUnits)) {
    return unitsQuery as VisualCrossingUnits;
  }

  const countryValue = (countryCodeOrName ?? '').toUpperCase();

  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(countryValue)) {
    return 'us';
  }

  if (['UK', 'GB', 'UNITED KINGDOM', 'GREAT BRITAIN'].includes(countryValue)) {
    return 'uk';
  }

  return 'metric';
};

const resolveWeatherProvider = async (): Promise<'visualcrossing' | 'openmeteo' | 'openweather'> => {
  const forced = flags.weatherProvider ?? env.WEATHER_PROVIDER ?? 'visualcrossing';

  if (forced === 'openmeteo' || forced === 'openweather') {
    return forced;
  }

  if (forced === 'visualcrossing') {
    try {
      const storedKey = await getKey('visualcrossing');
      if (storedKey && storedKey.trim().length > 0) {
        return 'visualcrossing';
      }
    } catch (error) {
      console.warn('Unable to read Visual Crossing key from secure store', error);
    }
    if (env.VISUALCROSSING_API_KEY?.trim()) {
      return 'visualcrossing';
    }
    return 'openmeteo';
  }

  return 'visualcrossing';
};

const attachSourceMetadata = (weather: WeatherDTO, source: 'visualcrossing' | 'openmeteo' | 'openweather') => {
  const label = SOURCE_LABELS[source] ?? source;
  if (weather.meta) {
    weather.meta = {
      ...weather.meta,
      source,
      sourceLabel: weather.meta.sourceLabel ?? label
    };
  } else {
    weather.meta = {
      source,
      sourceLabel: label
    };
  }
};

router.get('/', async (req, res) => {
  const { lat, lon, city, admin1, country, countryCode, units: unitsQuery } = req.query as Record<
    string,
    string | undefined
  >;
  if (!lat || !lon) {
    res.status(400).json({ message: 'lat and lon are required', status: 400 });
    return;
  }
  const normalizedUnits = normalizeUnits(unitsQuery, countryCode ?? country);
  const provider = await resolveWeatherProvider();
  const cacheKey = `${lat},${lon},${normalizedUnits},${provider}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    const body = JSON.stringify(cached);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(cached);
    return;
  }
  try {
    let weather: WeatherDTO;
    if (provider === 'openweather') {
      weather = await openWeather.getWeather(Number(lat), Number(lon));
    } else {
      const geo: GeoContext = {
        query: '',
        country: country ?? '',
        countryCode: countryCode ?? country ?? '',
        admin1: admin1 ?? undefined,
        city: city ?? undefined,
        lat: Number(lat),
        lon: Number(lon)
      };
      if (provider === 'openmeteo') {
        weather = await getWeatherOM(geo, normalizedUnits);
      } else {
        weather = await getWeatherVC(geo, normalizedUnits);
      }
    }
    attachSourceMetadata(weather, provider === 'openmeteo' ? 'openmeteo' : provider);
    cache.set(cacheKey, weather);
    const body = JSON.stringify(weather);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(weather);
  } catch (error) {
    console.error(error);
    const status = (error as { status?: number }).status;
    if (status && [401, 429].includes(status)) {
      const retryable = status === 429;
      const message = status === 401 ? 'Weather service authentication failed' : 'Weather service rate limit reached';
      res.status(status).json({ message, status, retryable });
      return;
    }
    if (status && status >= 500) {
      res
        .status(status)
        .json({ message: 'Weather service is temporarily unavailable', status, retryable: true });
      return;
    }
    res.status(500).json({ message: 'Failed to load weather', status: 500, retryable: true });
  }
});

export default router;
