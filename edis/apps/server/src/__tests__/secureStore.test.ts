import { mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE64_KEY = Buffer.from('abcdefghijklmnopqrstuvwxyz123456').toString('base64');

describe('secureStore', () => {
  let storePath: string;
  let storeDir: string;

  beforeEach(() => {
    vi.resetModules();
    storeDir = mkdtempSync(join(tmpdir(), 'edis-secrets-'));
    storePath = join(storeDir, 'keys.enc');
    process.env.NODE_ENV = 'test';
    process.env.SECRETBOX_KEY = BASE64_KEY;
    process.env.ADMIN_TOKEN = 'test-admin-token';
    process.env.KEYS_STORE_PATH = storePath;
    delete process.env.VISUALCROSSING_API_KEY;
    delete process.env.NEWSAPI_API_KEY;
    delete process.env.GNEWS_API_KEY;
  });

  afterEach(async () => {
    await rm(storeDir, { force: true, recursive: true });
    delete process.env.SECRETBOX_KEY;
    delete process.env.KEYS_STORE_PATH;
    delete process.env.ADMIN_TOKEN;
  });

  it('round-trips provider keys through encryption', async () => {
    const { loadKeys, setKey, getKey } = await import('../core/secrets/secureStore');
    const initial = await loadKeys();
    expect(initial).toEqual({});

    await setKey('visualcrossing', 'abc123');
    await setKey('newsapi', 'def456');

    const storedVisualCrossing = await getKey('visualcrossing');
    const storedNewsApi = await getKey('newsapi');

    expect(storedVisualCrossing).toBe('abc123');
    expect(storedNewsApi).toBe('def456');

    const reloaded = await loadKeys();
    expect(reloaded).toMatchObject({
      visualcrossing: 'abc123',
      newsapi: 'def456'
    });
  });
});
