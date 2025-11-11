import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.fn();

vi.mock('../../core/secrets/secureStore', () => ({
  getKey: vi.fn().mockResolvedValue('stored-key')
}));

vi.mock('../../core/fetcher', async () => {
  const actual = await vi.importActual<typeof import('../../core/fetcher')>('../../core/fetcher');
  return {
    ...actual,
    fetchJson: fetchJsonMock
  };
});

describe('newsapi adapter', () => {
  beforeEach(() => {
    fetchJsonMock.mockResolvedValue({ totalResults: 0, articles: [] });
  });

  afterEach(() => {
    fetchJsonMock.mockReset();
    vi.resetModules();
  });

  it('uses the everything endpoint when no country is provided', async () => {
    const mod = await import('../news/newsapi.ts');
    const result = await mod.getNews('Flooding near river', undefined);

    expect(result).toEqual({ items: [], total: 0, source: 'NewsAPI' });
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);

    const [requestedUrl, options] = fetchJsonMock.mock.calls[0];
    const parsed = new URL(requestedUrl as string);

    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://newsapi.org/v2/everything');
    expect(parsed.searchParams.get('language')).toBe('en');
    expect(parsed.searchParams.get('sortBy')).toBe('publishedAt');
    expect(parsed.searchParams.get('q')).toBe('Flooding near river');
    expect(parsed.searchParams.get('country')).toBeNull();
    expect(options).toMatchObject({ headers: { 'X-Api-Key': 'stored-key' } });
  });

  it('uses the top-headlines endpoint when a country is provided', async () => {
    const mod = await import('../news/newsapi.ts');
    await mod.getNews('Wildfires', 'US');

    expect(fetchJsonMock).toHaveBeenCalledTimes(1);

    const [requestedUrl] = fetchJsonMock.mock.calls[0];
    const parsed = new URL(requestedUrl as string);

    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://newsapi.org/v2/top-headlines');
    expect(parsed.searchParams.get('country')).toBe('us');
    expect(parsed.searchParams.get('language')).toBeNull();
  });
});
