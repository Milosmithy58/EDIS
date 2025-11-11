import express from 'express';
import crypto from 'node:crypto';
import rateLimit from '../core/rateLimit';
import { NewsItem } from '../core/normalize';
import { fetchCrimeItems as fbi } from '../adapters/crime/fbiAdapter';
import { fetchCrimeItems as webz } from '../adapters/crime/webzAdapter';
import { fetchCrimeItems as newsapi } from '../adapters/crime/newsapiAdapter';
import { fetchCrimeItems as gdelt } from '../adapters/crime/gdeltAdapter';
import { fetchCrimeItems as cm } from '../adapters/crime/crimeMappingAdapter';
import { fetchCrimeItems as sc } from '../adapters/crime/spotCrimeAdapter';
import { fetchCrimeItems as local } from '../adapters/crime/localAgencyAdapter';
import { getCache, setCache } from '../core/cache';

const router = express.Router();
router.use(rateLimit);

const DEFAULT_SOURCES = ['fbi', 'webz', 'newsapi', 'gdelt', 'crimemapping', 'spotcrime', 'local'];

const parseCategories = (raw: string) =>
  raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

router.get('/crime-news', async (req, res) => {
  const location = String(req.query.location || '').trim();
  if (!location) {
    return res.status(400).json({ code: 'LOCATION_REQUIRED', message: 'location is required', status: 400 });
  }
  const categories = parseCategories(String(req.query.categories || 'crime'));
  if (categories.length === 0) {
    categories.push('crime');
  }
  const limit = Math.min(Number.parseInt(String(req.query.limit ?? '25'), 10) || 25, 50);
  const cacheKey = `crime:${location}:${[...categories].sort().join('|')}:${limit}`;
  const cached = getCache<{ location: string; count: number; items: NewsItem[] }>(cacheKey);
  if (cached) {
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifNoneMatch === cached.etag || (ifModifiedSince && new Date(ifModifiedSince) >= new Date(cached.lastModified))) {
      return res.status(304).end();
    }
    res.setHeader('ETag', cached.etag);
    res.setHeader('Last-Modified', cached.lastModified);
    return res.json(cached.value);
  }

  try {
    const enabled = (process.env.CRIME_SOURCES || DEFAULT_SOURCES.join(',')).split(',').map((s) => s.trim());
    const tasks: Promise<NewsItem[]>[] = [];
    const args = { location, categories, limit };
    if (enabled.includes('fbi')) tasks.push(fbi(args));
    if (enabled.includes('webz')) tasks.push(webz(args));
    if (enabled.includes('newsapi')) tasks.push(newsapi(args));
    if (enabled.includes('gdelt')) tasks.push(gdelt(args));
    if (enabled.includes('crimemapping')) tasks.push(cm(args));
    if (enabled.includes('spotcrime')) tasks.push(sc(args));
    if (enabled.includes('local')) tasks.push(local(args));

    const settled = await Promise.allSettled(tasks);
    const results = settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));

    const seen = new Set<string>();
    const merged: NewsItem[] = [];
    const sorted = [...results].sort((a, b) => (b.published || '').localeCompare(a.published || ''));
    for (const item of sorted) {
      const key = item.url || `${item.title}|${item.published}`;
      const id = crypto.createHash('sha1').update(key).digest('hex');
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push({ ...item, id });
      if (merged.length >= limit) break;
    }

    const payload = { location, count: merged.length, items: merged };
    const entry = setCache(cacheKey, payload);
    res.setHeader('ETag', entry.etag);
    res.setHeader('Last-Modified', entry.lastModified);
    return res.json(payload);
  } catch (error: any) {
    console.error('crime-news:error', error);
    return res
      .status(500)
      .json({ code: 'CRIME_NEWS_ERROR', message: error?.message || 'Failed to load crime news', status: 500 });
  }
});

export default router;
