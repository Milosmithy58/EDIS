import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const coreEnvMock = vi.hoisted(() => ({
  flags: { openWeather: false, newsApi: false },
  newsProvider: 'gnews' as 'gnews' | 'newsapi' | 'webzio',
  env: {
    PORT: 0,
    NODE_ENV: 'test',
    GNEWS_API_KEY: undefined,
    NEWSAPI_API_KEY: undefined,
    OPENWEATHER_API_KEY: undefined,
    MAPBOX_TOKEN: undefined,
    FBI_CRIME_API_KEY: undefined,
    DEFAULT_COUNTRY: 'UK',
    ENABLE_OPENWEATHER: undefined,
    ENABLE_NEWSAPI: undefined,
    NEWS_PROVIDER: 'gnews' as 'gnews' | 'newsapi' | 'webzio',
    WEBZIO_TOKEN: 'token'
  }
}));

const gnewsMock = vi.fn().mockResolvedValue({ items: [], total: 0, source: 'Mock News' });
const newsapiMock = vi.fn();
const rssMock = vi.fn();
const fetchNewsWebzMock = vi.fn();

vi.mock('../core/env', () => coreEnvMock);
vi.mock('../adapters/news/gnews', () => ({
  getNews: gnewsMock
}));
vi.mock('../adapters/news/newsapi', () => ({
  getNews: newsapiMock
}));
vi.mock('../adapters/news/rss', () => ({
  getNewsFromFeed: rssMock
}));
vi.mock('../adapters/news/webzio', () => ({
  fetchNewsWebz: fetchNewsWebzMock,
  NewsProviderError: class extends Error {
    status: number;
    constructor(readonly dto = { message: 'error', status: 429, retryable: true }) {
      super('NewsProviderError');
      this.name = 'NewsProviderError';
      this.status = dto.status;
    }
  }
}));

const loadApp = async () => {
  vi.resetModules();
  const mod = await import('../index');
  return mod.default;
};

afterEach(() => {
  vi.clearAllMocks();
  coreEnvMock.newsProvider = 'gnews';
  coreEnvMock.env.NEWS_PROVIDER = 'gnews';
  coreEnvMock.flags.newsApi = false;
});

describe('GET /api/news', () => {
  it('includes composed filters when forwarding to the provider', async () => {
    const app = await loadApp();
    const response = await request(app)
      .get('/api/news')
      .query({ query: 'London, UK', filters: JSON.stringify(['Flooding', 'Civil Unrest / Protests']) });

    expect(response.status).toBe(200);
    expect(gnewsMock).toHaveBeenCalledTimes(1);
    const [providerQuery] = gnewsMock.mock.calls[0];
    expect(providerQuery).toContain('(flood OR flooding');
    expect(providerQuery).toContain(') OR (');
    expect(response.body).toEqual({ items: [], total: 0, source: 'Mock News' });
  });

  it('uses the Webz adapter when next is supplied', async () => {
    coreEnvMock.newsProvider = 'webzio';
    coreEnvMock.env.NEWS_PROVIDER = 'webzio';
    fetchNewsWebzMock.mockResolvedValue({ items: [], source: 'webz.io', next: undefined });
    const app = await loadApp();

    const response = await request(app)
      .get('/api/news')
      .query({ next: 'https://api.webz.io/newsApiLite?token=abc123&from=cursor' });

    expect(response.status).toBe(200);
    expect(fetchNewsWebzMock).toHaveBeenCalledWith({ baseQuery: '', filters: [], nextUrl: 'https://api.webz.io/newsApiLite?token=abc123&from=cursor' });
    expect(response.body).toEqual({ items: [], source: 'webz.io', next: undefined });
  });
});

describe('POST /api/news', () => {
  it('composes filter clauses and forwards them for gnews', async () => {
    const app = await loadApp();
    const response = await request(app)
      .post('/api/news')
      .send({ query: 'London, UK', filters: ['Flooding', 'Civil Unrest / Protests'], country: 'gb' });

    expect(response.status).toBe(200);
    expect(gnewsMock).toHaveBeenCalledTimes(1);
    const [providerQuery] = gnewsMock.mock.calls[0];
    expect(providerQuery).toContain('(flood OR flooding');
    expect(providerQuery).toContain(') OR (');
    expect(providerQuery).toContain('(protest OR demonstration');
  });
});
