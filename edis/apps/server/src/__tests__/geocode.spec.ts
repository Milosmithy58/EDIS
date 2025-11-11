import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocode } from '../adapters/geocode/nominatim';

const buildResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response);

describe('nominatim geocode adapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns direct coordinates when the query is a lat,lon pair', async () => {
    const result = await geocode('51.5014,-0.1419');
    expect(result).not.toBeNull();
    expect(result?.lat).toBeCloseTo(51.5014);
    expect(result?.lon).toBeCloseTo(-0.1419);
    expect((global.fetch as unknown as vi.Mock).mock.calls.length).toBe(0);
  });

  it('fetches Nominatim when resolving free-text query', async () => {
    (global.fetch as unknown as vi.Mock).mockResolvedValue(
      buildResponse([
        {
          lat: '35.6895',
          lon: '139.6917',
          display_name: 'Tokyo, Japan',
          address: { country_code: 'jp', state: 'Tokyo' }
        }
      ])
    );

    const result = await geocode('Tokyo');
    expect(result).not.toBeNull();
    expect(result?.displayName).toContain('Tokyo');
    expect(result?.countryCode).toBe('JP');
  });
});
