import { fetchJson } from '../../core/fetcher';
import { createNewsItem, NewsItem } from '../../core/normalize';

const BASE_URL = 'https://newsapi.org/v2/everything';

const KEYWORDS = ['crime', 'arrest', 'police', 'shooting', 'robbery', 'security', 'public safety'];

type NewsApiResponse = {
  articles?: Array<{
    title: string;
    description?: string;
    url: string;
    urlToImage?: string;
    publishedAt?: string;
    source?: { name?: string; id?: string };
  }>;
};

type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

const buildQuery = (location: string) => {
  const locationPhrase = location ? `"${location}"` : '';
  const keywordQuery = KEYWORDS.map((term) => `"${term}"`).join(' OR ');
  const segments = [locationPhrase, `(${keywordQuery})`].filter(Boolean);
  return segments.join(' AND ');
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  const apiKey = process.env.NEWSAPI_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: buildQuery(location),
    sortBy: 'publishedAt',
    language: 'en',
    pageSize: String(Math.min(limit, 50))
  });

  try {
    const response = await fetchJson<NewsApiResponse>(`${BASE_URL}?${params.toString()}`, {
      headers: { 'X-Api-Key': apiKey }
    });
    const articles = response.articles ?? [];
    const now = new Date().toISOString();
    return articles.slice(0, limit).map((article) =>
      createNewsItem({
        id: '',
        title: article.title,
        summary: article.description,
        url: article.url,
        image: article.urlToImage,
        published: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
        source: article.source?.name || 'NewsAPI',
        source_type: 'api',
        source_url: 'https://newsapi.org/',
        categories,
        scraped_at: now,
        raw_exists: false
      })
    );
  } catch (error) {
    console.error('newsapiAdapter:error', error);
    return [];
  }
};
