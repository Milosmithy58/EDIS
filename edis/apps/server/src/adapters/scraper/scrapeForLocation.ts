import { DEFAULT_DOMAINS, ScrapeDomain } from './domains';
import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import pLimit from 'p-limit';

type Params = { q?: string; lat?: number; lon?: number; filters: string[] };
type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  tags: string[];
  location?: { q?: string; lat?: number; lon?: number };
};

const limit = pLimit(4);
const REQ_TIMEOUT_MS = 12_000;

const controllerFetch = (url: string, init: any = {}) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  return fetch(url, {
    ...init,
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (EDIS Bot; +https://edis.local) Node/20',
      Accept: '*/*',
      ...init.headers
    }
  }).finally(() => clearTimeout(t));
};

export async function scrapeForLocation({ q, lat, lon, filters }: Params): Promise<Article[]> {
  const tasks = DEFAULT_DOMAINS.map((d) => limit(() => scrapeDomain(d)));
  const settled = await Promise.allSettled(tasks);

  const collected: Article[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') collected.push(...s.value);
    else console.warn('[scrape] domain failed:', (s as any)?.reason?.message || s);
  }

  // De-dupe by URL
  const seen = new Set<string>();
  const unique = collected.filter((a) => {
    if (!a.url) return false;
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Optional: simple title filter on q
  const needle = q?.toLowerCase().trim();
  const byQ = needle ? unique.filter((a) => a.title.toLowerCase().includes(needle)) : unique;

  // Tags: OR logic (any match)
  const wanted = filters.map((f) => f.toLowerCase());
  const byTags = wanted.length ? byQ.filter((a) => a.tags.some((t) => wanted.includes(t))) : byQ;

  return byTags.map((a) => ({ ...a, location: { q, lat, lon } }));
}

async function scrapeDomain(domain: ScrapeDomain): Promise<Article[]> {
  if (domain.rss?.length) {
    for (const feed of domain.rss) {
      try {
        const items = await fetchRss(feed);
        if (items.length) return normalizeRss(items, domain);
      } catch {
        // try next RSS or fallback
      }
    }
  }
  if (domain.selectors) {
    try {
      return await fetchHtml(domain);
    } catch {
      /* ignore */
    }
  }
  return [];
}

async function fetchRss(url: string) {
  const res = await controllerFetch(url, { headers: { Accept: 'application/rss+xml, application/xml' } });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
  return Array.isArray(items) ? items : [items];
}

function normalizeRss(items: any[], domain: ScrapeDomain): Article[] {
  return items
    .slice(0, 25)
    .map((it) => {
      const link = it.link?.href || it.link || it.guid || '';
      return {
        title: it.title?._ || it.title || '(untitled)',
        url: typeof link === 'string' ? link : String(link),
        source: domain.name,
        publishedAt: it.pubDate || it.published || it.updated,
        tags: domain.tags
      };
    })
    .filter((a) => a.url);
}

async function fetchHtml(domain: ScrapeDomain): Promise<Article[]> {
  const res = await controllerFetch(domain.homepage);
  if (!res.ok) throw new Error(`HTML ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const sel = domain.selectors!;
  const out: Article[] = [];
  $(sel.item).each((_, el) => {
    const title = $(el).find(sel.title).text().trim();
    let url = $(el).find(sel.link).attr('href') || '';
    if (url && url.startsWith('/')) url = new URL(url, domain.homepage).toString();
    if (title && url) {
      out.push({ title, url, source: domain.name, tags: domain.tags });
    }
  });
  return out.slice(0, 25);
}
