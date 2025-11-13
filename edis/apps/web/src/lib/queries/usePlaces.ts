import { useQuery } from '@tanstack/react-query';
import { buildMockPlacesResponse } from 'mocks/places';
import type { PlacesResponse } from 'types/places';

export function usePlaces(address?: string) {
  return useQuery<PlacesResponse>({
    queryKey: ['places', address],
    enabled: Boolean(address && address.trim().length > 0),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const params = new URLSearchParams({ address: address ?? '' });

      try {
        const response = await fetch(`/api/places?${params.toString()}`);

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Places request failed (${response.status})`);
        }

        return (await response.json()) as PlacesResponse;
      } catch (error) {
        console.warn('Using mock places data', error);
        return buildMockPlacesResponse(address ?? '');
      }
    }
  });
}
