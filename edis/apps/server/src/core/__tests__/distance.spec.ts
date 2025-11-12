import { describe, expect, it } from 'vitest';
import { haversineMeters } from '../distance';

describe('haversineMeters', () => {
  it('returns zero for identical coordinates', () => {
    const value = haversineMeters({ lat: 51.5, lon: -0.12 }, { lat: 51.5, lon: -0.12 });
    expect(value).toBeCloseTo(0, 5);
  });

  it('calculates known distance between cities', () => {
    // Approximate distance between New York City and Los Angeles ~ 3936000 meters
    const value = haversineMeters({ lat: 40.7128, lon: -74.006 }, { lat: 34.0522, lon: -118.2437 });
    expect(value).toBeGreaterThan(3_900_000);
    expect(value).toBeLessThan(4_000_000);
  });
});
