import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoContext } from '../core/types';

const loadModule = async () => {
  vi.resetModules();
  process.env.VISUALCROSSING_API_KEY = 'test-key';
  return import('../adapters/weather/visualcrossing');
};

afterEach(() => {
  delete process.env.VISUALCROSSING_API_KEY;
});

describe('visual crossing adapter', () => {
  it('builds timeline URL from place components', async () => {
    const { buildLocationString, buildUrl } = await loadModule();
    const geo: GeoContext = {
      query: 'London, UK',
      country: 'United Kingdom',
      countryCode: 'UK',
      admin1: 'England',
      city: 'London',
      lat: Number.NaN,
      lon: Number.NaN
    };
    const loc = buildLocationString(geo);
    expect(loc).toBe('London,England,UK');
    const url = buildUrl({ loc, units: 'metric' });
    expect(url).toBe(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/London,England,UK?unitGroup=metric&include=current,hours,days,alerts&lang=en&key=test-key'
    );
  });

  it('builds timeline URL from lat/lon', async () => {
    const { buildLocationString, buildUrl } = await loadModule();
    const geo: GeoContext = {
      query: 'London, UK',
      country: 'United Kingdom',
      countryCode: 'UK',
      admin1: 'England',
      city: 'London',
      lat: 51.5074,
      lon: -0.1278
    };
    const loc = buildLocationString(geo);
    expect(loc).toBe('51.5074,-0.1278');
    const url = buildUrl({ loc, units: 'metric' });
    expect(url).toBe(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=metric&include=current,hours,days,alerts&lang=en&key=test-key'
    );
  });

  it('normalizes API payload to WeatherDTO', async () => {
    const { mapToDTO } = await loadModule();
    const payload = {
      currentConditions: {
        temp: 68,
        windspeed: 10,
        conditions: 'Partly Cloudy',
        icon: 'partly-cloudy-day',
        datetimeEpoch: 1_620_000_000
      },
      days: [
        {
          datetimeEpoch: 1_620_000_000,
          tempmax: 77,
          tempmin: 59,
          precip: 0.1,
          description: 'Pleasant day',
          hours: [
            {
              datetimeEpoch: 1_620_000_000,
              temp: 68,
              precip: 0.1,
              windspeed: 10
            },
            {
              datetimeEpoch: 1_620_003_600,
              temp: 70,
              precip: 0,
              windspeed: 12
            }
          ]
        }
      ]
    };

    const dto = mapToDTO(payload, 'us', 'https://example.com');
    expect(dto.current.tempC).toBeCloseTo(20, 1);
    expect(dto.current.windKph).toBeCloseTo(16.09, 2);
    expect(dto.hourly).toHaveLength(2);
    expect(dto.hourly[0].precipMm).toBeCloseTo(2.54, 2);
    expect(dto.daily[0].maxC).toBeCloseTo(25, 1);
    expect(dto.meta?.source).toBe('visualcrossing');
    expect(dto.meta?.sourceLabel).toBe('Visual Crossing');
    expect(dto.meta?.updatedISO).toBe('2021-05-03T00:00:00.000Z');
    expect(dto.meta?.url).toBe('https://example.com');
  });
});
