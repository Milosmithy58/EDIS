import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findNearbyPlacesMock = vi.fn();

vi.mock('../adapters/places/overpass', () => ({
  findNearbyPlaces: findNearbyPlacesMock
}));

const loadApp = async () => {
  vi.resetModules();
  const mod = await import('../index');
  return mod.default;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  vi.resetModules();
});

describe('GET /api/places', () => {
  it('requires an address parameter', async () => {
    const app = await loadApp();

    const response = await request(app).get('/api/places');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('address required');
    expect(findNearbyPlacesMock).not.toHaveBeenCalled();
  });

  it('rejects invalid radius values', async () => {
    const app = await loadApp();

    const response = await request(app)
      .get('/api/places')
      .query({ address: 'NYC', radius_km: '-10' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('radius_km must be a positive number');
    expect(findNearbyPlacesMock).not.toHaveBeenCalled();
  });

  it('returns nearby places for a valid query', async () => {
    findNearbyPlacesMock.mockResolvedValue({
      origin: { lat: 40.7128, lon: -74.006 },
      results: {
        airport: [
          {
            id: 'node/1',
            name: 'Airport One',
            category: 'airport',
            lat: 40.7,
            lon: -73.9,
            distance_m: 1000
          }
        ],
        hospital: [],
        police: []
      }
    });

    const app = await loadApp();

    const response = await request(app)
      .get('/api/places')
      .query({ address: 'New York, NY', radius_km: '15' });

    expect(response.status).toBe(200);
    expect(findNearbyPlacesMock).toHaveBeenCalledWith('New York, NY', 15);
    expect(response.body.origin.lat).toBeCloseTo(40.7128);
    expect(response.body.results.airport[0].name).toBe('Airport One');
  });

  it('wraps adapter errors', async () => {
    findNearbyPlacesMock.mockRejectedValue(new Error('Adapter failure'));

    const app = await loadApp();

    const response = await request(app).get('/api/places').query({ address: 'Boston, MA' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('PLACES_ERROR');
    expect(response.body.message).toBe('Adapter failure');
  });
});
