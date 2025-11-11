import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canFetch, clearRobotsCache } from '../robots';

const originalFetch = global.fetch;

describe('robots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    clearRobotsCache();
    global.fetch = originalFetch;
  });

  it('denies access when robots disallows path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('User-agent: *\nDisallow: /private', { status: 200 })
    );
    global.fetch = fetchMock as typeof global.fetch;

    await expect(canFetch('https://example.com/private/page')).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches robots.txt between calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    global.fetch = fetchMock as typeof global.fetch;

    await expect(canFetch('https://example.com/open')).resolves.toBe(true);
    await expect(canFetch('https://example.com/another')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
