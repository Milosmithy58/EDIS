import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'http://localhost:5173';

describe('CORS preflight handling', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('allows POST preflight requests for the news scraper endpoint', async () => {
    const { default: app } = await import('../index');
    const response = await request(app)
      .options('/api/news/scrape')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.header['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.header['access-control-allow-methods']).toContain('POST');
  });

  it('allows POST preflight requests for admin endpoints', async () => {
    const { default: app } = await import('../index');
    const response = await request(app)
      .options('/api/admin/keys')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.header['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.header['access-control-allow-methods']).toContain('POST');
  });
});
