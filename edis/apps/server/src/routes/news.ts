import { Router } from 'express';
import etag from 'etag';
import { LRUCache } from 'lru-cache';
import { flags } from '../core/env';
import { NewsDTO } from '../core/types';
import * as gnews from '../adapters/news/gnews';
import * as newsapi from '../adapters/news/newsapi';

const cache = new LRUCache<string, NewsDTO>({ max: 200, ttl: 1000 * 60 * 5 });

const router = Router();

router.get('/', async (req, res) => {
  const { query, country } = req.query as Record<string, string>;
  if (!query) {
    res.status(400).json({ message: 'query is required', status: 400 });
    return;
  }
  const cacheKey = JSON.stringify({ query, country, provider: flags.newsApi ? 'newsapi' : 'gnews' });
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
    const payload = flags.newsApi
      ? await newsapi.getNews(query, country)
      : await gnews.getNews(query, country);
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
    res.status(500).json({ message: 'Failed to load news', status: 500, retryable: true });
  }
});

export default router;
