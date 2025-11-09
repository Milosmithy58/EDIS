import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export type GeoContext = {
  query: string;
  country: string;
  countryCode: string;
  admin1?: string;
  admin2?: string;
  city?: string;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
};

type Props = {
  country: string;
  onSelect: (geo: GeoContext | null) => void;
};

type GeocodeResponse = {
  results: GeoContext[];
};

const SCOPE_OPTIONS = [
  { label: 'City / Town', value: 'city' },
  { label: 'County / State', value: 'admin', description: 'Counties (UK) or States (US)' },
  { label: 'Country', value: 'country' }
];

const MIN_QUERY_LENGTH = 2;

const LocationSearch = ({ country, onSelect }: Props) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('city');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setQuery('');
    setDebouncedQuery('');
  }, [country]);

  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<GeocodeResponse>({
    queryKey: ['geocode', debouncedQuery, country, scope],
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const params = new URLSearchParams({
        query: debouncedQuery,
        country,
        scope
      });
      const response = await fetch(`/api/geocode?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to search locations');
      }
      return response.json();
    }
  });

  const suggestions = useMemo(() => data?.results ?? [], [data]);

  const handleSelect = (geo: GeoContext) => {
    onSelect(geo);
    setQuery(geo.query);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude)
          });
          const response = await fetch(`/api/geocode?${params.toString()}`);
          if (!response.ok) {
            throw new Error('Failed to reverse geocode location');
          }
          const payload: GeocodeResponse = await response.json();
          const first = payload.results[0];
          if (first) {
            onSelect(first);
            setQuery(first.query);
          } else {
            toast.error('We could not find details for your location.');
          }
        } catch (error) {
          console.error(error);
          toast.error('Unable to use your location.');
        }
      },
      (error) => {
        console.error(error);
        toast.error('Permission denied for location.');
      }
    );
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="location-search">
        Location search
      </label>
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="flex-1">
          <input
            id="location-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for London, New York..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800"
            aria-autocomplete="list"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            aria-label="Location scope"
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="rounded-lg border border-sky-500 px-3 py-2 text-sm font-medium text-sky-600 transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-sky-400 dark:text-sky-300 dark:hover:bg-slate-800"
          >
            Use my location
          </button>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {isFetching && (
          <p className="p-3 text-sm text-slate-500 dark:text-slate-300">Searching...</p>
        )}
        {isError && (
          <div className="p-3 text-sm text-red-600">
            Something went wrong.{' '}
            <button className="underline" type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}
        {!isFetching && !isError && suggestions.length === 0 && debouncedQuery && (
          <p className="p-3 text-sm text-slate-500 dark:text-slate-300">No matches yet.</p>
        )}
        <ul role="listbox" className="divide-y divide-slate-100 dark:divide-slate-700">
          {suggestions.map((result) => (
            <li key={`${result.lat}-${result.lon}-${result.query}`}>
              <button
                type="button"
                onClick={() => handleSelect(result)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-sky-50 focus:bg-sky-100 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                role="option"
                aria-selected={false}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{result.query}</span>
                <span className="text-xs text-slate-500 dark:text-slate-300">
                  {result.country}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LocationSearch;
