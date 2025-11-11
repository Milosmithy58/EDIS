import { env } from '../../core/env';
import { getKey } from '../../core/secrets/secureStore';
import { fetchJson, toQueryString } from '../../core/fetcher';
import { NewsDTO } from '../../core/types';

const BASE_URL = 'https://gnews.io/api/v4/search';

type GNewsArticle = {
  title: string;
  url: string;
  publishedAt: string;
  image?: string;
  source: {
    name: string;
  };
};

type GNewsResponse = {
  totalArticles: number;
  articles: GNewsArticle[];
};

export const getNews = async (query: string, country?: string): Promise<NewsDTO> => {
  const apiKey = (await getKey('gnews')) ?? env.GNEWS_API_KEY;
  if (!apiKey) {
    throw new Error('GNEWS_API_KEY missing.');
  }
  const params = toQueryString({
    q: query,
    country: country?.toLowerCase(),
    token: apiKey,
    lang: 'en',
    max: 10
  });
  const payload = await fetchJson<GNewsResponse>(`${BASE_URL}?${params}`);
  return {
    items: payload.articles.map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source?.name ?? 'Unknown source',
      publishedAtISO: article.publishedAt,
      imageUrl: article.image
    })),
    total: payload.totalArticles,
    source: 'GNews'
  };
};
