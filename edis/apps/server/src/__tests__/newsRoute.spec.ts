import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const geocodeMock = vi.fn();
const scrapeNewsMock = vi.fn();
const loadSourcesMock = vi.fn();
const updateSourcesMock = vi.fn();

vi.mock('../adapters/geocode/nominatim', () => ({
  geocode: geocodeMock
}));

vi.mock('../adapters/scraper/newsScraper', () => ({
  scrapeNews: scrapeNewsMock
}));

vi.mock('../core/secure/sourcesStore', () => ({
  loadSources: loadSourcesMock,
  updateSources: updateSourcesMock
}));

const loadApp = async () => {
  vi.resetModules();
  const mod = await import('../index');
  return mod.default;
};

const buildItem = (index: number) => ({
  url: `https://example.com/${index}`,
  title: `Story ${index}`,
  summary: `Summary ${index}`,
  source: 'example.com',
  publishedAt: new Date(Date.now() - index * 1000).toISOString(),
  categories: ['weather-flood'] as string[],
  locationHints: ['London']
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = 'test';
  loadSourcesMock.mockResolvedValue({ domains: ['example.com'] });
  geocodeMock.mockResolvedValue({
    lat: 51.5074,
    lon: -0.1278,
    displayName: 'London, UK',
    countryCode: 'GB',
    adminLevels: ['England']
  });
});

afterEach(() => {
  vi.resetModules();
});

describe('News routes', () => {
  it('returns scraped items for POST /api/news', async () => {
    scrapeNewsMock.mockResolvedValueOnce([buildItem(0), buildItem(1), buildItem(2)]);
    const app = await loadApp();

    const response = await request(app)
      .post('/api/news')
      .send({ filters: ['weather-flood'], locationQuery: 'London' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.fetchedAt).toEqual(expect.any(String));
    expect(response.body.nextCursor).toBeUndefined();
    expect(geocodeMock).toHaveBeenCalledWith('London');
    expect(scrapeNewsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: ['weather-flood'],
        location: expect.objectContaining({ displayName: 'London, UK' }),
        limit: 50
      })
    );
  });

  it('rejects unknown filters', async () => {
    const app = await loadApp();

    const response = await request(app).post('/api/news').send({ filters: ['not-a-filter'] });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Unknown filter/);
    expect(scrapeNewsMock).not.toHaveBeenCalled();
  });

  it('supports pagination via next cursor', async () => {
    const pageSize = 5;
    scrapeNewsMock
      .mockResolvedValueOnce(Array.from({ length: pageSize }, (_, index) => buildItem(index)))
      .mockResolvedValueOnce(Array.from({ length: pageSize * 2 }, (_, index) => buildItem(index)));

    const app = await loadApp();

    const initial = await request(app)
      .post('/api/news')
      .send({ filters: ['weather-flood'], locationQuery: 'London', limit: pageSize, query: 'flood' });

    expect(initial.status).toBe(200);
    expect(initial.body.items).toHaveLength(pageSize);
    expect(initial.body.nextCursor).toEqual(expect.any(String));
    expect(scrapeNewsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ limit: pageSize, keywords: ['flood'] })
    );

    const next = await request(app).get('/api/news').query({ next: initial.body.nextCursor });

    expect(next.status).toBe(200);
    expect(next.body.items).toHaveLength(pageSize);
    expect(next.body.items[0].url).toBe('https://example.com/5');
    expect(scrapeNewsMock).toHaveBeenCalledTimes(2);
    expect(scrapeNewsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        limit: pageSize * 2,
        location: expect.objectContaining({ displayName: 'London, UK' })
      })
    );
    expect(geocodeMock).toHaveBeenCalledTimes(1);
  });
});
