import type { PlacesResponse } from 'types/places';

const MOCK_ORIGIN = { lat: 51.5074, lon: -0.1278 };

const MOCK_RESULTS: PlacesResponse['results'] = {
  airport: [
    {
      id: 'mock-airport-1',
      name: 'City Heliport',
      category: 'airport',
      lat: 51.505,
      lon: -0.089,
      address: 'Docklands, London',
      distance_m: 2800
    },
    {
      id: 'mock-airport-2',
      name: 'Regional Airfield',
      category: 'airport',
      lat: 51.521,
      lon: -0.17,
      address: 'Westminster, London',
      distance_m: 5300
    }
  ],
  hospital: [
    {
      id: 'mock-hospital-1',
      name: 'St. Mary Medical Centre',
      category: 'hospital',
      lat: 51.515,
      lon: -0.174,
      address: 'Paddington, London',
      distance_m: 4200
    },
    {
      id: 'mock-hospital-2',
      name: 'Riverside Urgent Care',
      category: 'hospital',
      lat: 51.503,
      lon: -0.09,
      address: 'South Bank, London',
      distance_m: 2100
    }
  ],
  police: [
    {
      id: 'mock-police-1',
      name: 'Central Command Station',
      category: 'police',
      lat: 51.509,
      lon: -0.134,
      address: 'Charing Cross, London',
      distance_m: 600
    },
    {
      id: 'mock-police-2',
      name: 'Neighbourhood Patrol Office',
      category: 'police',
      lat: 51.499,
      lon: -0.142,
      address: 'Victoria, London',
      distance_m: 1800
    }
  ]
};

export function buildMockPlacesResponse(address: string): PlacesResponse {
  const normalized = address.trim().length > 0 ? address.trim() : 'your selected address';

  return {
    origin: MOCK_ORIGIN,
    results: Object.fromEntries(
      Object.entries(MOCK_RESULTS).map(([category, places]) => [
        category,
        places.map((place, index) => ({
          ...place,
          name: index === 0 ? `${place.name} near ${normalized}` : place.name
        }))
      ])
    ) as PlacesResponse['results']
  };
}
