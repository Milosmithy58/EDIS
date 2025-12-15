import { env } from '../../core/env';
import { getKey } from '../../core/secrets/secureStore';
import { GeoContext, WeatherDTO } from '../../core/types';

export type VisualCrossingUnits = 'us' | 'uk' | 'metric';

const BASE_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services';

const METRIC_CONVERSION = {
  mphToKph: 1.60934,
  inchToMm: 25.4
};

const normalizeUnits = (units: VisualCrossingUnits): VisualCrossingUnits => {
  if (units === 'us' || units === 'uk') {
    return units;
  }
  return 'metric';
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
};

const toIsoString = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === 'string' && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
  }
  return undefined;
};

const convertTempToC = (value: number | undefined, units: VisualCrossingUnits): number => {
  if (value === undefined) {
    return 0;
  }
  if (units === 'us') {
    return ((value - 32) * 5) / 9;
  }
  return value;
};

const convertWindToKph = (value: number | undefined, units: VisualCrossingUnits): number => {
  if (value === undefined) {
    return 0;
  }
  if (units === 'us' || units === 'uk') {
    return value * METRIC_CONVERSION.mphToKph;
  }
  return value;
};

const convertPrecipToMm = (value: number | undefined, units: VisualCrossingUnits): number => {
  if (value === undefined) {
    return 0;
  }
  if (units === 'us') {
    return value * METRIC_CONVERSION.inchToMm;
  }
  return value;
};

export const buildLocationString = (geo: GeoContext): string => {
  const hasLat = Number.isFinite(geo.lat);
  const hasLon = Number.isFinite(geo.lon);
  if (hasLat && hasLon) {
    return `${geo.lat},${geo.lon}`;
  }
  const parts = [geo.city, geo.admin1, geo.countryCode || geo.country]
    .map((part) => (part ? part.trim() : ''))
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error('Unable to derive a location for Visual Crossing request');
  }
  return parts.join(',');
};

export const buildUrl = ({
  loc,
  units,
  apiKey,
  include = 'current,hours,days,alerts'
}: {
  loc: string;
  units: VisualCrossingUnits;
  apiKey: string;
  include?: string;
}): string => {
  const unitGroup = normalizeUnits(units);
  const query = [
    `unitGroup=${encodeURIComponent(unitGroup)}`,
    `include=${include}`,
    'lang=en',
    `key=${encodeURIComponent(apiKey)}`
  ].join('&');
  const encodedLoc = encodeURI(loc);
  return `${BASE_URL}/timeline/${encodedLoc}?${query}`;
};

type VisualCrossingDataPoint = Record<string, unknown>;

type VisualCrossingPayload = {
  currentConditions?: VisualCrossingDataPoint;
  days?: VisualCrossingDataPoint[];
  hours?: VisualCrossingDataPoint[];
};

export const mapToDTO = (
  payload: VisualCrossingPayload,
  units: VisualCrossingUnits,
  requestUrl?: string
): WeatherDTO => {
  const unitGroup = normalizeUnits(units);
  const current = payload?.currentConditions ?? {};
  const days: VisualCrossingDataPoint[] = Array.isArray(payload?.days) ? payload.days : [];
  const hourlyTopLevel: VisualCrossingDataPoint[] = Array.isArray(payload?.hours) ? payload.hours : [];
  const hourlyFromDays = days.flatMap((day) =>
    Array.isArray(day?.hours) ? (day.hours as VisualCrossingDataPoint[]) : []
  );
  const hours = (hourlyTopLevel.length > 0 ? hourlyTopLevel : hourlyFromDays).slice(0, 24);
  const updatedISO = toIsoString(current.datetimeEpoch ?? current.datetime);

  const daily = days.slice(0, 7).map((day) => {
    const dateISO = toIsoString(day?.datetimeEpoch ?? day?.datetime) ?? new Date().toISOString();
    const maxC = convertTempToC(toNumberOrUndefined(day?.tempmax), unitGroup);
    const minC = convertTempToC(toNumberOrUndefined(day?.tempmin), unitGroup);
    const precipMm = convertPrecipToMm(toNumberOrUndefined(day?.precip), unitGroup);
    const summary = String(day?.description || day?.conditions || 'Weather summary unavailable');
    return {
      dateISO,
      maxC,
      minC,
      precipMm,
      summary
    };
  });

  const hourly = hours.map((hour) => {
    const timeISO = toIsoString(hour?.datetimeEpoch ?? hour?.datetime) ?? new Date().toISOString();
    const tempC = convertTempToC(toNumberOrUndefined(hour?.temp), unitGroup);
    const precipMm = convertPrecipToMm(toNumberOrUndefined(hour?.precip), unitGroup);
    const windKph = convertWindToKph(toNumberOrUndefined(hour?.windspeed), unitGroup);
    return {
      timeISO,
      tempC,
      precipMm,
      windKph
    };
  });

  const weather: WeatherDTO = {
    current: {
      tempC: convertTempToC(toNumberOrUndefined(current?.temp), unitGroup),
      windKph: convertWindToKph(toNumberOrUndefined(current?.windspeed), unitGroup),
      conditions: String(current?.conditions || 'Unknown conditions'),
      icon: current?.icon ? String(current.icon) : undefined
    },
    hourly,
    daily,
    meta: {
      source: 'visualcrossing',
      sourceLabel: 'Visual Crossing',
      url: requestUrl,
      updatedISO
    }
  };

  return weather;
};

export const getWeatherVC = async (
  geo: GeoContext,
  units: VisualCrossingUnits = 'metric'
): Promise<WeatherDTO> => {
  const apiKey = (await getKey('visualcrossing')) ?? env.VISUALCROSSING_API_KEY;
  if (!apiKey) {
    throw new Error('VISUALCROSSING_API_KEY missing. Set the key before using Visual Crossing.');
  }
  const loc = buildLocationString(geo);
  const url = buildUrl({ loc, units, apiKey });
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const error = new Error(`Visual Crossing request failed: ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const payload = await response.json();
  return mapToDTO(payload, units, url);
};
