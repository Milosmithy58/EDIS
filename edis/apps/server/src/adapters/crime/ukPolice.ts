import { fetchJson, toQueryString } from '../../core/fetcher';
import { CrimeDTO } from '../../core/types';

const BASE_URL = 'https://data.police.uk/api';

type CrimeRecord = {
  category: string;
  location?: {
    street?: {
      name?: string;
    };
  };
};

type LastUpdated = {
  date: string;
};

type OutcomeRecord = {
  outcome_status?: {
    category?: string | null;
  } | null;
};

type NeighbourhoodLookup = {
  force: string;
  neighbourhood: string;
};

type ForceDetails = {
  id: string;
  name?: string;
  url?: string | null;
};

type NeighbourhoodDetails = {
  id: string;
  name?: string;
  url_force?: string | null;
  website?: string | null;
};

export const getCrime = async (lat: number, lon: number): Promise<CrimeDTO> => {
  const lastUpdated = await fetchJson<LastUpdated>(`${BASE_URL}/crime-last-updated`);
  const period = lastUpdated.date.slice(0, 7);
  const params = toQueryString({
    lat,
    lng: lon,
    date: period
  });
  const [crimes, outcomes, neighbourhood] = await Promise.all([
    fetchJson<CrimeRecord[]>(`${BASE_URL}/crimes-street/all-crime?${params}`),
    fetchJson<OutcomeRecord[]>(`${BASE_URL}/outcomes-at-location?${params}`).catch(() => []),
    fetchJson<NeighbourhoodLookup>(`${BASE_URL}/locate-neighbourhood?q=${lat},${lon}`).catch(
      () => null
    )
  ]);
  const totalsByCategory: Record<string, number> = {};
  const totalsByLocation: Record<string, number> = {};
  crimes.forEach((crime) => {
    totalsByCategory[crime.category] = (totalsByCategory[crime.category] ?? 0) + 1;
    const street = crime.location?.street?.name?.trim();
    if (street) {
      totalsByLocation[street] = (totalsByLocation[street] ?? 0) + 1;
    }
  });
  const totalsArray = Object.entries(totalsByCategory)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const locationArray = Object.entries(totalsByLocation)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const outcomesByCategory = Array.isArray(outcomes)
    ? Object.entries(
        outcomes.reduce<Record<string, number>>((acc, outcome) => {
          const key = outcome.outcome_status?.category?.trim();
          if (!key) return acc;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {})
      )
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  let forceDetails: CrimeDTO['force'] = null;
  if (neighbourhood?.force) {
    const [forceInfo, neighbourhoodInfo] = await Promise.all([
      fetchJson<ForceDetails>(`${BASE_URL}/forces/${neighbourhood.force}`).catch(() => null),
      neighbourhood.neighbourhood
        ? fetchJson<NeighbourhoodDetails>(
            `${BASE_URL}/forces/${neighbourhood.force}/neighbourhoods/${neighbourhood.neighbourhood}`
          ).catch(() => null)
        : Promise.resolve(null)
    ]);

    forceDetails = {
      id: neighbourhood.force,
      name: forceInfo?.name ?? neighbourhood.force,
      url: forceInfo?.url ?? null,
      neighbourhood: neighbourhood.neighbourhood
        ? {
            id: neighbourhood.neighbourhood,
            name: neighbourhoodInfo?.name,
            url: neighbourhoodInfo?.website ?? neighbourhoodInfo?.url_force ?? null
          }
        : null
    };
  }

  return {
    period,
    totalsByCategory: totalsArray,
    total: crimes.length,
    source: 'data.police.uk',
    url: 'https://data.police.uk/',
    topLocations: locationArray,
    outcomesByCategory,
    force: forceDetails
  };
};
