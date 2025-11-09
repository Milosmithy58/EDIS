import { env } from '../../core/env';
import { fetchJson, toQueryString } from '../../core/fetcher';
import { CrimeDTO } from '../../core/types';

const BASE_URL = 'https://api.usa.gov/crime/fbi/sapi/api';

type EstimationResponse = {
  results: Array<{
    year: number;
    violent_crime?: number;
    homicide?: number;
    robbery?: number;
    aggravated_assault?: number;
    property_crime?: number;
    burglary?: number;
    larceny?: number;
    motor_vehicle_theft?: number;
  }>;
};

export const getCrimeForState = async (stateAbbr: string): Promise<CrimeDTO> => {
  if (!env.FBI_CRIME_API_KEY) {
    throw new Error('FBI_CRIME_API_KEY missing.');
  }
  const params = toQueryString({
    page: 1,
    per_page: 1
  });
  const response = await fetchJson<EstimationResponse>(
    `${BASE_URL}/estimation/state/${stateAbbr}?${params}`,
    {
      headers: {
        'X-API-Key': env.FBI_CRIME_API_KEY
      }
    }
  );
  const latest = response.results?.[0];
  if (!latest) {
    throw new Error('No FBI crime data found for state');
  }
  const totals: { category: string; count: number }[] = [
    { category: 'Violent crime', count: latest.violent_crime ?? 0 },
    { category: 'Homicide', count: latest.homicide ?? 0 },
    { category: 'Robbery', count: latest.robbery ?? 0 },
    { category: 'Aggravated assault', count: latest.aggravated_assault ?? 0 },
    { category: 'Property crime', count: latest.property_crime ?? 0 },
    { category: 'Burglary', count: latest.burglary ?? 0 },
    { category: 'Larceny', count: latest.larceny ?? 0 },
    { category: 'Motor vehicle theft', count: latest.motor_vehicle_theft ?? 0 }
  ].filter((item) => item.count > 0);

  return {
    period: `${latest.year}`,
    totalsByCategory: totals,
    total: totals.reduce((sum, item) => sum + item.count, 0),
    source: 'FBI Crime Data Explorer',
    url: 'https://crime-data-explorer.app.cloud.gov/pages/explorer/crime/crime-trend'
  };
};
