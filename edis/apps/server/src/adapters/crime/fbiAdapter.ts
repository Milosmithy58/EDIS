import { fetchText } from '../../core/fetcher';
import { createNewsItem, NewsItem } from '../../core/normalize';

const FBI_FEEDS = [
  'https://www.fbi.gov/news/pressrel/press-releases/rss.xml',
  'https://www.fbi.gov/news/blog/rss.xml',
  'https://www.fbi.gov/investigate/violent-crime/rss.xml',
  'https://www.fbi.gov/news/stories/rss.xml'
];

const decode = (value?: string) =>
  value
    ?.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const parseItems = (xml: string) => {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return matches.map((match) => {
    const getTag = (tag: string) => {
      const tagMatch = match.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return decode(tagMatch?.[1] ?? '');
    };
    return {
      title: getTag('title') ?? '',
      link: decode(match.match(/<link>([^<]*)<\/link>/i)?.[1] ?? ''),
      description: getTag('description') ?? '',
      pubDate: getTag('pubDate') ?? ''
    };
  });
};

const toIsoString = (input?: string) => {
  if (!input) return undefined;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const includesLocation = (title: string, location: string) => {
  if (!location) return true;
  return title.toLowerCase().includes(location.toLowerCase());
};

export type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  const now = new Date().toISOString();
  const results: NewsItem[] = [];

  for (const feed of FBI_FEEDS) {
    if (results.length >= limit) break;
    try {
      const xml = await fetchText(feed);
      const items = parseItems(xml);
      for (const item of items) {
        if (results.length >= limit) break;
        if (!item.title || !includesLocation(item.title, location)) continue;
        if (!item.link) continue;
        results.push(
          createNewsItem({
            id: '',
            title: item.title,
            summary: item.description,
            url: item.link,
            published: toIsoString(item.pubDate),
            source: 'FBI',
            source_type: 'rss',
            source_url: feed,
            categories,
            scraped_at: now,
            raw_exists: false
          })
        );
      }
    } catch (error) {
      console.error('fbiAdapter:error', error);
    }
  }

  return results.slice(0, limit);
};
