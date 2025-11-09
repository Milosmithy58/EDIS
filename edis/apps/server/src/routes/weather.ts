import { Router } from 'express';
import etag from 'etag';
import { LRUCache } from 'lru-cache';
import { flags } from '../core/env';
import { WeatherDTO } from '../core/types';
import * as openMeteo from '../adapters/weather/openmeteo';
import * as openWeather from '../adapters/weather/openweather';

const cache = new LRUCache<string, WeatherDTO>({ max: 200, ttl: 1000 * 60 * 5 });

const router = Router();

router.get('/', async (req, res) => {
  const { lat, lon } = req.query as Record<string, string>;
  if (!lat || !lon) {
    res.status(400).json({ message: 'lat and lon are required', status: 400 });
    return;
  }
  const cacheKey = `${lat},${lon},${flags.openWeather}`;
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
    const weather = flags.openWeather
      ? await openWeather.getWeather(Number(lat), Number(lon))
      : await openMeteo.getWeather(Number(lat), Number(lon));
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
    res.status(500).json({ message: 'Failed to load weather', status: 500, retryable: true });
  }
});

export default router;
