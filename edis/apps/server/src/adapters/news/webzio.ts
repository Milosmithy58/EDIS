import { LRUCache } from 'lru-cache';
import { env } from '../../core/env';
import { NewsDTO } from '../../core/types';
import { QUALITY_BOOSTERS } from './filterKeywords';

const BASE_URL = 'https://api.webz.io/newsApiLite';
const RESULT_LIMIT = 10;
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes keeps us inside the 5-10 minute guidance.
const BUDGET_LIMIT = 1000; // Lite plan monthly allowance.
const BUDGET_THRESHOLD = 0.9; // Warn and lean on cache once 90% of calls are consumed.
const RETRY_DELAYS_MS = [250, 500, 1000];

export class NewsProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly dto: { message: string; status: number; retryable?: boolean }
  ) {
    super(message);
    this.name = 'NewsProviderError';
  }
}

type WebzThread = {
  site?: string;
  url?: string;
  main_image?: string;
  country?: string;
};

type WebzLiteArticle = {
  title?: string;
  url?: string;
  link?: string;
  published?: string;
  publishedAt?: string;
  updated?: string;
  thread?: WebzThread;
  author?: string;
  text?: string;
  image?: string;
};

type WebzLiteResponse = {
  posts?: WebzLiteArticle[];
  totalResults?: number;
  totalResultsRel?: number;
  requestsLeft?: number;
  next?: string;
};

type FetchArgs = {
  baseQuery: string;
  filters: string[];
  countryCode?: string;
  ts?: number;
  nextUrl?: string;
};

type CachedEntry = {
  data: NewsDTO;
};

const cache = new LRUCache<string, CachedEntry>({ max: 200, ttl: CACHE_TTL_MS });

const budgetState: { month: string; count: number } = { month: '', count: 0 };


const getMonthKey = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const shouldWarnBudget = (): boolean => {
  const key = getMonthKey();
  if (budgetState.month !== key) {
    budgetState.month = key;
    budgetState.count = 0;
    return false;
  }
  return budgetState.count / BUDGET_LIMIT >= BUDGET_THRESHOLD;
};

const incrementBudget = () => {
  const key = getMonthKey();
  if (budgetState.month !== key) {
    budgetState.month = key;
    budgetState.count = 0;
  }
  budgetState.count += 1;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mapArticles = (response: WebzLiteResponse): NewsDTO => {
  const posts = response.posts ?? [];
  const items = posts.map((post) => {
    const fallbackUrl = post.url ?? post.link ?? post.thread?.url ?? '';
    const publishedRaw = post.published ?? post.publishedAt ?? post.updated;
    const publishedAtISO = publishedRaw ? new Date(publishedRaw).toISOString() : new Date().toISOString();
    return {
      title: post.title ?? 'Untitled story',
      url: fallbackUrl,
      source: post.thread?.site ?? 'webz.io',
      publishedAtISO,
      imageUrl: post.thread?.main_image ?? post.image
    };
  });
  return {
    items,
    total: response.totalResults ?? response.totalResultsRel,
    source: 'webz.io',
    next: response.next
  };
};

const buildLocationClause = (baseQuery: string): string => {
  const trimmed = baseQuery.trim();
  if (!trimmed) {
    return '';
  }
  const tokens = trimmed
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => token.replace(/"/g, ''));
  const uniqueTokens = Array.from(new Set(tokens));
  if (uniqueTokens.length === 0) {
    return '';
  }
  const quotedTokens = uniqueTokens.map((token) => (token.includes(' ') ? `"${token}"` : token));
  const joined = quotedTokens.join(' OR ');
  return `title:(${joined}) OR text:(${joined})`;
};

export const composeWebzQuery = (baseQuery: string, filters: string[], countryCode?: string): string => {
  const locationClause = buildLocationClause(baseQuery);
  const cleanedFilters = filters
    .map((group) => group.trim())
    .filter((group) => group.length > 0);
  const filterClause = cleanedFilters.length > 0 ? cleanedFilters.join(' OR ') : '';

  const segments: string[] = [];
  if (locationClause) {
    segments.push(`(${locationClause})`);
  }
  if (filterClause) {
    segments.push(`(${filterClause})`);
  }

  let query = '';
  if (segments.length === 0) {
    query = '';
  } else if (segments.length === 1) {
    query = segments[0];
  } else {
    query = `${segments[0]} AND ${segments.slice(1).join(' AND ')}`;
  }

  if (countryCode) {
    query = query ? `${query} country:${countryCode}` : `country:${countryCode}`;
  }

  if (query) {
    query = `${query} ${QUALITY_BOOSTERS.join(' ')}`.trim();
  } else {
    query = QUALITY_BOOSTERS.join(' ');
  }

  return query.trim();
};

const requestJson = async (url: string, attempt = 0): Promise<WebzLiteResponse> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt < RETRY_DELAYS_MS.length) {
      await wait(RETRY_DELAYS_MS[attempt]);
      return requestJson(url, attempt + 1);
    }
    throw new NewsProviderError(
      'Webz.io is temporarily rate limiting our requests.',
      response.status,
      true,
      {
        message: 'Webz.io temporarily rate limited news searches. Showing cached headlines when available.',
        status: response.status,
        retryable: true
      }
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new NewsProviderError(
      `Webz.io request failed: ${response.status} ${text}`,
      response.status,
      response.status >= 500,
      {
        message: 'Unable to load news from Webz.io at the moment. Please try again shortly.',
        status: response.status,
        retryable: response.status >= 500
      }
    );
  }

  return (await response.json()) as WebzLiteResponse;
};

export const fetchNewsWebz = async ({ baseQuery, filters, countryCode, ts, nextUrl }: FetchArgs): Promise<NewsDTO> => {
  if (!env.WEBZIO_TOKEN) {
    throw new Error('WEBZIO_TOKEN missing');
  }

  if (nextUrl) {
    const url = new URL(nextUrl);
    url.searchParams.set('token', env.WEBZIO_TOKEN);
    const data = await requestJson(url.toString());
    incrementBudget();
    const notice = shouldWarnBudget()
      ? 'Using cached news. Live lookups limited.'
      : undefined;
    const mapped = mapArticles(data);
    return {
      ...mapped,
      notice,
      cached: false
    };
  }

  const query = composeWebzQuery(baseQuery, filters, countryCode);
  const cacheKey = JSON.stringify({ q: query, ts });
  const budgetWarningActive = shouldWarnBudget();

  if (budgetWarningActive && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return {
      ...cached.data,
      notice: 'Using cached news. Live lookups limited.',
      cached: true
    };
  }

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return {
      ...cached.data,
      notice: budgetWarningActive ? 'Using cached news. Live lookups limited.' : cached.data.notice,
      cached: true
    };
  }

  const params = new URLSearchParams();
  params.set('token', env.WEBZIO_TOKEN);
  params.set('q', query);
  params.set('size', String(RESULT_LIMIT));
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    params.set('ts', String(ts));
  }
  const url = `${BASE_URL}?${params.toString()}`;
  const data = await requestJson(url);
  incrementBudget();
  const mapped = mapArticles(data);
  cache.set(cacheKey, { data: mapped });
  const notice = shouldWarnBudget() ? 'Using cached news. Live lookups limited.' : undefined;
  return {
    ...mapped,
    notice,
    cached: false
  };
};
