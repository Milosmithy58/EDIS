export type PlaceCategory = 'airport' | 'hospital' | 'police';

export type NearbyPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  address?: string;
  distance_m: number;
};

export type PlacesResponse = {
  origin: { lat: number; lon: number };
  results: Record<PlaceCategory, NearbyPlace[]>;
};
