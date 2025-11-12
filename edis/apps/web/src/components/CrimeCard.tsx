import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scaleBand, scaleLinear } from 'd3-scale';
import { GeoContext } from './LocationSearch';

type CrimeDTO = {
  period: string;
  totalsByCategory: Array<{
    category: string;
    count: number;
  }>;
  total: number;
  source: string;
  url?: string;
  topLocations?: Array<{
    name: string;
    count: number;
  }>;
  outcomesByCategory?: Array<{
    category: string;
    count: number;
  }>;
  force?: {
    id: string;
    name?: string;
    url?: string | null;
    neighbourhood?: {
      id: string;
      name?: string;
      url?: string | null;
    } | null;
  } | null;
};

type Props = {
  geo: GeoContext | null;
};

const CrimeCard = ({ geo }: Props) => {
  const country = useMemo(() => {
    const code = geo?.countryCode?.toUpperCase();
    if (!code) return undefined;
    if (code === 'GB' || code === 'UK') return 'UK';
    if (code === 'US' || code === 'USA') return 'US';
    return code;
  }, [geo?.countryCode]);

  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<CrimeDTO | { message: string }>({
    queryKey: ['crime', geo?.lat, geo?.lon, country ?? 'unknown', geo?.admin1, geo?.city],
    enabled: Boolean(geo),
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(geo!.lat),
        lon: String(geo!.lon)
      });
      if (country) {
        params.append('country', country);
      }
      if (geo?.admin1) params.append('admin1', geo.admin1);
      if (geo?.city) params.append('city', geo.city);
      const response = await fetch(`/api/crime?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load crime data');
      }
      return response.json();
    }
  });

  const chartData = useMemo(() => {
    if (!data || 'message' in data) return null;
    return data.totalsByCategory.slice(0, 6);
  }, [data]);

  const shouldShowUkCrimeMap = country === 'UK' && Boolean(geo);
  const ukCrimeMapUrl =
    'https://www.police.uk/pu/your-area/metropolitan-police-service/junction/?tab=CrimeMap';

  const chart = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const width = 280;
    const height = 160;
    const x = scaleBand()
      .domain(chartData.map((d) => d.category))
      .range([0, width])
      .padding(0.2);
    const y = scaleLinear()
      .domain([0, Math.max(...chartData.map((d) => d.count)) || 1])
      .range([height, 0]);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label="Crime by category">
        {chartData.map((d) => {
          const xVal = x(d.category);
          if (xVal === undefined) return null;
          return (
            <g key={d.category} transform={`translate(${xVal}, 0)`}>
              <rect
                x={0}
                y={y(d.count)}
                width={x.bandwidth()}
                height={height - y(d.count)}
                className="fill-sky-500 dark:fill-sky-300"
              />
              <text
                x={x.bandwidth() / 2}
                y={height - 4}
                textAnchor="middle"
                className="text-[9px] fill-slate-600 dark:fill-slate-200"
              >
                {d.category.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }, [chartData]);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Crime</h2>
        {geo?.city && <span className="text-xs text-slate-500">{geo.city}</span>}
      </header>
      {!geo && <p className="text-sm text-slate-500">Select a location to see crime statistics.</p>}
      {geo && isFetching && <p className="text-sm text-slate-500">Loading crime data…</p>}
      {geo && isError && (
        <div className="text-sm text-red-600">
          We could not load crime data.
          <button className="ml-2 underline" onClick={() => refetch()} type="button">
            Try again
          </button>
        </div>
      )}
      {geo && data && 'message' in data && (
        <p className="text-sm text-slate-500">{data.message}</p>
      )}
      {geo && data && !('message' in data) && (
        <div className="flex flex-1 flex-col gap-3 text-sm">
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{data.total.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Incidents in {data.period}</p>
          {data.force && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Local policing team</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {data.force.url ? (
                  <a
                    href={data.force.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 underline"
                  >
                    {data.force.name ?? data.force.id}
                  </a>
                ) : (
                  data.force.name ?? data.force.id
                )}
              </p>
              {data.force.neighbourhood && (
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Neighbourhood:{' '}
                  {data.force.neighbourhood.url ? (
                    <a
                      href={data.force.neighbourhood.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 underline"
                    >
                      {data.force.neighbourhood.name ?? data.force.neighbourhood.id}
                    </a>
                  ) : (
                    data.force.neighbourhood.name ?? data.force.neighbourhood.id
                  )}
                </p>
              )}
            </div>
          )}
          {chart}
          <ul className="mt-2 space-y-1 text-xs">
            {data.totalsByCategory.map((item) => (
              <li key={item.category} className="flex justify-between">
                <span>{item.category}</span>
                <span className="font-medium">{item.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {data.topLocations && data.topLocations.length > 0 && (
            <div>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Top streets</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {data.topLocations.map((item) => (
                  <li key={item.name} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="font-medium">{item.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.outcomesByCategory && data.outcomesByCategory.length > 0 && (
            <div>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Case outcomes</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {data.outcomesByCategory.map((item) => (
                  <li key={item.category} className="flex justify-between">
                    <span>{item.category}</span>
                    <span className="font-medium">{item.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {shouldShowUkCrimeMap && (
            <div className="mt-4 space-y-2">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <iframe
                  src={ukCrimeMapUrl}
                  title="UK crime map"
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="text-xs text-slate-500">
                Crime map provided by{' '}
                <a
                  href="https://www.police.uk/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 underline"
                >
                  police.uk
                </a>
              </p>
            </div>
          )}
          <p className="mt-auto text-xs text-slate-500">
            Source:{' '}
            {data.url ? (
              <a
                href={data.url}
                className="text-sky-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {data.source}
              </a>
            ) : (
              data.source
            )}
          </p>
        </div>
      )}
    </article>
  );
};

export default CrimeCard;
