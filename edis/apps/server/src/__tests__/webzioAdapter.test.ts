import { beforeEach, describe, expect, it, vi } from 'vitest';

let composeWebzQuery: typeof import('../adapters/news/webzio').composeWebzQuery;
let fetchNewsWebz: typeof import('../adapters/news/webzio').fetchNewsWebz;
let NewsProviderError: typeof import('../adapters/news/webzio').NewsProviderError;

const setupModule = async () => {
  vi.resetModules();
  process.env.WEBZIO_TOKEN = 'test-token';
  const mod = await import('../adapters/news/webzio');
  composeWebzQuery = mod.composeWebzQuery;
  fetchNewsWebz = mod.fetchNewsWebz;
  NewsProviderError = mod.NewsProviderError;
};

describe('webzio adapter', () => {
  beforeEach(async () => {
    await setupModule();
  });

  it('creates a boolean query with grouped filters and country clause', () => {
    const query = composeWebzQuery('London UK', ['(flood OR flooding)', '(protest OR demonstration)'], 'GB');

    expect(query).toContain('title:(London OR UK)');
    expect(query).toContain('text:(London OR UK)');
    expect(query).toContain('(flood OR flooding)');
    expect(query).toContain('(protest OR demonstration)');
    expect(query).toContain('country:GB');
    expect(query).toContain('site_type:news');
    expect(query).toContain('is_first:true');
  });

  it('retries on rate limit and surfaces a provider error DTO', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ posts: [] }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    const promise = fetchNewsWebz({ baseQuery: 'London', filters: [], countryCode: 'GB' }).catch((error) => error);

    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    const error = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(error).toBeInstanceOf(NewsProviderError);
    expect(error.dto.message).toContain('Webz.io temporarily rate limited');
    expect(error.dto.retryable).toBe(true);
    vi.useRealTimers();
    global.fetch = originalFetch;
  });
});
