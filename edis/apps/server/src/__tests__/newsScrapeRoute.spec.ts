import { mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE64_KEY = Buffer.from('abcdefghijklmnopqrstuvwxyz123456').toString('base64');

const buildFeed = () => `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Flood warning issued</title>
    <link>https://example.com/news/flood-warning</link>
    <description>Authorities warn of flooding</description>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>
</channel></rss>`;

describe('POST /api/news/scrape', () => {
  let storeDir: string;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    vi.resetModules();
    storeDir = mkdtempSync(join(tmpdir(), 'edis-news-'));
    process.env.NODE_ENV = 'test';
    process.env.SECRETBOX_KEY = BASE64_KEY;
    process.env.ADMIN_TOKEN = 'test-admin-token';
    process.env.KEYS_STORE_PATH = join(storeDir, 'keys.enc');
    process.env.SCRAPE_SOURCES_PATH = join(storeDir, 'sources.enc');
    global.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      if (url.includes('nominatim')) {
        return new Response(
          JSON.stringify([
            { lat: '51.5074', lon: '-0.1278', display_name: 'London, UK', address: { country_code: 'gb' } }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /', { status: 200 });
      }
      if (url.endsWith('/rss') || url.endsWith('/feed') || url.endsWith('/rss.xml') || url.endsWith('/atom.xml')) {
        return new Response(buildFeed(), { status: 200 });
      }
      return new Response('<html></html>', { status: 200 });
    }) as unknown as typeof fetch;
    const { updateSources } = await import('../core/secure/sourcesStore');
    await updateSources(['example.com'], [], 'test');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    await rm(storeDir, { recursive: true, force: true });
    delete process.env.SECRETBOX_KEY;
    delete process.env.ADMIN_TOKEN;
    delete process.env.KEYS_STORE_PATH;
    delete process.env.SCRAPE_SOURCES_PATH;
  });

  it('returns scraped items based on filters', async () => {
    const { default: app } = await import('../index');
    const response = await request(app)
      .post('/api/news/scrape')
      .send({ filters: ['weather-flood'], locationQuery: 'London' });
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].categories).toContain('weather-flood');
  });

  it('rejects invalid filters', async () => {
    const { default: app } = await import('../index');
    const response = await request(app).post('/api/news/scrape').send({ filters: ['not-a-filter'] });
    expect(response.status).toBe(400);
  });
});
