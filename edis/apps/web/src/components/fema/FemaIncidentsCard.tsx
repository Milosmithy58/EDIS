import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../../lib/format';

type FemaDisasterDTO = {
  disasterNumber: number;
  declarationType: 'DR' | 'EM' | 'FM' | string;
  state: string;
  county: string | null;
  title: string | null;
  incidentBeginDate: string | null;
  incidentEndDate: string | null;
  declarationDate: string | null;
  placeCodes?: string[];
};

type DisasterResponse = {
  items: FemaDisasterDTO[];
  page: number;
  pageSize: number;
  total?: number;
};

type Props = {
  state?: string | null;
  county?: string | null;
};

const TYPE_OPTIONS = [
  { label: 'Major Disaster (DR)', value: 'DR', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  { label: 'Emergency (EM)', value: 'EM', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  { label: 'Fire Mgmt (FM)', value: 'FM', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' }
] as const;

const SINCE_OPTIONS = [
  { label: 'Past 7 days', value: '7', days: 7 },
  { label: 'Past 30 days', value: '30', days: 30 },
  { label: 'Past 90 days', value: '90', days: 90 },
  { label: 'Past year', value: '365', days: 365 }
] as const;

const formatRelativeTime = (iso: string | null) => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const seconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(seconds);
  if (absSeconds < 60) {
    return rtf.format(seconds, 'second');
  }

  const minutes = Math.round(diffMs / (1000 * 60));
  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, 'minute');
  }

  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, 'hour');
  }

  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (Math.abs(days) < 14) {
    return rtf.format(days, 'day');
  }

  const weeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
  if (Math.abs(weeks) < 10) {
    return rtf.format(weeks, 'week');
  }

  const months = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
  if (Math.abs(months) < 18) {
    return rtf.format(months, 'month');
  }

  const years = Math.round(diffMs / (1000 * 60 * 60 * 24 * 365));
  return rtf.format(years, 'year');
};

const computeSinceDate = (days: number) => {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() - days);
  return utc.toISOString().slice(0, 10);
};

const normalizeCounty = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildLocationLabel = (item: FemaDisasterDTO) => {
  const parts = [item.county ?? undefined, item.state].filter(Boolean);
  return parts.join(', ');
};

const getBadgeClass = (type: string) => {
  const option = TYPE_OPTIONS.find((entry) => entry.value === type);
  return option?.badge ?? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
};

const typeLabel = (type: string) => {
  const option = TYPE_OPTIONS.find((entry) => entry.value === type);
  if (option) return option.value;
  return type;
};

const deriveTypeDescription = (type: string) => {
  const option = TYPE_OPTIONS.find((entry) => entry.value === type);
  if (!option) return type;
  return option.label;
};

const toFemaUrl = (disasterNumber: number) => `https://www.fema.gov/disaster/${disasterNumber}`;

const FemaIncidentsCard = ({ state, county }: Props) => {
  const [sinceValue, setSinceValue] = useState<(typeof SINCE_OPTIONS)[number]['value']>('30');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(TYPE_OPTIONS.map((option) => option.value));
  const [page, setPage] = useState(1);

  const normalizedState = state?.trim().toUpperCase();
  const normalizedCounty = useMemo(() => normalizeCounty(county), [county]);

  const sinceIso = useMemo(() => {
    const option = SINCE_OPTIONS.find((entry) => entry.value === sinceValue) ?? SINCE_OPTIONS[1];
    return computeSinceDate(option.days);
  }, [sinceValue]);

  const typesKey = useMemo(() => selectedTypes.slice().sort().join(','), [selectedTypes]);

  useEffect(() => {
    setPage(1);
  }, [normalizedState, normalizedCounty, sinceIso, typesKey]);

  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<DisasterResponse>({
    queryKey: ['fema-disasters', normalizedState, normalizedCounty, sinceIso, typesKey, page],
    enabled: Boolean(normalizedState),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      if (!normalizedState) {
        return { items: [], page: 1, pageSize: 25 };
      }
      const params = new URLSearchParams();
      params.set('state', normalizedState);
      params.set('since', sinceIso);
      params.set('limit', '25');
      params.set('page', String(page));
      if (normalizedCounty) {
        params.set('county', normalizedCounty);
      }
      if (selectedTypes.length > 0) {
        params.set('types', selectedTypes.join(','));
      }
      const response = await fetch(`/api/fema/disasters?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load FEMA disasters');
      }
      return response.json();
    }
  });

  const items = data?.items ?? [];
  const total = data?.total;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const canGoBack = page > 1;
  const canGoForward = totalPages ? page < totalPages : items.length === pageSize;

  const handleTypeToggle = (value: string) => {
    setSelectedTypes((prev) => {
      const hasValue = prev.includes(value);
      if (hasValue) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  const handlePrev = () => {
    if (!canGoBack) return;
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    if (!canGoForward) return;
    setPage((prev) => prev + 1);
  };

  const shouldShowContent = Boolean(normalizedState);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">FEMA Incidents</h2>
        {normalizedState ? (
          <span className="text-xs text-slate-500">{normalizedState}</span>
        ) : null}
      </header>
      {!normalizedState && (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Select a U.S. location to view recent FEMA disaster declarations.
        </p>
      )}
      {shouldShowContent && (
        <div className="mb-4 flex flex-col gap-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="fema-since">
              Since
              <select
                id="fema-since"
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900"
                value={sinceValue}
                onChange={(event) => setSinceValue(event.target.value as (typeof SINCE_OPTIONS)[number]['value'])}
              >
                {SINCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-wrap gap-2" aria-label="Disaster types">
              {TYPE_OPTIONS.map((option) => {
                const isChecked = selectedTypes.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-400 focus-within:border-sky-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-500"
                      checked={isChecked}
                      onChange={() => handleTypeToggle(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </fieldset>
          </div>
          {normalizedCounty && (
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Filtering incidents near {normalizedCounty} when available.
            </p>
          )}
        </div>
      )}
      {shouldShowContent && isFetching && items.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-300">Loading incidents…</p>
      )}
      {shouldShowContent && isError && (
        <div className="text-sm text-red-600 dark:text-red-400">
          We could not load FEMA incidents.
          <button className="ml-2 underline" onClick={() => refetch()} type="button">
            Try again
          </button>
        </div>
      )}
      {shouldShowContent && !isFetching && !isError && items.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-300">No recent declarations for this area.</p>
      )}
      {shouldShowContent && items.length > 0 && (
        <div className="flex flex-1 flex-col">
          <ul className="flex-1 space-y-3 overflow-auto pr-1">
            {items.map((item) => (
              <li
                key={`${item.disasterNumber}-${item.declarationDate ?? 'unknown'}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClass(item.declarationType)}`}>
                    {typeLabel(item.declarationType)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    {formatRelativeTime(item.declarationDate)}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title || `Declaration #${item.disasterNumber}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  {buildLocationLabel(item)}
                </p>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Incident: {item.incidentBeginDate ? formatDate(item.incidentBeginDate) : 'Unknown start'} →{' '}
                  {item.incidentEndDate ? formatDate(item.incidentEndDate) : 'Ongoing'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
                  <span>{deriveTypeDescription(item.declarationType)}</span>
                  <a
                    href={toFemaUrl(item.disasterNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-600 underline dark:text-sky-300"
                  >
                    View on FEMA
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300 sm:flex-row">
            <span>
              Page {page}
              {totalPages ? ` of ${totalPages}` : ''}
              {total ? ` • ${total.toLocaleString()} total` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canGoBack}
                className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition enabled:hover:border-sky-400 enabled:hover:text-sky-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:enabled:hover:border-sky-400"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoForward}
                className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition enabled:hover:border-sky-400 enabled:hover:text-sky-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:enabled:hover:border-sky-400"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

export default FemaIncidentsCard;
