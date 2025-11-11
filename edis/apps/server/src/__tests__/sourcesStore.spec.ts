import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unlink, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

process.env.SCRAPE_SOURCES_PATH = './secrets/test-sources.enc';

import { loadSources, saveSources, updateSources } from '../core/secure/sourcesStore';

const storePath = resolve(process.cwd(), process.env.SCRAPE_SOURCES_PATH!);

beforeEach(async () => {
  await mkdir(dirname(storePath), { recursive: true });
  try {
    await unlink(storePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') throw error;
  }
});

afterEach(async () => {
  try {
    await unlink(storePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') throw error;
  }
});

describe('sources store', () => {
  it('persists and retrieves domain lists', async () => {
    const payload = await updateSources(['Example.com', 'reuters.com'], ['spam.net'], 'tester');
    expect(payload.domains).toEqual(['example.com', 'reuters.com']);
    expect(payload.blocked).toEqual(['spam.net']);

    const stored = await loadSources();
    expect(stored.domains).toEqual(['example.com', 'reuters.com']);
    expect(stored.updatedBy).toBe('tester');
  });

  it('saveSources round-trips without mutation', async () => {
    const now = new Date().toISOString();
    const payload = { domains: ['example.com'], blocked: ['blocked.com'], updatedAt: now, updatedBy: 'unit-test' };
    await saveSources(payload);
    const loaded = await loadSources();
    expect(loaded).toEqual(payload);
  });
});
