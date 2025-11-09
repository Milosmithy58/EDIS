import { describe, expect, it } from 'vitest';
import { normalizeGeo } from '../core/normalize';

describe('normalizeGeo', () => {
  it('maps partial geo to GeoContext', () => {
    const result = normalizeGeo({
      displayName: 'London, UK',
      country: 'United Kingdom',
      countryCode: 'UK',
      admin1: 'England',
      admin2: 'Greater London',
      city: 'London',
      lat: 51.5,
      lon: -0.12
    });
    expect(result).toMatchObject({
      query: 'London, UK',
      country: 'United Kingdom',
      countryCode: 'UK',
      admin1: 'England',
      city: 'London',
      lat: 51.5,
      lon: -0.12
    });
  });
});
