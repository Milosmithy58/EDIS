import { Router } from 'express';
import etag from 'etag';
import { LRUCache } from 'lru-cache';
import { env } from '../core/env';
import { GeoContext } from '../core/types';
import * as osm from '../adapters/geocode/openstreetmap';

const cache = new LRUCache<string, { results: GeoContext[] }>({
  max: 200,
  ttl: 1000 * 60 * 5
});

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { query, country, scope, lat, lon } = req.query as Record<string, string>;
    const cacheKey = JSON.stringify({ query, country, scope, lat, lon });
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

    let results: GeoContext[] = [];
    if (lat && lon) {
      results = await osm.reverse({ lat: Number(lat), lon: Number(lon) });
    } else if (query) {
      results = await osm.search({ query, country, scope: scope ?? 'city' });
    } else {
      res.status(400).json({ message: 'query or coordinates required', status: 400 });
      return;
    }

    // Fallback to default country from env if no results and user provided nothing
    if ((!results || results.length === 0) && query) {
      results = await osm.search({ query, country: env.DEFAULT_COUNTRY });
    }

    const payload = { results };
    cache.set(cacheKey, payload);
    const body = JSON.stringify(payload);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to geocode location', status: 500, retryable: true });
  }
});

export default router;
