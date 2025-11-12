import { LRUCache } from 'lru-cache';
import { mapArticleToFilters } from '../../core/news/filters';
import type { NewsItemDTO, StandardizedLocation } from '../../types/news';

const MAX_CONCURRENCY = 4;
const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.VITEST_WORKER_ID !== 'undefined';
const DOMAIN_RATE_LIMIT_MS = isTestEnv ? 5 : 1000;
const MAX_ITEMS_PER_DOMAIN = 40;
const MAX_RETRIES = isTestEnv ? 0 : 2;

const FEED_PATHS = ['/rss', '/feed', '/feeds', '/rss.xml', '/atom.xml'];
const SEARCH_PATHS = ['/search', '/?s='];

const robotsCache = new LRUCache<string, { allow: string[]; disallow: string[] }>({ max: 200, ttl: 1000 * 60 * 60 });
const domainLastRequest = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const throttleDomain = async (domain: string) => {
  const last = domainLastRequest.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < DOMAIN_RATE_LIMIT_MS) {
    await sleep(DOMAIN_RATE_LIMIT_MS - elapsed);
  }
  domainLastRequest.set(domain, Date.now());
};

const normalizePath = (value: string) => (value.startsWith('/') ? value : `/${value}`);

const parseRobots = (text: string) => {
  const rules = { allow: [] as string[], disallow: [] as string[] };
  let appliesToAll = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.split('#')[0]?.trim();
    if (!trimmed) continue;
    const [directiveRaw, ...valueParts] = trimmed.split(':');
    if (!directiveRaw) continue;
    const directive = directiveRaw.toLowerCase();
    const value = valueParts.join(':').trim();
    if (directive === 'user-agent') {
      appliesToAll = value === '*' || value.toLowerCase() === 'edis';
      continue;
    }
    if (!appliesToAll) {
      continue;
    }
    if (directive === 'disallow') {
      if (!value) continue;
      rules.disallow.push(normalizePath(value.replace(/\*/g, '')));
    }
    if (directive === 'allow') {
      if (!value) continue;
      rules.allow.push(normalizePath(value.replace(/\*/g, '')));
    }
  }
  return rules;
};

const fetchRobots = async (domain: string) => {
  if (robotsCache.has(domain)) {
    return robotsCache.get(domain)!;
  }
  try {
    const url = new URL(`https://${domain}/robots.txt`);
    await throttleDomain(domain);
    const response = await fetch(url, { headers: { 'User-Agent': 'EDIS/1.0 (contact: ops@edis.local)' } });
    if (!response.ok) {
      return { allow: [], disallow: [] };
    }
    const payload = await response.text();
    const parsed = parseRobots(payload);
    robotsCache.set(domain, parsed);
    return parsed;
  } catch (error) {
    console.warn(`Failed to load robots.txt for ${domain}`, error);
    return { allow: [], disallow: [] };
  }
};

const isAllowed = async (domain: string, path: string) => {
  const rules = await fetchRobots(domain);
  const normalized = normalizePath(path);
  if (rules.allow.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  if (rules.disallow.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return true;
};

const fetchWithRetry = async (domain: string, url: URL, init?: RequestInit) => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= MAX_RETRIES) {
    try {
      await throttleDomain(domain);
      const response = await fetch(url, {
        ...init,
        headers: {
          'User-Agent': 'EDIS/1.0 (contact: ops@edis.local)',
          Accept: 'application/json, text/html, application/xml, text/xml',
          ...(init?.headers ?? {})
        }
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        break;
      }
      await sleep(300 * attempt);
    }
  }
  throw lastError ?? new Error('Network request failed');
};

const canonicalUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch (error) {
    return value;
  }
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const cosineSimilarity = (a: string, b: string) => {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.length || !tokensB.length) return 0;
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const token of tokensA) freqA.set(token, (freqA.get(token) ?? 0) + 1);
  for (const token of tokensB) freqB.set(token, (freqB.get(token) ?? 0) + 1);
  let dot = 0;
  for (const [token, countA] of freqA) {
    const countB = freqB.get(token);
    if (countB) {
      dot += countA * countB;
    }
  }
  const magnitude = (freq: Map<string, number>) => Math.sqrt(Array.from(freq.values()).reduce((sum, value) => sum + value * value, 0));
  const magA = magnitude(freqA);
  const magB = magnitude(freqB);
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
};

const dedupe = (items: NewsItemDTO[]): NewsItemDTO[] => {
  const seen = new Set<string>();
  const output: NewsItemDTO[] = [];
  for (const item of items) {
    const url = canonicalUrl(item.url);
    if (seen.has(url)) continue;
    const duplicate = output.some((existing) => cosineSimilarity(existing.title, item.title) > 0.8);
    if (duplicate) continue;
    seen.add(url);
    output.push(item);
  }
  return output;
};

const extractTagValue = (source: string, tag: string) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = source.match(regex);
  if (!match) return '';
  return match[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
};

const extractLink = (source: string) => {
  const link = extractTagValue(source, 'link');
  if (link) return link;
  const hrefMatch = source.match(/<link[^>]+href="([^"]+)"[^>]*>/i);
  return hrefMatch?.[1] ?? '';
};

const extractImage = (source: string) => {
  const mediaMatch = source.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i) ?? source.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
  return mediaMatch?.[1];
};

const parseFeedItems = (xml: string) => {
  const items: Array<{ title: string; url: string; summary: string; publishedAt: string; image?: string }> = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  const matches = xml.match(itemRegex) ?? xml.match(entryRegex) ?? [];
  for (const block of matches) {
    const title = extractTagValue(block, 'title');
    const url = extractLink(block);
    const summary = extractTagValue(block, 'description') || extractTagValue(block, 'summary');
    const published = extractTagValue(block, 'pubdate') || extractTagValue(block, 'updated') || extractTagValue(block, 'published');
    const image = extractImage(block) ?? undefined;
    if (!title || !url) continue;
    items.push({ title, url, summary, publishedAt: published, image });
  }
  return items;
};

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");

const resolveRelativeUrl = (href: string, domain: string) => {
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return new URL(href).toString();
    }
    const base = new URL(`https://${domain}`);
    return new URL(href, base).toString();
  } catch (error) {
    return href;
  }
};

const parseAnchors = (html: string, domain: string) => {
  const results: Array<{ title: string; url: string; summary: string; publishedAt: string; image?: string }> = [];
  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html))) {
    const href = match[1];
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (!href || !text) continue;
    const url = resolveRelativeUrl(href, domain);
    if (!url.startsWith('http')) continue;

    const imageMatch = match[0].match(/<img[^>]+(?:src|data-src|data-original|data-thumbnail)="([^"]+)"[^>]*>/i);
    const image = imageMatch ? resolveRelativeUrl(imageMatch[1], domain) : undefined;

    results.push({
      title: text,
      url,
      summary: text,
      image,
      publishedAt: new Date().toISOString()
    });
  }
  return results;
};

const shouldKeep = (
  item: { title: string; summary: string; categories: string[] },
  filters: string[],
  keywords: string[] | undefined
) => {
  if (!filters.length && (!keywords || !keywords.length)) {
    return true;
  }
  if (filters.length > 0 && !item.categories.some((category) => filters.includes(category))) {
    return false;
  }
  if (keywords && keywords.length > 0) {
    const haystack = `${item.title} ${item.summary}`.toLowerCase();
    if (!keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return false;
    }
  }
  return true;
};

const withLocationHints = (item: NewsItemDTO, location: StandardizedLocation | null): NewsItemDTO => {
  if (!location) return item;
  const hints = new Set<string>();
  hints.add(location.displayName);
  for (const level of location.adminLevels ?? []) hints.add(level);
  return { ...item, locationHints: Array.from(hints) };
};

const clampLimit = (value: number) => Math.min(200, Math.max(1, value));

const runWithConcurrency = async <T>(factories: Array<() => Promise<T>>, limit: number) => {
  if (factories.length === 0) return [] as T[];
  const results = new Array<T>(factories.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, factories.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= factories.length) {
        break;
      }
      results[index] = await factories[index]!();
    }
  });
  await Promise.all(workers);
  return results;
};

const sanitizeDomain = (domain: string) => domain.replace(/[^a-z0-9.-]/gi, '').toLowerCase();

const discoverFeedUrls = (domain: string) => FEED_PATHS.map((path) => new URL(path, `https://${domain}`));

const discoverSearchUrls = (domain: string, terms: string[]) => {
  const urls: URL[] = [];
  for (const path of SEARCH_PATHS) {
    for (const term of terms.slice(0, 3)) {
      const base = new URL(path === '/?s=' ? '/' : path, `https://${domain}`);
      if (path === '/?s=') {
        base.searchParams.set('s', term);
      } else {
        base.searchParams.set('q', term);
      }
      urls.push(base);
    }
  }
  return urls;
};

const cleanFilterTerms = (clauses: string[]) => {
  const terms: string[] = [];
  for (const clause of clauses) {
    const sanitized = clause.replace(/[()"']/g, ' ');
    for (const part of sanitized.split(/OR|AND|\s+/)) {
      const trimmed = part.trim();
      if (trimmed.length >= 3) {
        terms.push(trimmed.toLowerCase());
      }
    }
  }
  return Array.from(new Set(terms));
};

const scrapeDomain = async (
  domain: string,
  options: {
    filters: string[];
    filterQueries: string[];
    keywords?: string[];
    location: StandardizedLocation | null;
    since: Date;
    limit: number;
  }
): Promise<NewsItemDTO[]> => {
  const sanitized = sanitizeDomain(domain);
  const results: NewsItemDTO[] = [];
  const filterTerms = cleanFilterTerms(options.filterQueries);
  const searchTerms = Array.from(new Set([...filterTerms, ...(options.keywords ?? []).map((term) => term.toLowerCase())]));

  for (const feedUrl of discoverFeedUrls(sanitized)) {
    if (!(await isAllowed(sanitized, feedUrl.pathname))) {
      continue;
    }
    try {
      const response = await fetchWithRetry(sanitized, feedUrl, { method: 'GET' });
      const xml = await response.text();
      for (const item of parseFeedItems(xml)) {
        const categories = mapArticleToFilters(`${item.title} ${item.summary}`, item.url);
        const newsItem: NewsItemDTO = withLocationHints(
          {
            url: item.url,
            title: item.title,
            summary: item.summary,
            image: item.image,
            publishedAt: new Date(item.publishedAt).toISOString(),
            source: sanitized,
            categories
          },
          options.location
        );
        if (!shouldKeep({ title: newsItem.title, summary: newsItem.summary, categories }, options.filters, options.keywords)) {
          continue;
        }
        const published = new Date(newsItem.publishedAt);
        if (Number.isNaN(published.getTime()) || published < options.since) {
          continue;
        }
        results.push(newsItem);
        if (results.length >= options.limit || results.length >= MAX_ITEMS_PER_DOMAIN) {
          return results;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch feed for ${sanitized}`, error);
    }
  }

  if (results.length >= options.limit || searchTerms.length === 0) {
    return results;
  }

  for (const searchUrl of discoverSearchUrls(sanitized, searchTerms)) {
    if (!(await isAllowed(sanitized, searchUrl.pathname))) {
      continue;
    }
    try {
      const response = await fetchWithRetry(sanitized, searchUrl, { method: 'GET' });
      const html = await response.text();
      for (const raw of parseAnchors(html, sanitized)) {
        const categories = mapArticleToFilters(`${raw.title} ${raw.summary}`, raw.url);
        const newsItem: NewsItemDTO = withLocationHints(
          {
            url: raw.url,
            title: raw.title,
            summary: raw.summary,
            publishedAt: raw.publishedAt,
            source: sanitized,
            categories
          },
          options.location
        );
        if (!shouldKeep({ title: newsItem.title, summary: newsItem.summary, categories }, options.filters, options.keywords)) {
          continue;
        }
        const published = new Date(newsItem.publishedAt);
        if (Number.isNaN(published.getTime()) || published < options.since) {
          continue;
        }
        results.push(newsItem);
        if (results.length >= options.limit || results.length >= MAX_ITEMS_PER_DOMAIN) {
          return results;
        }
      }
    } catch (error) {
      console.warn(`Failed to execute search for ${sanitized}`, error);
    }
  }

  return results;
};

export type ScrapeOptions = {
  filters: string[];
  filterQueries: string[];
  location: StandardizedLocation | null;
  keywords?: string[];
  domains: string[];
  since: Date;
  limit: number;
};

export const scrapeNews = async ({
  filters,
  filterQueries,
  location,
  keywords,
  domains,
  since,
  limit
}: ScrapeOptions): Promise<NewsItemDTO[]> => {
  const normalizedLimit = clampLimit(limit);
  const tasks = domains.map((domain) => () =>
    scrapeDomain(domain, { filters, filterQueries, keywords, location, since, limit: normalizedLimit })
  );
  const results = await runWithConcurrency(tasks, MAX_CONCURRENCY);
  const merged = results
    .flat()
    .filter((item) => {
      const date = new Date(item.publishedAt);
      return !Number.isNaN(date.getTime()) && date >= since;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return dedupe(merged).slice(0, normalizedLimit);
};
