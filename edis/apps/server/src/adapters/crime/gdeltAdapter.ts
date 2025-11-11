import { fetchJson } from '../../core/fetcher';
import { createNewsItem, NewsItem } from '../../core/normalize';

const DEFAULT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

const KEYWORDS = ['crime', 'police', 'arrest', 'shooting', 'robbery', 'security'];

type GdeltArticle = {
  url: string;
  title: string;
  image?: string;
  socialimage?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourceurl?: string;
  sourcecountry?: string;
};

type GdeltResponse = {
  articles?: GdeltArticle[];
};

type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

const buildQuery = (location: string) => {
  const locationQuery = location ? `"${location}"` : '';
  const keywordQuery = KEYWORDS.map((term) => `"${term}"`).join(' OR ');
  return [locationQuery, keywordQuery].filter(Boolean).join(' AND ');
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  const base = process.env.GDELT_BASE || DEFAULT_BASE;
  const params = new URLSearchParams({
    mode: 'artlist',
    format: 'json',
    sort: 'DateDesc',
    maxrecords: String(Math.min(limit, 50)),
    query: buildQuery(location)
  });

  try {
    const response = await fetchJson<GdeltResponse>(`${base}?${params.toString()}`);
    const articles = response.articles ?? [];
    const now = new Date().toISOString();
    return articles.slice(0, limit).map((article) =>
      createNewsItem({
        id: '',
        title: article.title,
        summary: undefined,
        url: article.url,
        image: article.image || article.socialimage,
        published: article.seendate ? new Date(article.seendate).toISOString() : undefined,
        source: article.domain || 'GDELT',
        source_type: 'dataset',
        source_url: article.sourceurl || base,
        categories,
        scraped_at: now,
        raw_exists: false
      })
    );
  } catch (error) {
    console.error('gdeltAdapter:error', error);
    return [];
  }
};
