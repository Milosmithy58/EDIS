import { useEffect, useMemo, useState } from 'react';
import type { GeoContext } from './LocationSearch';

const SUPPORTED_TIMEZONES: string[] =
  typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [];

type ClockDescriptor = {
  label: string;
  timeZone?: string | null;
  highlight?: boolean;
  description?: string;
  muted?: boolean;
};

const formatLabel = (geo: GeoContext | null) => {
  if (!geo) {
    return 'Searched Place';
  }
  return geo.city || geo.admin1 || geo.country || geo.query;
};

const sanitize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const buildOffsetZone = (lon: number | undefined) => {
  if (!Number.isFinite(lon)) {
    return null;
  }
  const offsetHours = Math.round((lon ?? 0) / 15);
  if (offsetHours === 0) {
    return 'Etc/UTC';
  }
  const sign = offsetHours > 0 ? '-' : '+';
  return `Etc/GMT${sign}${Math.abs(offsetHours)}`;
};

const resolveTimeZone = (geo: GeoContext | null) => {
  if (!geo) {
    return null;
  }
  const candidates = [geo.city, geo.admin1, geo.admin2, geo.country];
  const normalizedZones = SUPPORTED_TIMEZONES.map((zone) => ({
    zone,
    normalized: sanitize(zone)
  }));
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalizedCandidate = sanitize(candidate);
    if (!normalizedCandidate) continue;
    const match = normalizedZones.find((item) => item.normalized.includes(normalizedCandidate));
    if (match) {
      return match.zone;
    }
  }
  return buildOffsetZone(geo.lon);
};

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
};

const formatDigitalTime = (date: Date, timeZone?: string | null) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timeZone || undefined
    }).format(date);
  } catch (error) {
    console.warn('Unable to format time for zone', timeZone, error);
    return '— — : — —';
  }
};

const WorldClockBar = ({ geo }: { geo: GeoContext | null }) => {
  const now = useNow();
  const searchTimeZone = useMemo(() => resolveTimeZone(geo), [geo]);
  const selectedLabel = useMemo(() => formatLabel(geo), [geo]);

  const clocks: ClockDescriptor[] = [
    { label: 'Los Angeles', timeZone: 'America/Los_Angeles' },
    { label: 'New York', timeZone: 'America/New_York' },
    { label: 'London', timeZone: 'Europe/London' },
    { label: 'Local Time', timeZone: undefined, highlight: true, description: 'Your device time' },
    { label: selectedLabel, timeZone: geo ? searchTimeZone : null, muted: !geo }
  ];

  const australiaClock: ClockDescriptor = {
    label: 'Australia',
    timeZone: 'Australia/Sydney'
  };

  const allClocks = [...clocks, australiaClock];

  return (
    <section className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 text-slate-900 shadow-inner dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Global clocks
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {allClocks.map((clock) => (
            <div
              key={clock.label}
              className={[
                'flex flex-col rounded-xl border px-3 py-2 shadow-sm transition',
                clock.highlight
                  ? 'border-sky-500 bg-sky-600 text-white shadow-md'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
                clock.muted ? 'opacity-60' : ''
              ].join(' ')}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {clock.label}
              </span>
              <span
                className={`font-mono text-2xl tabular-nums ${clock.highlight ? 'text-white' : 'text-slate-900 dark:text-slate-50'}`}
              >
                {clock.muted && !clock.timeZone ? 'Select a place' : formatDigitalTime(now, clock.timeZone)}
              </span>
              {clock.description && !clock.muted && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{clock.description}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorldClockBar;
