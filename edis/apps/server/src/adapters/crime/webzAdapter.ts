import { fetchJson } from '../../core/fetcher';
import { createNewsItem, NewsItem } from '../../core/normalize';

const BASE_URL = 'https://webz.io/api/news/v1/article/getArticles';

const buildQuery = (location: string, categories: string[]) => {
  const loc = location ? `${location} ` : '';
  const categoryQuery = categories.length > 0 ? categories.join(' OR ') : 'crime';
  return `${loc}(crime OR arrest OR police OR shooting OR robbery OR security OR "public safety") AND (${categoryQuery}) site_type:news language:english`;
};

type WebzResponse = {
  posts?: Array<{
    title: string;
    text?: string;
    published?: string;
    url: string;
    thread?: { main_image?: string; site?: string; site_full?: string };
  }>;
};

type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  const token = process.env.WEBZ_API_KEY || process.env.WEBZIO_TOKEN;
  if (!token) return [];

  const query = buildQuery(location, categories);
  const params = new URLSearchParams({
    q: query,
    token,
    sort: 'published',
    language: 'english',
    size: String(Math.min(limit, 50))
  });

  try {
    const payload = await fetchJson<WebzResponse>(`${BASE_URL}?${params.toString()}`);
    const posts = payload.posts ?? [];
    const now = new Date().toISOString();
    return posts.slice(0, limit).map((post) =>
      createNewsItem({
        id: '',
        title: post.title,
        summary: post.text,
        url: post.url,
        image: post.thread?.main_image,
        published: post.published ? new Date(post.published).toISOString() : undefined,
        source: post.thread?.site || 'Webz.io',
        source_type: 'api',
        source_url: post.thread?.site_full || post.url,
        categories,
        scraped_at: now,
        raw_exists: false
      })
    );
  } catch (error) {
    console.error('webzAdapter:error', error);
    return [];
  }
};
