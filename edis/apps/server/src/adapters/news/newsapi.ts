import { env } from '../../core/env';
import { getKey } from '../../core/secrets/secureStore';
import { fetchJson, toQueryString } from '../../core/fetcher';
import { NewsDTO } from '../../core/types';

const TOP_HEADLINES_URL = 'https://newsapi.org/v2/top-headlines';
const EVERYTHING_URL = 'https://newsapi.org/v2/everything';

type NewsApiArticle = {
  title: string;
  url: string;
  publishedAt: string;
  urlToImage?: string;
  source: {
    name: string;
  };
};

type NewsApiResponse = {
  totalResults: number;
  articles: NewsApiArticle[];
};

export const getNews = async (query: string, country?: string): Promise<NewsDTO> => {
  const apiKey = (await getKey('newsapi')) ?? env.NEWSAPI_API_KEY;
  if (!apiKey) {
    throw new Error('NEWSAPI_API_KEY missing.');
  }
  const trimmedQuery = query.trim();
  const normalizedCountry = country?.trim().toLowerCase();
  const usingTopHeadlines = Boolean(normalizedCountry);
  const params = usingTopHeadlines
    ? toQueryString({
        q: trimmedQuery,
        country: normalizedCountry,
        pageSize: 10
      })
    : toQueryString({
        q: trimmedQuery,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10
      });
  const url = `${usingTopHeadlines ? TOP_HEADLINES_URL : EVERYTHING_URL}?${params}`;
  const payload = await fetchJson<NewsApiResponse>(url, {
    headers: {
      'X-Api-Key': apiKey
    }
  });
  return {
    items: payload.articles.map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source?.name ?? 'Unknown source',
      publishedAtISO: article.publishedAt,
      imageUrl: article.urlToImage
    })),
    total: payload.totalResults,
    source: 'NewsAPI'
  };
};
