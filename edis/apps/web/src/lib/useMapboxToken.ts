import { useEffect, useMemo, useState } from 'react';

type TokenState = {
  token: string | null;
  isLoading: boolean;
  error?: string;
};

/**
 * Reads the Mapbox token from:
 * 1) Vite env (VITE_MAPBOX_TOKEN) at build time
 * 2) Fallback: backend GET /api/config/mapbox-token (JSON: { token: string })
 */
export function useMapboxToken(): TokenState {
  const envToken = useMemo(() => {
    return import.meta.env?.VITE_MAPBOX_TOKEN as string | undefined;
  }, []);

  const [state, setState] = useState<TokenState>({
    token: envToken ?? null,
    isLoading: !envToken,
  });

  useEffect(() => {
    if (envToken) {
      setState({ token: envToken, isLoading: false });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/config/mapbox-token', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { token?: string };
        if (!cancelled) {
          setState({
            token: data.token ?? null,
            isLoading: false,
            error: data.token ? undefined : 'No token returned by backend',
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({ token: null, isLoading: false, error: err?.message || 'Failed to load token' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [envToken]);

  return state;
}
