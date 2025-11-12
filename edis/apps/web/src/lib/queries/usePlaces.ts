import { useQuery } from '@tanstack/react-query';

type PlaceCategory = 'airport' | 'hospital' | 'police';

type NearbyPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  address?: string;
  distance_m: number;
};

type PlacesResponse = {
  origin: { lat: number; lon: number };
  results: Record<PlaceCategory, NearbyPlace[]>;
};

export function usePlaces(address?: string) {
  return useQuery<PlacesResponse>({
    queryKey: ['places', address],
    enabled: Boolean(address && address.trim().length > 0),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const params = new URLSearchParams({ address: address ?? '' });
      const response = await fetch(`/api/places?${params.toString()}`);

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Places request failed (${response.status})`);
      }

      return response.json() as Promise<PlacesResponse>;
    }
  });
}
