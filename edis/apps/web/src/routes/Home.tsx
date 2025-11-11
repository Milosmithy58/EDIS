import { ReactNode, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LocationSearch, { GeoContext } from '../components/LocationSearch';
import WeatherCard from '../components/WeatherCard';
import CrimeCard from '../components/CrimeCard';
import NewsCard from '../components/NewsCard';
import FemaIncidentsCard from '../components/fema/FemaIncidentsCard';
import { COUNTRY_OPTIONS, getDefaultCountry } from '../lib/country';
import FilterPanel from '../components/FilterPanel';
import { DEFAULT_FILTERS, FILTER_STORAGE_KEY, normalizeFilters } from '../lib/newsFilters';
import { resolveUsStateCode } from '../lib/usStates';
import { useDebounce } from '../lib/useDebounce';

const LAST_GEO_KEY = 'edis:last-geo';

type StoredState = {
  country: string;
  geo?: GeoContext;
};

type HomeProps = {
  adminNav?: ReactNode;
};

const Home = ({ adminNav }: HomeProps) => {
  const [country, setCountry] = useState<string>(getDefaultCountry());
  const [selectedGeo, setSelectedGeo] = useState<GeoContext | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(DEFAULT_FILTERS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_GEO_KEY);
      if (!raw) return;
      const parsed: StoredState = JSON.parse(raw);
      if (parsed.country) {
        setCountry(parsed.country);
      }
      setSelectedGeo(parsed.geo ?? null);
    } catch (error) {
      console.error('Failed to read stored location', error);
    }
  }, []);

  useEffect(() => {
    try {
      const rawFilters = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!rawFilters) {
        return;
      }
      const parsed = JSON.parse(rawFilters);
      if (Array.isArray(parsed)) {
        setSelectedFilters(normalizeFilters(parsed));
      }
    } catch (error) {
      console.error('Failed to read stored filters', error);
    }
  }, []);

  useEffect(() => {
    try {
      if (!selectedGeo) {
        localStorage.removeItem(LAST_GEO_KEY);
        return;
      }
      const payload: StoredState = { country };
      if (selectedGeo) {
        payload.geo = selectedGeo;
      }
      localStorage.setItem(LAST_GEO_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist location', error);
      toast.error('Unable to save your last location.');
    }
  }, [selectedGeo, country]);

  useEffect(() => {
    try {
      const normalized = normalizeFilters(selectedFilters);
      if (normalized.length === 0) {
        localStorage.removeItem(FILTER_STORAGE_KEY);
        return;
      }
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.error('Failed to persist news filters', error);
    }
  }, [selectedFilters]);

  const composedNewsQuery = useMemo(() => {
    if (!selectedGeo) return '';
    const segments = [selectedGeo.city, selectedGeo.admin1, selectedGeo.country];
    return segments.filter(Boolean).join(', ');
  }, [selectedGeo]);

  const debouncedFilters = useDebounce(selectedFilters, 300);

  const handleFiltersChange = (next: string[]) => {
    setSelectedFilters(normalizeFilters(next));
  };

  const femaStateCode = useMemo(() => {
    if (!selectedGeo) return null;
    const countryCode = selectedGeo.countryCode?.toUpperCase();
    if (countryCode !== 'US' && countryCode !== 'USA') {
      return null;
    }
    return resolveUsStateCode(selectedGeo.admin1);
  }, [selectedGeo]);

  const femaCounty = useMemo(() => {
    if (!selectedGeo) return undefined;
    if (!femaStateCode) return undefined;
    const candidates = [selectedGeo.admin2, selectedGeo.admin1].filter(Boolean) as string[];
    for (const value of candidates) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (lower.includes('county') || lower.includes('parish') || lower.includes('borough') || lower.includes('census area') || lower.includes('municipio')) {
        return trimmed;
      }
    }
    const fallback = selectedGeo.admin2?.trim();
    return fallback && fallback.length > 0 ? fallback : undefined;
  }, [selectedGeo, femaStateCode]);

  const handleClearFilters = () => {
    setSelectedFilters([]);
  };

  const handleRemoveFilter = (label: string) => {
    setSelectedFilters((prev) => normalizeFilters(prev.filter((item) => item !== label)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">EDIS</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Emergency Disaster Incident System
            </p>
          </div>
          {adminNav ? <div className="flex items-center gap-3">{adminNav}</div> : null}
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Find an area
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Search by town, city, county, or state. Results power the weather, crime, and news cards below.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <div className="w-full lg:w-1/4">
              <label
                className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300"
                htmlFor="country-select"
              >
                Country
              </label>
              <select
                id="country-select"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <LocationSearch country={country} onSelect={setSelectedGeo} />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(240px,280px)_1fr]">
          <FilterPanel selected={selectedFilters} onChange={handleFiltersChange} />
          <div className="flex flex-col gap-6">
            <section className="grid gap-6 lg:grid-cols-3">
              <WeatherCard geo={selectedGeo} />
              <CrimeCard geo={selectedGeo} country={country} />
              <div className="flex flex-col gap-4">
                <NewsCard
                  geo={selectedGeo}
                  query={composedNewsQuery}
                  country={country}
                  filters={debouncedFilters}
                  onClearFilters={handleClearFilters}
                  onRemoveFilter={handleRemoveFilter}
                />
                <FemaIncidentsCard state={femaStateCode} county={femaCounty} />
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
