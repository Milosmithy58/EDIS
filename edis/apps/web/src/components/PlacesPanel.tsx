import type { ReactNode } from 'react';
import { usePlaces } from '../lib/queries/usePlaces';

type PlaceCategoryKey = 'airport' | 'hospital' | 'police';

type CategoryConfig = {
  key: PlaceCategoryKey;
  title: string;
  empty: ReactNode;
};

const CATEGORIES: CategoryConfig[] = [
  { key: 'airport', title: 'Airports', empty: 'No airports found in range.' },
  { key: 'hospital', title: 'Hospitals', empty: 'No hospitals found in range.' },
  { key: 'police', title: 'Police Stations', empty: 'No police stations found in range.' }
];

type PlacesPanelProps = {
  address?: string;
};

const buttonBase =
  'inline-flex items-center justify-center rounded-lg border border-sky-600 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-sky-500 dark:text-sky-200 dark:hover:bg-slate-800 min-h-[44px]';

const skeletonBox = 'h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-700';

export function PlacesPanel({ address }: PlacesPanelProps) {
  const trimmedAddress = address?.trim();
  const { data, isLoading, isError, refetch } = usePlaces(trimmedAddress);

  if (!trimmedAddress) {
    return null;
  }

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" role="presentation" aria-hidden="true">
      {CATEGORIES.map((category) => (
        <section
          key={category.key}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className={`h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-700`} />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className={skeletonBox} />
                  <div className="h-3 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="h-11 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  const renderContent = () => {
    if (!data) {
      return null;
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CATEGORIES.map((category) => {
          const items = data.results[category.key];
          return (
            <section
              key={category.key}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              aria-labelledby={`places-${category.key}`}
            >
              <h3 id={`places-${category.key}`} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {category.title}
              </h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">{category.empty}</p>
              ) : (
                <ul className="space-y-4">
                  {items.map((place) => {
                    const distanceKm = (place.distance_m / 1000).toFixed(1);
                    const destination = `${place.lat},${place.lon}`;
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                      trimmedAddress
                    )}&destination=${destination}&travelmode=driving`;

                    return (
                      <li key={place.id} className="flex flex-col gap-3" aria-label={`${place.name} ${category.title}`}>
                        <div className="flex flex-col gap-1">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{place.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-300">
                            {distanceKm} km away
                            {place.address ? <span className="ml-1 text-xs">• {place.address}</span> : null}
                          </p>
                        </div>
                        <div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className={`${buttonBase} h-11 w-full justify-center`}
                            aria-label={`Get driving directions from ${trimmedAddress} to ${place.name}`}
                          >
                            Directions
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <section
      aria-label="Nearby critical services"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Nearby Airports, Hospitals & Police
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Showing critical services closest to {trimmedAddress}.
          </p>
        </div>
        {isError ? (
          <button
            type="button"
            onClick={() => refetch()}
            className={buttonBase}
          >
            Try again
          </button>
        ) : null}
      </div>
      <div className="mt-4">
        {isLoading ? (
          renderSkeleton()
        ) : isError ? (
          <p className="text-sm text-red-600">Could not load nearby services right now.</p>
        ) : (
          renderContent()
        )}
      </div>
    </section>
  );
}

export default PlacesPanel;
