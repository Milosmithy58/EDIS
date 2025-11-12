import { useMemo, useState } from 'react';
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
  onSelect: (geo: GeoContext | null) => void;
};

type GeocodeResponse = {
  results: GeoContext[];
};

const MIN_QUERY_LENGTH = 2;

const LocationSearch = ({ onSelect }: Props) => {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data,
    isFetching,
    isError,
    refetch
  } = useQuery<GeocodeResponse>({
    queryKey: ['geocode', searchQuery],
    enabled: searchQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const params = new URLSearchParams({
        query: searchQuery
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
    const formattedQuery = geo.query.trim();
    setQuery(formattedQuery);
    setSearchQuery(formattedQuery);
  };

  const handleSearch = () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
      setSearchQuery(trimmedQuery);
    }
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
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Search for Canada, Paris, or 1600 Pennsylvania Ave..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800"
            aria-autocomplete="list"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={query.trim().length < MIN_QUERY_LENGTH || isFetching}
            className="rounded-lg border border-sky-500 px-3 py-2 text-sm font-medium text-sky-600 transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent dark:border-sky-400 dark:text-sky-300 dark:hover:bg-slate-800 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
          >
            Search
          </button>
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
        {!isFetching && !isError && suggestions.length === 0 && searchQuery && (
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
