import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrapeNews } from '../adapters/scraper/newsScraper';

const buildFeed = () => `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Storm causes power outage</title>
    <link>https://example.com/news/storm-power</link>
    <description>Severe storm impacts grid</description>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>
  <item>
    <title>Storm causes power outage in city</title>
    <link>https://example.com/news/storm-power?ref=dup</link>
    <description>Duplicate headline</description>
    <pubDate>${new Date(Date.now() - 3600_000).toUTCString()}</pubDate>
  </item>
</channel></rss>`;

describe('news scraper', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /', { status: 200 });
      }
      if (url.endsWith('/rss') || url.endsWith('/feed') || url.endsWith('/rss.xml') || url.endsWith('/atom.xml')) {
        return new Response(buildFeed(), { status: 200, headers: { 'Content-Type': 'application/rss+xml' } });
      }
      return new Response('<html></html>', { status: 200 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it(
    'deduplicates similar articles and sorts descending by published date',
    async () => {
      const items = await scrapeNews({
        filters: ['infrastructure-power'],
        filterQueries: ['("power outage")'],
        location: null,
        keywords: undefined,
        domains: ['example.com'],
        since: new Date(Date.now() - 24 * 3600_000),
        limit: 10
      });
      expect(items.length).toBe(1);
      expect(items[0].title).toContain('Storm causes power outage');
    },
    15000
  );
});
