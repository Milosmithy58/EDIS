import type { NewsDTO, NewsItem } from 'types/news';

type BuildMockNewsOptions = {
  query: string;
  filters: string[];
  location?: { city?: string | null; admin1?: string | null; countryCode?: string | null };
};

const BASE_ITEMS: NewsItem[] = [
  {
    title: 'Emergency services respond to incident near town centre',
    url: 'https://newsroom.local/emergency-response',
    source: 'Local Desk',
    publishedAtISO: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    imageUrl: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=60'
  },
  {
    title: 'Transport disruption prompts alternate routes for commuters',
    url: 'https://newsroom.local/transport-update',
    source: 'Transit Authority',
    publishedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=60'
  },
  {
    title: 'Community briefing issued following overnight weather system',
    url: 'https://newsroom.local/weather-briefing',
    source: 'Weather Center',
    publishedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
  }
];

export function buildMockNewsFeed(options: BuildMockNewsOptions): NewsDTO {
  const locationLabel = options.location?.city || options.location?.admin1 || 'your area';
  const filterLabel = options.filters.length > 0 ? options.filters.join(', ') : 'general safety';
  const queryText = options.query.trim().length > 0 ? options.query.trim() : 'local safety';

  const personalizedItems = BASE_ITEMS.map((item, index) => ({
    ...item,
    title:
      index === 0
        ? `${item.title.replace('incident', queryText)} in ${locationLabel}`
        : `${item.title} for ${locationLabel}`,
    source: `${item.source} (sample)`
  }));

  return {
    items: personalizedItems,
    total: personalizedItems.length,
    source: 'Sample news feed',
    notice: undefined,
    cached: true,
    fetchedAt: new Date().toISOString(),
    next: undefined
  };
}
