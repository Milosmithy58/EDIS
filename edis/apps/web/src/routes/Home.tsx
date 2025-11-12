import { ReactNode, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LocationSearch, { GeoContext } from '../components/LocationSearch';
import LocationMap from '../components/LocationMap';
import WeatherCard from '../components/WeatherCard';
import CrimeCard from '../components/CrimeCard';
import CrimeNewsCard from '../components/CrimeNewsCard';
import NewsCard from '../components/NewsCard';
import FemaIncidentsCard from '../components/fema/FemaIncidentsCard';
import LocalTicketsCard from '../components/LocalTicketsCard';
import FilterPanel from '../components/FilterPanel';
import PlacesPanel from '../components/PlacesPanel';
import MapboxTabs from '../components/MapboxTabs';
import { DEFAULT_FILTERS, FILTER_STORAGE_KEY, normalizeFilters } from '../lib/newsFilters';
import { resolveUsStateCode } from '../lib/usStates';
import { useDebounce } from '../lib/useDebounce';

const LAST_GEO_KEY = 'edis:last-geo';

type StoredState = {
  geo?: GeoContext;
};

type HomeProps = {
  adminNav?: ReactNode;
};

const Home = ({ adminNav }: HomeProps) => {
  const [selectedGeo, setSelectedGeo] = useState<GeoContext | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_GEO_KEY);
      if (!raw) return;
      const parsed: StoredState = JSON.parse(raw);
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
      const payload: StoredState = {};
      if (selectedGeo) {
        payload.geo = selectedGeo;
      }
      localStorage.setItem(LAST_GEO_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist location', error);
      toast.error('Unable to save your last location.');
    }
  }, [selectedGeo]);

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
  const activeFilterCount = useMemo(() => normalizeFilters(selectedFilters).length, [selectedFilters]);

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

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterOpen]);

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
            Search by country, region, city, or a specific address. Results power the weather, crime, and news cards below.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <div className="w-full">
              <LocationSearch onSelect={setSelectedGeo} />
            </div>
            <LocationMap geo={selectedGeo} />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-1 rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-sky-500">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
          <section className="grid gap-6 lg:grid-cols-3">
            <WeatherCard geo={selectedGeo} />
            <CrimeCard geo={selectedGeo} />
            <div className="flex flex-col gap-4">
              <NewsCard
                geo={selectedGeo}
                query={composedNewsQuery}
                filters={debouncedFilters}
                onClearFilters={handleClearFilters}
                onRemoveFilter={handleRemoveFilter}
              />
              <CrimeNewsCard location={selectedGeo ? composedNewsQuery : ''} />
              <FemaIncidentsCard state={femaStateCode} county={femaCounty} />
              <LocalTicketsCard geo={selectedGeo} />
            </div>
          </section>

          <PlacesPanel address={selectedGeo?.query} />
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Map</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Toggle overlays to explore live traffic, points of interest, and transit context on demand.
            </p>
            <div className="mt-4">
              <MapboxTabs />
            </div>
          </section>
        </section>
      </main>
      {isFilterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setIsFilterOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter news topics"
            className="relative z-10 w-full max-w-3xl space-y-3"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <FilterPanel
              selected={selectedFilters}
              onChange={handleFiltersChange}
              className="max-h-[70vh] overflow-y-auto"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Home;
