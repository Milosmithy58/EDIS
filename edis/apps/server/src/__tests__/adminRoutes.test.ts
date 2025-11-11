import { mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE64_KEY = Buffer.from('abcdefghijklmnopqrstuvwxyz123456').toString('base64');

describe('admin routes', () => {
  let storeDir: string;

  beforeEach(() => {
    vi.resetModules();
    storeDir = mkdtempSync(join(tmpdir(), 'edis-admin-'));
    process.env.NODE_ENV = 'test';
    process.env.SECRETBOX_KEY = BASE64_KEY;
    process.env.ADMIN_TOKEN = 'test-admin-token';
    process.env.KEYS_STORE_PATH = join(storeDir, 'keys.enc');
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
    delete process.env.SECRETBOX_KEY;
    delete process.env.ADMIN_TOKEN;
    delete process.env.KEYS_STORE_PATH;
    vi.unstubAllGlobals();
  });

  it('rejects POST /api/admin/keys without an authorization header', async () => {
    const { default: app } = await import('../index');
    const response = await request(app).post('/api/admin/keys').send({ provider: 'gnews', secret: 'abc' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized', status: 401 });
  });

  it('returns ok details when provider connectivity succeeds', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { setKey } = await import('../core/secrets/secureStore');
    await setKey('visualcrossing', 'test-key');
    const { default: app } = await import('../index');

    const response = await request(app)
      .post('/api/admin/test')
      .set('Authorization', 'Bearer test-admin-token')
      .send({ provider: 'visualcrossing' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.details).toMatchObject({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns failure details when provider responds with an error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const { setKey } = await import('../core/secrets/secureStore');
    await setKey('newsapi', 'test-key');
    const { default: app } = await import('../index');

    const response = await request(app)
      .post('/api/admin/test')
      .set('Authorization', 'Bearer test-admin-token')
      .send({ provider: 'newsapi' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(false);
    expect(response.body.details).toMatchObject({ status: 'http-error', httpStatus: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
