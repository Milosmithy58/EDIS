import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crimeNewsRoutes from '../crimeNewsRoutes';
import * as cache from '../../core/cache';

const app = express();
app.use('/api', crimeNewsRoutes);

const fbiMock = vi.hoisted(() => vi.fn());
const webzMock = vi.hoisted(() => vi.fn());
const newsapiMock = vi.hoisted(() => vi.fn());
const gdeltMock = vi.hoisted(() => vi.fn());
const cmMock = vi.hoisted(() => vi.fn());
const scMock = vi.hoisted(() => vi.fn());
const localMock = vi.hoisted(() => vi.fn());

vi.mock('../../adapters/crime/fbiAdapter', () => ({ fetchCrimeItems: fbiMock }));
vi.mock('../../adapters/crime/webzAdapter', () => ({ fetchCrimeItems: webzMock }));
vi.mock('../../adapters/crime/newsapiAdapter', () => ({ fetchCrimeItems: newsapiMock }));
vi.mock('../../adapters/crime/gdeltAdapter', () => ({ fetchCrimeItems: gdeltMock }));
vi.mock('../../adapters/crime/crimeMappingAdapter', () => ({ fetchCrimeItems: cmMock }));
vi.mock('../../adapters/crime/spotCrimeAdapter', () => ({ fetchCrimeItems: scMock }));
vi.mock('../../adapters/crime/localAgencyAdapter', () => ({ fetchCrimeItems: localMock }));

const now = new Date().toISOString();

describe('crime news route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRIME_SOURCES = 'fbi,webz,newsapi';
    fbiMock.mockResolvedValue([
      {
        id: '1',
        title: 'Incident A',
        url: 'https://example.com/a',
        source: 'FBI',
        source_type: 'rss',
        scraped_at: now,
        raw_exists: false
      } as any
    ]);
    webzMock.mockResolvedValue([
      {
        id: '2',
        title: 'Incident B',
        url: 'https://example.com/b',
        source: 'Webz.io',
        source_type: 'api',
        scraped_at: now,
        raw_exists: false
      } as any
    ]);
    newsapiMock.mockResolvedValue([
      {
        id: '3',
        title: 'Incident A',
        url: 'https://example.com/a',
        source: 'NewsAPI',
        source_type: 'api',
        scraped_at: now,
        raw_exists: false
      } as any
    ]);
    gdeltMock.mockResolvedValue([]);
    cmMock.mockResolvedValue([]);
    scMock.mockResolvedValue([]);
    localMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cache.clearCache();
    vi.useRealTimers();
  });

  it('requires a location query parameter', async () => {
    const response = await request(app).get('/api/crime-news');
    expect(response.status).toBe(400);
  });

  it('merges and dedupes items', async () => {
    const response = await request(app).get('/api/crime-news').query({ location: 'Portland, OR' });
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.items).toHaveLength(2);
    expect(new Set(response.body.items.map((item: any) => item.url)).size).toBe(2);
  });

  it('caches responses respecting ttl', async () => {
    const cacheSpy = vi.spyOn(cache, 'getCache');
    const setSpy = vi.spyOn(cache, 'setCache');
    await request(app).get('/api/crime-news').query({ location: 'Austin, TX' });
    await request(app).get('/api/crime-news').query({ location: 'Austin, TX' });
    expect(fbiMock).toHaveBeenCalledTimes(1);
    expect(cacheSpy).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalled();
  });

  it('re-fetches after cache ttl expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    await request(app).get('/api/crime-news').query({ location: 'Dallas, TX' });
    expect(fbiMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    await request(app).get('/api/crime-news').query({ location: 'Dallas, TX' });
    expect(fbiMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
