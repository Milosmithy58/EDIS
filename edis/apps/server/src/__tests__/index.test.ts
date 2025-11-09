import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../index';

describe('server health check', () => {
  it('returns ok for healthz endpoint', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
