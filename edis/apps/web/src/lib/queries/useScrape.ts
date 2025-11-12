import { useQuery } from '@tanstack/react-query';

export function useScrape(searchText: string, filters: string[], lat?: number, lon?: number) {
  return useQuery({
    queryKey: ['scrape', searchText, filters.slice().sort().join(','), lat, lon],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchText) params.set('q', searchText);
      if (lat !== undefined && lon !== undefined) {
        params.set('lat', String(lat));
        params.set('lon', String(lon));
      }
      if (filters.length) params.set('filters', filters.join(','));
      const res = await fetch(`/api/scrape?${params.toString()}`);
      if (!res.ok) throw new Error(`Scrape failed: ${res.status}`);
      return res.json();
    },
    enabled: !!searchText || (lat !== undefined && lon !== undefined)
  });
}
