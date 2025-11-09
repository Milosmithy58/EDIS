import { env } from '../../core/env';
import { fetchJson, toQueryString } from '../../core/fetcher';
import { NewsDTO } from '../../core/types';

const BASE_URL = 'https://newsapi.org/v2/top-headlines';

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
  if (!env.NEWSAPI_API_KEY) {
    throw new Error('NEWSAPI_API_KEY missing.');
  }
  const params = toQueryString({
    q: query,
    country: country?.toLowerCase(),
    pageSize: 10
  });
  const payload = await fetchJson<NewsApiResponse>(`${BASE_URL}?${params}`, {
    headers: {
      'X-Api-Key': env.NEWSAPI_API_KEY
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
