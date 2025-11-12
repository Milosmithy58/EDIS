import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findNearbyPlaces } from '../places/overpass';

describe('findNearbyPlaces', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('geocodes and returns sorted nearby places per category', async () => {
    const geocodeResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue([{ lat: '40.0', lon: '-74.0' }])
    } as unknown as Response;

    const overpassResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        elements: [
          {
            id: 1,
            type: 'node',
            lat: 40.1,
            lon: -73.9,
            tags: { amenity: 'hospital', name: 'Hospital C' }
          },
          {
            id: 2,
            type: 'node',
            lat: 40.05,
            lon: -73.98,
            tags: { amenity: 'hospital', name: 'Hospital A' }
          },
          {
            id: 3,
            type: 'node',
            lat: 40.07,
            lon: -73.97,
            tags: { amenity: 'hospital', name: 'Hospital B' }
          },
          {
            id: 4,
            type: 'node',
            center: { lat: 40.2, lon: -73.8 },
            tags: { aeroway: 'aerodrome', name: 'Airport One', 'addr:city': 'Metropolis' }
          },
          {
            id: 5,
            type: 'node',
            center: { lat: 40.3, lon: -73.7 },
            tags: { amenity: 'police', name: 'Precinct 99', 'addr:street': 'Main St' }
          }
        ]
      })
    } as unknown as Response;

    (global.fetch as unknown as vi.Mock)
      .mockResolvedValueOnce(geocodeResponse)
      .mockResolvedValueOnce(overpassResponse);

    const result = await findNearbyPlaces('New York, NY', 10);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.origin).toEqual({ lat: 40, lon: -74 });
    expect(result.results.hospital).toHaveLength(3);
    expect(result.results.hospital[0].name).toBe('Hospital A');
    expect(result.results.hospital[1].name).toBe('Hospital B');
    expect(result.results.hospital[2].name).toBe('Hospital C');
    expect(result.results.airport[0].address).toContain('Metropolis');
    expect(result.results.police[0].address).toContain('Main St');
  });

  it('throws when address is blank', async () => {
    await expect(findNearbyPlaces('   ')).rejects.toThrow('Address is required');
  });
});
