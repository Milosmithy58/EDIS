import { env } from '../../core/env';
import { fetchJson, toQueryString } from '../../core/fetcher';
import { WeatherDTO } from '../../core/types';

export const getWeather = async (lat: number, lon: number): Promise<WeatherDTO> => {
  if (!env.OPENWEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY missing. Enable OpenWeather only when a key is provided.');
  }
  const params = toQueryString({
    lat,
    lon,
    units: 'metric',
    appid: env.OPENWEATHER_API_KEY,
    exclude: 'minutely'
  });
  const payload = await fetchJson<{
    current?: {
      temp?: number;
      wind_speed?: number;
      weather?: { description?: string; icon?: string }[];
    };
    hourly?: Array<{
      dt: number;
      temp: number;
      wind_speed?: number;
      rain?: { '1h'?: number };
      snow?: { '1h'?: number };
      weather?: { description?: string }[];
    }>;
    daily?: Array<{
      dt: number;
      temp?: { max?: number; min?: number };
      rain?: number;
      snow?: number;
      weather?: { description?: string }[];
    }>;
  }>(`https://api.openweathermap.org/data/3.0/onecall?${params}`);
  return {
    current: {
      tempC: payload.current?.temp ?? 0,
      windKph: (payload.current?.wind_speed ?? 0) * 3.6,
      conditions: payload.current?.weather?.[0]?.description ?? 'Unknown conditions',
      icon: payload.current?.weather?.[0]?.icon
    },
    hourly: (payload.hourly ?? []).map((hour) => ({
      timeISO: new Date(hour.dt * 1000).toISOString(),
      tempC: hour.temp,
      precipMm: (hour.rain?.['1h'] ?? 0) + (hour.snow?.['1h'] ?? 0),
      windKph: (hour.wind_speed ?? 0) * 3.6
    })),
    daily: (payload.daily ?? []).map((day) => ({
      dateISO: new Date(day.dt * 1000).toISOString(),
      maxC: day.temp?.max ?? 0,
      minC: day.temp?.min ?? 0,
      precipMm: (day.rain ?? 0) + (day.snow ?? 0),
      summary: day.weather?.[0]?.description ?? 'No summary'
    }))
  };
};
