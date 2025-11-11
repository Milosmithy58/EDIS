import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const coreEnvMock = vi.hoisted(() => ({
  flags: { openWeather: false, newsApi: false, weatherProvider: 'visualcrossing' as 'visualcrossing' | 'openmeteo' | 'openweather' | undefined },
  newsProvider: 'gnews' as 'gnews' | 'newsapi' | 'webzio',
  env: {
    PORT: 0,
    NODE_ENV: 'test',
    ADMIN_TOKEN: 'test-admin-token',
    SECRETBOX_KEY: Buffer.from('abcdefghijklmnopqrstuvwxyz123456').toString('base64'),
    KEYS_STORE_PATH: './secrets/test-keys.enc',
    GNEWS_API_KEY: undefined,
    NEWSAPI_API_KEY: undefined,
    OPENWEATHER_API_KEY: undefined,
    MAPBOX_TOKEN: undefined,
    FBI_CRIME_API_KEY: undefined,
    DEFAULT_COUNTRY: 'UK',
    ENABLE_OPENWEATHER: undefined,
    ENABLE_NEWSAPI: undefined,
    NEWS_PROVIDER: 'gnews' as 'gnews' | 'newsapi' | 'webzio',
    WEATHER_PROVIDER: 'visualcrossing' as 'visualcrossing' | 'openmeteo' | 'openweather' | undefined,
    WEBZIO_TOKEN: 'token',
    VISUALCROSSING_API_KEY: undefined
  }
}));

const getKeyMock = vi.fn();
const getWeatherVCMock = vi.fn();
const getWeatherOMMock = vi.fn();
const getWeatherOpenWeatherMock = vi.fn();

vi.mock('../core/env', () => coreEnvMock);
vi.mock('../core/secrets/secureStore', () => ({
  getKey: getKeyMock,
  setKey: vi.fn()
}));
vi.mock('../adapters/weather/visualcrossing', () => ({
  getWeatherVC: getWeatherVCMock,
  VisualCrossingUnits: undefined
}));
vi.mock('../adapters/weather/openmeteo', () => ({
  getWeatherOM: getWeatherOMMock
}));
vi.mock('../adapters/weather/openweather', () => ({
  getWeather: getWeatherOpenWeatherMock
}));

const loadApp = async () => {
  vi.resetModules();
  const mod = await import('../index');
  return mod.default;
};

afterEach(() => {
  vi.clearAllMocks();
  coreEnvMock.flags.weatherProvider = 'visualcrossing';
  coreEnvMock.env.WEATHER_PROVIDER = 'visualcrossing';
  coreEnvMock.env.VISUALCROSSING_API_KEY = undefined;
});

describe('GET /api/weather', () => {
  it('falls back to Open-Meteo when Visual Crossing key is unavailable', async () => {
    getKeyMock.mockResolvedValue(undefined);
    getWeatherOMMock.mockResolvedValue({
      current: { tempC: 10, windKph: 5, conditions: 'Clear' },
      hourly: [],
      daily: [],
      meta: { source: 'openmeteo', sourceLabel: 'Open-Meteo' }
    });
    const app = await loadApp();

    const response = await request(app).get('/api/weather').query({ lat: '51.5', lon: '-0.12' });

    expect(response.status).toBe(200);
    expect(getWeatherOMMock).toHaveBeenCalledTimes(1);
    expect(getWeatherOMMock).toHaveBeenCalledWith(expect.objectContaining({ lat: 51.5, lon: -0.12 }), 'metric');
    expect(getWeatherVCMock).not.toHaveBeenCalled();
    expect(response.body.meta?.source).toBe('openmeteo');
  });
});
