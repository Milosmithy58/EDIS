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
  });

  it('rejects POST /api/admin/keys without an authorization header', async () => {
    const { default: app } = await import('../index');
    const response = await request(app).post('/api/admin/keys').send({ provider: 'gnews', secret: 'abc' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized', status: 401 });
  });
});
