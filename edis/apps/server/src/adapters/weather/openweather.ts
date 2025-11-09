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
  const payload = await fetchJson<any>(`https://api.openweathermap.org/data/3.0/onecall?${params}`);
  return {
    current: {
      tempC: payload.current?.temp ?? 0,
      windKph: (payload.current?.wind_speed ?? 0) * 3.6,
      conditions: payload.current?.weather?.[0]?.description ?? 'Unknown conditions',
      icon: payload.current?.weather?.[0]?.icon
    },
    hourly: (payload.hourly ?? []).map((hour: any) => ({
      timeISO: new Date(hour.dt * 1000).toISOString(),
      tempC: hour.temp,
      precipMm: (hour.rain?.['1h'] ?? 0) + (hour.snow?.['1h'] ?? 0),
      windKph: (hour.wind_speed ?? 0) * 3.6
    })),
    daily: (payload.daily ?? []).map((day: any) => ({
      dateISO: new Date(day.dt * 1000).toISOString(),
      maxC: day.temp?.max,
      minC: day.temp?.min,
      precipMm: (day.rain ?? 0) + (day.snow ?? 0),
      summary: day.weather?.[0]?.description ?? 'No summary'
    }))
  };
};
