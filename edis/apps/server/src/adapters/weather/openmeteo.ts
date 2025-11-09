import { fetchJson, toQueryString } from '../../core/fetcher';
import { WeatherDTO } from '../../core/types';

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

export const getWeather = async (lat: number, lon: number): Promise<WeatherDTO> => {
  const params = toQueryString({
    latitude: lat,
    longitude: lon,
    current_weather: 'true',
    hourly: 'temperature_2m,precipitation,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
    timezone: 'auto'
  });
  const payload = await fetchJson<{
    current_weather?: { temperature?: number; windspeed?: number; weathercode?: number };
    current_weather_units?: { windspeed?: string };
    hourly?: { time?: string[]; temperature_2m?: number[]; precipitation?: number[]; wind_speed_10m?: number[] };
    hourly_units?: { wind_speed_10m?: string };
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      weathercode?: number[];
    };
  }>(`https://api.open-meteo.com/v1/forecast?${params}`);
  const hourlyTimes: string[] = payload.hourly?.time ?? [];
  const hourlyTemps: number[] = payload.hourly?.temperature_2m ?? [];
  const hourlyPrecip: number[] = payload.hourly?.precipitation ?? [];
  const hourlyWind: number[] = payload.hourly?.wind_speed_10m ?? [];
  const dailyTimes: string[] = payload.daily?.time ?? [];
  const dailyMax: number[] = payload.daily?.temperature_2m_max ?? [];
  const dailyMin: number[] = payload.daily?.temperature_2m_min ?? [];
  const dailyPrecip: number[] = payload.daily?.precipitation_sum ?? [];
  const dailyCodes: number[] = payload.daily?.weathercode ?? [];
  const hourlyWindUnit: string | undefined = payload.hourly_units?.wind_speed_10m;
  const currentWindUnit: string | undefined = payload.current_weather_units?.windspeed;

  const hourlyWindFactor = hourlyWindUnit === 'm/s' ? 3.6 : 1;
  const currentWindFactor = currentWindUnit === 'm/s' ? 3.6 : 1;

  return {
    current: {
      tempC: payload.current_weather?.temperature ?? 0,
      windKph: (payload.current_weather?.windspeed ?? 0) * currentWindFactor,
      conditions: WEATHER_CODES[payload.current_weather?.weathercode ?? 0] ?? 'Unknown conditions',
      icon: undefined
    },
    hourly: hourlyTimes.map((time, index) => ({
      timeISO: time,
      tempC: hourlyTemps[index],
      precipMm: hourlyPrecip[index],
      windKph: (hourlyWind[index] ?? 0) * hourlyWindFactor
    })),
    daily: dailyTimes.map((time, index) => ({
      dateISO: time,
      maxC: dailyMax[index],
      minC: dailyMin[index],
      precipMm: dailyPrecip[index],
      summary: WEATHER_CODES[dailyCodes[index] ?? 0] ?? 'Weather summary unavailable'
    }))
  };
};
