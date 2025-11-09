import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LocationSearch, { GeoContext } from '../components/LocationSearch';
import WeatherCard from '../components/WeatherCard';
import CrimeCard from '../components/CrimeCard';
import NewsCard from '../components/NewsCard';
import { COUNTRY_OPTIONS, getDefaultCountry } from '../lib/country';

const LAST_GEO_KEY = 'edis:last-geo';

type StoredState = {
  country: string;
  geo: GeoContext;
};

const Home = () => {
  const [country, setCountry] = useState<string>(getDefaultCountry());
  const [selectedGeo, setSelectedGeo] = useState<GeoContext | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_GEO_KEY);
      if (!raw) return;
      const parsed: StoredState = JSON.parse(raw);
      if (parsed.country) {
        setCountry(parsed.country);
      }
      if (parsed.geo) {
        setSelectedGeo(parsed.geo);
      }
    } catch (error) {
      console.error('Failed to read stored location', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedGeo) return;
    try {
      const payload: StoredState = { country, geo: selectedGeo };
      localStorage.setItem(LAST_GEO_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist location', error);
      toast.error('Unable to save your last location.');
    }
  }, [selectedGeo, country]);

  const composedNewsQuery = useMemo(() => {
    if (!selectedGeo) return '';
    const segments = [selectedGeo.city, selectedGeo.admin1, selectedGeo.country];
    return segments.filter(Boolean).join(', ');
  }, [selectedGeo]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">EDIS</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Emergency Disaster Incident System
          </p>
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
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
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
            <div className="w-full lg:flex-1">
              <LocationSearch country={country} onSelect={setSelectedGeo} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <WeatherCard geo={selectedGeo} />
          <CrimeCard geo={selectedGeo} country={country} />
          <NewsCard geo={selectedGeo} query={composedNewsQuery} country={country} />
        </section>
      </main>
    </div>
  );
};

export default Home;
