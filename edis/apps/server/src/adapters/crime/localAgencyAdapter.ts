import { canFetch } from '../../core/robots';
import { createNewsItem, NewsItem } from '../../core/normalize';
import { fetchText } from '../../core/fetcher';

const parseHeadlines = (html: string) => {
  const matches = html.match(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi) ?? [];
  return matches
    .map((snippet) => {
      const anchor = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/i.exec(snippet);
      if (!anchor) return null;
      const [, href, text] = anchor;
      const title = text.replace(/<[^>]+>/g, '').trim();
      if (!title) return null;
      return { href, title };
    })
    .filter((item): item is { href: string; title: string } => Boolean(item));
};

type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

const getPressPages = (location: string) => {
  if (!location) return [];
  const env = process.env.LOCAL_AGENCY_PRESS_PAGES;
  if (!env) return [];
  const entries = env.split(',').map((part) => part.trim()).filter(Boolean);
  return entries.filter((entry) => entry.toLowerCase().includes(location.toLowerCase()));
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  const pages = getPressPages(location);
  if (pages.length === 0) return [];

  const results: NewsItem[] = [];
  const now = new Date().toISOString();

  for (const page of pages) {
    if (!(await canFetch(page))) {
      console.warn(`localAgencyAdapter: robots disallow ${page}`);
      continue;
    }
    try {
      const html = await fetchText(page);
      for (const { href, title } of parseHeadlines(html)) {
        if (results.length >= limit) break;
        results.push(
          createNewsItem({
            id: '',
            title,
            summary: undefined,
            url: href.startsWith('http') ? href : page,
            source: 'Local Agency',
            source_type: 'scrape',
            source_url: page,
            categories,
            scraped_at: now,
            raw_exists: false
          })
        );
      }
    } catch (error) {
      console.error('localAgencyAdapter:error', error);
    }
  }

  return results.slice(0, limit);
};
