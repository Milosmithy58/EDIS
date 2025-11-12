import { useEffect, useMemo, useState } from 'react';
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
  total?: number;
  source: string;
  next?: string;
  notice?: string;
  cached?: boolean;
};

type Props = {
  geo: GeoContext | null;
  query: string;
  filters: string[];
  onClearFilters: () => void;
  onRemoveFilter: (label: string) => void;
};

const NewsCard = ({ geo, query, filters, onClearFilters, onRemoveFilter }: Props) => {
  const normalizedFilters = normalizeFilters(filters);
  const serializedFilters = serializeFilters(filters);
  const hasFilters = normalizedFilters.length > 0;
  const [ts, setTs] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<NewsDTO['items']>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const countryCode = useMemo(() => geo?.countryCode?.toUpperCase(), [geo?.countryCode]);

  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<NewsDTO>({
    queryKey: [
      'news',
      query,
      countryCode,
      serializedFilters,
      geo?.lat,
      geo?.lon,
      geo?.city,
      geo?.admin1,
      ts
    ],
    enabled: Boolean(query) && Boolean(geo),
    queryFn: async () => {
      const payload: { query: string; filters: string[]; country?: string; ts?: number } = {
        query,
        filters: normalizedFilters
      };
      if (countryCode) {
        payload.country = countryCode;
      }
      if (typeof ts === 'number') {
        payload.ts = ts;
      }
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Failed to load news');
      }
      return response.json();
    }
  });

  useEffect(() => {
    if (!data) {
      setResults([]);
      setNextCursor(null);
      setNotice(undefined);
      return;
    }
    setResults(data.items);
    setNextCursor(data.next ?? null);
    setNotice(data.notice);
  }, [data]);

  useEffect(() => {
    setResults([]);
    setNextCursor(null);
    setNotice(undefined);
    setLoadMoreError(null);
  }, [query, serializedFilters, geo?.lat, geo?.lon, geo?.city, geo?.admin1, countryCode, ts]);

  const totalStories = data?.total ?? results.length;

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await fetch(`/api/news?next=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) {
        throw new Error('Failed to load more news');
      }
      const payload: NewsDTO = await response.json();
      setResults((prev) => [...prev, ...payload.items]);
      setNextCursor(payload.next ?? null);
      if (payload.notice) {
        setNotice(payload.notice);
      }
    } catch (error) {
      console.error(error);
      setLoadMoreError('We could not load more headlines just now.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadOlder = () => {
    setTs(Date.now() - 30 * 24 * 60 * 60 * 1000);
  };

  const handleReturnToLatest = () => {
    setTs(undefined);
  };

  const shouldShowContent = Boolean(geo && query);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">News</h2>
        {geo?.city && <span className="text-xs text-slate-500">{geo.city}</span>}
      </header>
      {!geo && (
        <p className="text-sm text-slate-500">Select a location to see local news.</p>
      )}
      {geo && !query && (
        <p className="text-sm text-slate-500">We will search once you pick a place.</p>
      )}
      {shouldShowContent && isFetching && (
        <p className="text-sm text-slate-500">Loading news…</p>
      )}
      {shouldShowContent && isError && (
        <div className="text-sm text-red-600">
          We could not load the latest headlines.
          <button className="ml-2 underline" onClick={() => refetch()} type="button">
            Try again
          </button>
        </div>
      )}
      {shouldShowContent && data && (
        <div className="flex flex-1 flex-col gap-3 text-sm">
          {hasFilters && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-600 dark:text-slate-300">Filtered by</span>
                {normalizedFilters.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onRemoveFilter(label)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    aria-label={`Remove filter ${label}`}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onClearFilters}
                className="font-medium text-sky-600 underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                Clear all filters
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {results.length} of {totalStories} stories from {data.source}
            </span>
            {notice && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{notice}</span>}
            {data.cached && !notice && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">Cached</span>
            )}
          </div>
          {geo && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {ts ? (
                <button
                  type="button"
                  onClick={handleReturnToLatest}
                  className="rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Back to latest
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  className="rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Older (30d)
                </button>
              )}
              {loadMoreError && <span className="text-red-600">{loadMoreError}</span>}
            </div>
          )}
          <ul className="space-y-3">
            {results.map((item) => (
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
          {nextCursor && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {isLoadingMore ? 'Loading…' : 'Load more (10)'}
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default NewsCard;
