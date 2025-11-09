import { fetchJson, toQueryString } from '../../core/fetcher';
import { CrimeDTO } from '../../core/types';

const BASE_URL = 'https://data.police.uk/api';

type CrimeRecord = {
  category: string;
};

type LastUpdated = {
  date: string;
};

export const getCrime = async (lat: number, lon: number): Promise<CrimeDTO> => {
  const lastUpdated = await fetchJson<LastUpdated>(`${BASE_URL}/crime-last-updated`);
  const period = lastUpdated.date.slice(0, 7);
  const params = toQueryString({
    lat,
    lng: lon,
    date: period
  });
  const crimes = await fetchJson<CrimeRecord[]>(`${BASE_URL}/crimes-street/all-crime?${params}`);
  const totalsByCategory: Record<string, number> = {};
  crimes.forEach((crime) => {
    totalsByCategory[crime.category] = (totalsByCategory[crime.category] ?? 0) + 1;
  });
  const totalsArray = Object.entries(totalsByCategory)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    period,
    totalsByCategory: totalsArray,
    total: crimes.length,
    source: 'data.police.uk',
    url: 'https://data.police.uk/'
  };
};
