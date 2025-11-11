import type { Request, Response } from 'express';
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

const buildFilterClauses = (labels: NewsFilterLabel[]): string[] =>
  labels.map((label) => {
    const terms = FILTER_KEYWORDS[label]
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    const uniqueTerms = Array.from(new Set(terms));
    const joined = uniqueTerms
      .map((term) => (term.includes(' ') ? `"${term}"` : term))
      .join(' OR ');
    return `(${joined})`;
  });

type NewsRequestOptions = {
  baseQuery?: string;
  country?: string;
  rssUrl?: string;
  filters: NewsFilterLabel[];
  ts?: number;
  next?: string;
};

const handleNewsRequest = async (
  req: Request,
  res: Response,
  { baseQuery, country, rssUrl, filters, ts, next }: NewsRequestOptions
) => {
  const trimmedQuery = (baseQuery ?? '').trim();
  const normalizedCountry = typeof country === 'string' && country.trim().length > 0 ? country : undefined;
  const normalizedFilters = Array.isArray(filters) ? filters : [];
  const filterClauses = buildFilterClauses(normalizedFilters);
  const filtersKey = serializeFilters(normalizedFilters);
  const normalizedTs = typeof ts === 'number' && Number.isFinite(ts) ? ts : undefined;
  const normalizedRssUrl = rssUrl?.trim();

  if (next && newsProvider !== 'webzio') {
    res
      .status(400)
      .json({ message: 'Pagination is only available with the Webz.io provider', status: 400 });
    return;
  }

  if (!next && !normalizedRssUrl && !trimmedQuery) {
    res.status(400).json({ message: 'query or rssUrl is required', status: 400 });
    return;
  }

  if (normalizedRssUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(normalizedRssUrl);
    } catch (error) {
      res.status(400).json({ message: 'rssUrl must be a valid URL', status: 400 });
      return;
    }
  }

  if (ts !== undefined && normalizedTs === undefined) {
    res
      .status(400)
      .json({ message: 'ts must be a valid Unix millisecond timestamp', status: 400 });
    return;
  }

  const legacyProviderQuery = normalizedRssUrl
    ? undefined
    : buildFilterQuery(trimmedQuery, normalizedFilters);

  const cacheKey = JSON.stringify({
    query: newsProvider === 'webzio' ? trimmedQuery : legacyProviderQuery ?? trimmedQuery,
    country: normalizedCountry,
    rssUrl: normalizedRssUrl,
    filters: filtersKey,
    ts: normalizedTs,
    provider: normalizedRssUrl
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

    const payload = normalizedRssUrl
      ? await rss.getNewsFromFeed(normalizedRssUrl)
      : newsProvider === 'webzio'
      ? await fetchNewsWebz({
          baseQuery: trimmedQuery,
          filters: filterClauses,
          countryCode: normalizedCountry?.toUpperCase(),
          ts: normalizedTs
        })
      : flags.newsApi
      ? await newsapi.getNews(legacyProviderQuery!, normalizedCountry)
      : await gnews.getNews(legacyProviderQuery!, normalizedCountry);

    if (normalizedRssUrl || newsProvider !== 'webzio') {
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
  const ts = rawTs ? Number.parseInt(rawTs, 10) : undefined;
  if (Number.isNaN(ts as number)) {
    res.status(400).json({ message: 'ts must be a valid Unix millisecond timestamp', status: 400 });
    return;
  }
  await handleNewsRequest(req, res, {
    baseQuery: typeof query === 'string' ? query : '',
    country,
    rssUrl,
    filters: normalizedFilters,
    ts,
    next
  });
});

router.post('/', async (req, res) => {
  const { query, filters, country, ts } = (req.body ?? {}) as {
    query?: unknown;
    filters?: unknown;
    country?: unknown;
    ts?: unknown;
  };

  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ message: 'query must be a non-empty string', status: 400 });
    return;
  }

  const normalizedFilters = normalizeFilters(filters ?? []);

  let normalizedTs: number | undefined;
  if (ts !== undefined && ts !== null) {
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      normalizedTs = ts;
    } else if (typeof ts === 'string' && ts.trim()) {
      const parsed = Number.parseInt(ts, 10);
      if (Number.isNaN(parsed)) {
        res.status(400).json({ message: 'ts must be a valid Unix millisecond timestamp', status: 400 });
        return;
      }
      normalizedTs = parsed;
    } else {
      res.status(400).json({ message: 'ts must be a valid Unix millisecond timestamp', status: 400 });
      return;
    }
  }

  const normalizedCountry = typeof country === 'string' && country.trim().length > 0 ? country.trim() : undefined;

  await handleNewsRequest(req, res, {
    baseQuery: query,
    country: normalizedCountry,
    filters: normalizedFilters,
    ts: normalizedTs
  });
});

export default router;
