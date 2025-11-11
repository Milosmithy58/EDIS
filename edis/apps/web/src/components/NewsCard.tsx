import { useQuery } from '@tanstack/react-query';
import { GeoContext } from './LocationSearch';
import { formatDateTime } from '../lib/format';
import { normalizeFilters, serializeFilters } from '../lib/newsFilters';

type NewsDTO = {
  items: Array<{
    title: string;
    url: string;
    source: string;
    publishedAtISO: string;
    imageUrl?: string;
  }>;
  total: number;
  source: string;
};

type Props = {
  geo: GeoContext | null;
  query: string;
  country: string;
  rssUrl: string;
  filters: string[];
  onClearFilters: () => void;
};

const NewsCard = ({ geo, query, country, rssUrl, filters, onClearFilters }: Props) => {
  const trimmedRssUrl = rssUrl.trim();
  const hasCustomFeed = Boolean(trimmedRssUrl);
  const isValidFeed = hasCustomFeed
    ? (() => {
        try {
          // eslint-disable-next-line no-new
          new URL(trimmedRssUrl);
          return true;
        } catch (error) {
          return false;
        }
      })()
    : false;
  const normalizedFilters = normalizeFilters(filters);
  const serializedFilters = serializeFilters(filters);
  const hasFilters = normalizedFilters.length > 0;
  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<NewsDTO>({
    queryKey: ['news', query, country, trimmedRssUrl, serializedFilters],
    enabled: (hasCustomFeed && isValidFeed) || (Boolean(query) && Boolean(geo)),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (hasCustomFeed) {
        params.set('rssUrl', trimmedRssUrl);
      } else {
        params.set('query', query);
        if (country) {
          params.set('country', country);
        }
        if (hasFilters) {
          params.set('filters', JSON.stringify(normalizedFilters));
        }
      }
      const response = await fetch(`/api/news?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load news');
      }
      return response.json();
    }
  });

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">News</h2>
        {hasCustomFeed ? (
          <span className="text-xs text-slate-500">
            {(() => {
              try {
                return new URL(trimmedRssUrl).host;
              } catch (error) {
                return 'Custom feed';
              }
            })()}
          </span>
        ) : (
          geo?.city && <span className="text-xs text-slate-500">{geo.city}</span>
        )}
      </header>
      {!hasCustomFeed && !geo && (
        <p className="text-sm text-slate-500">Select a location to see local news.</p>
      )}
      {!hasCustomFeed && geo && !query && (
        <p className="text-sm text-slate-500">We will search once you pick a place.</p>
      )}
      {hasCustomFeed && !isValidFeed && (
        <p className="text-sm text-red-600">Enter a valid RSS feed URL to load headlines.</p>
      )}
      {((hasCustomFeed && isValidFeed) || (geo && query)) && isFetching && (
        <p className="text-sm text-slate-500">Loading news…</p>
      )}
      {((hasCustomFeed && isValidFeed) || (geo && query)) && isError && (
        <div className="text-sm text-red-600">
          We could not load the latest headlines.
          <button className="ml-2 underline" onClick={() => refetch()} type="button">
            Try again
          </button>
        </div>
      )}
      {((hasCustomFeed && isValidFeed) || (geo && query)) && data && (
        <div className="flex flex-1 flex-col gap-3 text-sm">
          {!hasCustomFeed && hasFilters && (
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Filtered by: {normalizedFilters.join(', ')}
              </span>
              <button
                type="button"
                onClick={onClearFilters}
                className="font-medium text-sky-600 underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                Clear all filters
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Showing {Math.min(data.items.length, 10)} of {data.total} stories from {data.source}
          </p>
          <ul className="space-y-3">
            {data.items.slice(0, 10).map((item) => (
              <li key={item.url} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-sky-600 hover:underline"
                >
                  {item.title}
                </a>
                <p className="text-xs text-slate-500">
                  {item.source} · {formatDateTime(item.publishedAtISO)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
};

export default NewsCard;
