import { useQuery } from '@tanstack/react-query';
import { GeoContext } from './LocationSearch';
import { formatDate, formatDateTime, formatPrecip, formatTemperature, formatWind } from '../lib/format';

type WeatherDTO = {
  current: {
    tempC: number;
    windKph: number;
    conditions: string;
    icon?: string;
  };
  hourly: Array<{
    timeISO: string;
    tempC: number;
    precipMm: number;
    windKph: number;
  }>;
  daily: Array<{
    dateISO: string;
    maxC: number;
    minC: number;
    precipMm: number;
    summary: string;
  }>;
};

type Props = {
  geo: GeoContext | null;
};

const WeatherCard = ({ geo }: Props) => {
  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<WeatherDTO>({
    queryKey: ['weather', geo?.lat, geo?.lon],
    enabled: Boolean(geo),
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(geo!.lat),
        lon: String(geo!.lon)
      });
      const response = await fetch(`/api/weather?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load weather');
      }
      return response.json();
    }
  });

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Weather</h2>
        {geo?.city && <span className="text-xs text-slate-500">{geo.city}</span>}
      </header>
      {!geo && <p className="text-sm text-slate-500">Select a location to see weather details.</p>}
      {geo && isFetching && <p className="text-sm text-slate-500">Loading weather…</p>}
      {geo && isError && (
        <div className="text-sm text-red-600">
          We hit a snag.
          <button className="ml-2 underline" onClick={() => refetch()} type="button">
            Try again
          </button>
        </div>
      )}
      {geo && data && (
        <div className="flex flex-1 flex-col gap-4">
          <section>
            <p className="text-4xl font-semibold text-slate-900 dark:text-slate-100">
              {formatTemperature(data.current.tempC)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-300">{data.current.conditions}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Wind {formatWind(data.current.windKph)}
            </p>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Next hours</h3>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {data.hourly.slice(0, 6).map((hour) => (
                <li
                  key={hour.timeISO}
                  className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
                  aria-label={`Weather at ${formatDateTime(hour.timeISO)}`}
                >
                  <p className="font-medium">{new Date(hour.timeISO).getHours()}:00</p>
                  <p>{formatTemperature(hour.tempC)}</p>
                  <p className="text-slate-500">
                    Rain {formatPrecip(hour.precipMm)} · Wind {formatWind(hour.windKph)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Next 7 days</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {data.daily.slice(0, 7).map((day) => (
                <li key={day.dateISO} className="flex justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div>
                    <p className="font-medium">{formatDate(day.dateISO)}</p>
                    <p className="text-xs text-slate-500">{day.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatTemperature(day.maxC)} / {formatTemperature(day.minC)}
                    </p>
                    <p className="text-xs text-slate-500">Rain {formatPrecip(day.precipMm)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
};

export default WeatherCard;
