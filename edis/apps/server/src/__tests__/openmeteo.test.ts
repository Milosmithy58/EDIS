import { describe, expect, it, vi, afterEach } from 'vitest';
import { getWeatherOM } from '../adapters/weather/openmeteo';
import type { GeoContext } from '../core/types';

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('open-meteo adapter', () => {
  it('normalizes weather payload', async () => {
    const mockResponse = {
      current_weather: {
        temperature: 12.3,
        windspeed: 5,
        weathercode: 2
      },
      current_weather_units: {
        windspeed: 'km/h'
      },
      hourly: {
        time: ['2024-01-01T00:00', '2024-01-01T01:00'],
        temperature_2m: [12, 11],
        precipitation: [0.1, 0.0],
        wind_speed_10m: [5, 6]
      },
      hourly_units: {
        wind_speed_10m: 'km/h'
      },
      daily: {
        time: ['2024-01-01'],
        temperature_2m_max: [14],
        temperature_2m_min: [8],
        precipitation_sum: [2],
        weathercode: [2]
      }
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as unknown as Response)
    );

    const geo: GeoContext = {
      query: 'London',
      country: 'UK',
      countryCode: 'GB',
      lat: 51.5,
      lon: -0.12
    };
    const result = await getWeatherOM(geo, 'metric');
    expect(result.current.tempC).toBe(12.3);
    expect(result.current.windKph).toBe(5);
    expect(result.current.conditions).toContain('Partly');
    expect(result.hourly).toHaveLength(2);
    expect(result.daily[0].maxC).toBe(14);
  });
});
