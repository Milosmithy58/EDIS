import { Router } from 'express';
import etag from 'etag';
import { LRUCache } from 'lru-cache';
import { flags, newsProvider } from '../core/env';
import { NewsDTO } from '../core/types';
import * as gnews from '../adapters/news/gnews';
import * as newsapi from '../adapters/news/newsapi';
import * as rss from '../adapters/news/rss';
import {
  FILTER_KEYWORDS,
  NewsFilterLabel,
  buildFilterQuery,
  normalizeFilters,
  serializeFilters
} from '../adapters/news/filterKeywords';
import { fetchNewsWebz, NewsProviderError } from '../adapters/news/webzio';

const cache = new LRUCache<string, NewsDTO>({ max: 200, ttl: 1000 * 60 * 5 });

const router = Router();

const buildFilterClauses = (labels: NewsFilterLabel[]): string[] => {
  return labels.map((label) => {
    const terms = FILTER_KEYWORDS[label]
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    const uniqueTerms = Array.from(new Set(terms));
    const joined = uniqueTerms
      .map((term) => (term.includes(' ') ? `"${term}"` : term))
      .join(' OR ');
    return `(${joined})`;
  });
};

router.get('/', async (req, res) => {
  const {
    query,
    country,
    rssUrl: rawRssUrl,
    filters: rawFilters,
    ts: rawTs,
    next
  } = req.query as Record<string, string | undefined>;
  const rssUrl = rawRssUrl?.trim();
  if (next && newsProvider !== 'webzio') {
    res.status(400).json({ message: 'Pagination is only available with the Webz.io provider', status: 400 });
    return;
  }
  if (!next && !query && !rssUrl) {
    res.status(400).json({ message: 'query or rssUrl is required', status: 400 });
    return;
  }

  if (rssUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(rssUrl);
    } catch (error) {
      res.status(400).json({ message: 'rssUrl must be a valid URL', status: 400 });
      return;
    }
  }

  let parsedFilters: unknown = [];
  if (rawFilters) {
    try {
      parsedFilters = JSON.parse(rawFilters);
    } catch (error) {
      console.warn('Unable to parse filters payload', error);
      parsedFilters = [];
    }
  }

  const normalizedFilters = normalizeFilters(parsedFilters);
  const filtersKey = serializeFilters(normalizedFilters);
  const ts = rawTs ? Number.parseInt(rawTs, 10) : undefined;
  const filterClauses = buildFilterClauses(normalizedFilters);
  const legacyProviderQuery = rssUrl ? undefined : buildFilterQuery(query ?? '', normalizedFilters);

  if (Number.isNaN(ts as number)) {
    res.status(400).json({ message: 'ts must be a valid Unix millisecond timestamp', status: 400 });
    return;
  }

  const cacheKey = JSON.stringify({
    query: newsProvider === 'webzio' ? query : legacyProviderQuery ?? query,
    country,
    rssUrl,
    filters: filtersKey,
    ts,
    provider: rssUrl
      ? 'rss'
      : newsProvider === 'webzio'
      ? 'webzio'
      : flags.newsApi
      ? 'newsapi'
      : 'gnews'
  });
  if (!next && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    const responsePayload = { ...cached, cached: true };
    const body = JSON.stringify(responsePayload);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(responsePayload);
    return;
  }
  try {
    if (next) {
      const payload = await fetchNewsWebz({ baseQuery: '', filters: [], nextUrl: next });
      res.json(payload);
      return;
    }

    const payload = rssUrl
      ? await rss.getNewsFromFeed(rssUrl)
      : newsProvider === 'webzio'
      ? await fetchNewsWebz({
          baseQuery: query ?? '',
          filters: filterClauses,
          countryCode: country?.toUpperCase(),
          ts
        })
      : flags.newsApi
      ? await newsapi.getNews(legacyProviderQuery!, country)
      : await gnews.getNews(legacyProviderQuery!, country);

    if (rssUrl || newsProvider !== 'webzio') {
      cache.set(cacheKey, payload);
    } else {
      cache.set(cacheKey, { ...payload, cached: payload.cached ?? false });
    }

    const body = JSON.stringify(payload);
    const tag = etag(body);
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', tag);
    res.json(payload);
  } catch (error) {
    if (error instanceof NewsProviderError) {
      res.status(error.status).json(error.dto);
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Failed to load news', status: 500, retryable: true });
  }
});

export default router;
