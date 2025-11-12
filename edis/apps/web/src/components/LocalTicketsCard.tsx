import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { GeoContext } from './LocationSearch';

export type TicketDTO = {
  id: string;
  source: {
    id: string;
    name: string;
    url: string;
  };
  title: string;
  description?: string;
  category: 'Transport' | 'Utilities' | 'Council' | 'Police' | 'Health' | 'Weather' | 'Other';
  severity?: 'info' | 'minor' | 'moderate' | 'major' | 'critical';
  status?: 'open' | 'ongoing' | 'resolved' | 'planned';
  startedAt?: string;
  updatedAt?: string;
  location?: { name?: string; lat?: number; lon?: number };
  areaTags?: string[];
  url: string;
};

type ErrorDTO = {
  code?: string;
  message: string;
  source?: string;
  status: number;
};

type TicketsResponse = {
  tickets: TicketDTO[];
  source_errors?: ErrorDTO[];
};

type Props = {
  geo: GeoContext | null;
};

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: TicketsResponse };

const severityStyles: Record<NonNullable<TicketDTO['severity']>, string> = {
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  minor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  major: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'
};

const formatDateTime = (iso?: string) => {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    }).format(new Date(iso));
  } catch (error) {
    console.warn('Unable to format ticket timestamp', error);
    return undefined;
  }
};

const buildQuery = (geo: GeoContext) => {
  const params = new URLSearchParams();
  if (geo.countryCode) params.set('countryCode', geo.countryCode);
  if (geo.admin1) params.set('admin1', geo.admin1);
  if (geo.admin2) params.set('admin2', geo.admin2);
  if (geo.city) params.set('city', geo.city);
  params.set('lat', String(geo.lat));
  params.set('lon', String(geo.lon));
  return params.toString();
};

const LocalTicketsCard = ({ geo }: Props) => {
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!geo) {
      setState({ status: 'idle' });
      controllerRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const load = async () => {
      setState({ status: 'loading' });
      try {
        const query = buildQuery(geo);
        const response = await fetch(`/api/tickets?${query}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('Failed to load service notices');
        }
        const payload: TicketsResponse = await response.json();
        setState({ status: 'success', data: payload });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        console.error('Failed to load tickets', error);
        setState({ status: 'error', message: 'Unable to load local notices.' });
      }
    };
    void load();

    return () => {
      controller.abort();
    };
  }, [geo]);

  const tickets = useMemo(() => {
    if (state.status !== 'success') return [] as TicketDTO[];
    return state.data.tickets ?? [];
  }, [state]);

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label="Local service notices"
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Local tickets &amp; notices
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Aggregated local transport, council, and utilities disruptions scraped from official sources.
        </p>
      </header>
      {!geo && (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Select a location to see local tickets and service notices.
        </p>
      )}
      {geo && state.status === 'loading' && (
        <p className="text-sm text-slate-500 dark:text-slate-300">Loading notices…</p>
      )}
      {geo && state.status === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {geo && state.status === 'success' && tickets.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          No active notices for this area right now.
        </p>
      )}
      {geo && tickets.length > 0 && (
        <ul className="flex flex-col gap-3" role="list">
          {tickets.map((ticket) => {
            const severityLabel = ticket.severity ? ticket.severity.toUpperCase() : undefined;
            const updatedLabel = formatDateTime(ticket.updatedAt || ticket.startedAt);
            return (
              <li
                key={ticket.id}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-sky-400 focus-within:border-sky-500 dark:border-slate-700 dark:hover:border-sky-500"
              >
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noreferrer"
                  className="focus:outline-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {ticket.title}
                      </h3>
                      {ticket.description && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ticket.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {ticket.severity && (
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase',
                            severityStyles[ticket.severity]
                          )}
                        >
                          {severityLabel}
                        </span>
                      )}
                      {ticket.status && (
                        <span className="text-xs uppercase text-slate-500 dark:text-slate-400">{ticket.status}</span>
                      )}
                      {updatedLabel && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">Updated {updatedLabel}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{ticket.source.name}</span>
                    {ticket.category ? <span>· {ticket.category}</span> : null}
                    {ticket.areaTags && ticket.areaTags.length > 0 ? (
                      <span>· {ticket.areaTags.slice(0, 2).join(', ')}</span>
                    ) : null}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
};

export default LocalTicketsCard;
