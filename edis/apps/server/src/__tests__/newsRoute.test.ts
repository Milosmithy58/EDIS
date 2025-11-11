import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../index';

vi.mock('../adapters/news/gnews', () => ({
  getNews: vi.fn().mockResolvedValue({ items: [], total: 0, source: 'Mock News' })
}));

vi.mock('../adapters/news/newsapi', () => ({
  getNews: vi.fn()
}));

vi.mock('../adapters/news/rss', () => ({
  getNewsFromFeed: vi.fn()
}));

import * as gnews from '../adapters/news/gnews';

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/news', () => {
  it('includes composed filters when forwarding to the provider', async () => {
    const response = await request(app)
      .get('/api/news')
      .query({ query: 'London, UK', filters: JSON.stringify(['Flooding', 'Civil Unrest / Protests']) });

    expect(response.status).toBe(200);
    const mock = vi.mocked(gnews.getNews);
    expect(mock).toHaveBeenCalledTimes(1);
    const [providerQuery] = mock.mock.calls[0];
    expect(providerQuery).toContain('(flood OR flooding');
    expect(providerQuery).toContain(') OR (');
    expect(response.body).toEqual({ items: [], total: 0, source: 'Mock News' });
  });
});
