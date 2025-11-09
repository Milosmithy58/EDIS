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
};

type Props = {
  geo: GeoContext | null;
  country: string;
};

const CrimeCard = ({ geo, country }: Props) => {
  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<CrimeDTO | { message: string }>({
    queryKey: ['crime', geo?.lat, geo?.lon, country, geo?.admin1, geo?.city],
    enabled: Boolean(geo),
    queryFn: async () => {
      const params = new URLSearchParams({
        country,
        lat: String(geo!.lat),
        lon: String(geo!.lon)
      });
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
          {chart}
          <ul className="mt-2 space-y-1 text-xs">
            {data.totalsByCategory.map((item) => (
              <li key={item.category} className="flex justify-between">
                <span>{item.category}</span>
                <span className="font-medium">{item.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
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
