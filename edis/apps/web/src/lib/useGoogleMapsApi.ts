import { useEffect, useMemo, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

export type GoogleMapsNamespace = typeof google;

type GoogleMapsState = {
  googleMaps: GoogleMapsNamespace | null;
  isLoading: boolean;
  error?: string;
};

async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  const loader = new Loader({ apiKey, libraries: ['places'] });
  const googleMaps = await loader.load();
  return googleMaps;
}

/**
 * Loads the Google Maps JS API.
 * Primary source: Vite env (VITE_GOOGLE_MAPS_API_KEY)
 * Fallback: GET /api/config/google-maps-key (JSON: { key: string })
 */
export function useGoogleMapsApi(): GoogleMapsState {
  const envKey = useMemo(() => import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined, []);
  const [state, setState] = useState<GoogleMapsState>({ googleMaps: null, isLoading: !envKey });

  useEffect(() => {
    if (envKey) {
      loadGoogleMaps(envKey)
        .then((googleMaps) => setState({ googleMaps, isLoading: false }))
        .catch((error: Error) => setState({ googleMaps: null, isLoading: false, error: error.message }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/config/google-maps-key', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { key?: string };
        if (!data.key) throw new Error('No key returned by backend');
        const googleMaps = await loadGoogleMaps(data.key);
        if (!cancelled) {
          setState({ googleMaps, isLoading: false });
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({ googleMaps: null, isLoading: false, error: err?.message || 'Failed to load Google Maps' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [envKey]);

  return state;
}
