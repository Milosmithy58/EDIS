import { useQuery } from '@tanstack/react-query';
import { fetchCrimeNews } from '../lib/api';

type CrimeNewsCardProps = {
  location: string;
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

const CrimeNewsCard = ({ location }: CrimeNewsCardProps) => {
  const isEnabled = Boolean(location);
  const query = useQuery({
    queryKey: ['crime-news', location],
    queryFn: () => fetchCrimeNews(location, ['crime', 'security'], 25),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000
  });

  if (!location) {
    return null;
  }

  if (query.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">Loading crime news…</div>;
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-sm dark:border-red-800 dark:bg-slate-900">
        Failed to load crime news.
      </div>
    );
  }

  const items = query.data?.items ?? [];
  const count = query.data?.count ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Crime &amp; Security ({count})</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">No recent crime headlines for this area.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-slate-200 pb-3 last:border-b-0 dark:border-slate-800">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-slate-900 hover:underline dark:text-slate-100"
              >
                {item.title}
              </a>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {item.source} • {formatDate(item.published || item.scraped_at)}
              </div>
              {item.summary ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CrimeNewsCard;
