import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchDisastersMock = vi.fn();

class MockOpenFemaError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'openfema_error') {
    super(message);
    this.name = 'OpenFemaError';
    this.status = status;
    this.code = code;
  }
}

vi.mock('../../adapters/fema', () => ({
  fetchDisasters: fetchDisastersMock,
  OpenFemaError: MockOpenFemaError
}));

const loadApp = async () => {
  vi.resetModules();
  const mod = await import('../../index');
  return mod.default;
};

afterEach(() => {
  fetchDisastersMock.mockReset();
});

describe('GET /api/fema/disasters', () => {
  it('returns 400 when the state query is missing', async () => {
    const app = await loadApp();
    const response = await request(app).get('/api/fema/disasters');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'invalid_request',
      message: 'state is required',
      source: 'api',
      status: 400
    });
  });

  it('rejects invalid pagination parameters', async () => {
    const app = await loadApp();
    const response = await request(app)
      .get('/api/fema/disasters')
      .query({ state: 'CA', page: '0', limit: '600' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_request');
    expect(response.body.source).toBe('api');
    expect(response.body.status).toBe(400);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  it('forwards validated params to the adapter and returns the payload', async () => {
    const app = await loadApp();
    fetchDisastersMock.mockResolvedValue({
      items: [
        {
          disasterNumber: 1234,
          declarationType: 'DR',
          state: 'TX',
          county: 'HARRIS',
          title: 'Severe Storms',
          incidentBeginDate: '2024-01-01T00:00:00Z',
          incidentEndDate: null,
          declarationDate: '2024-02-01T12:00:00Z'
        }
      ],
      page: 2,
      pageSize: 50,
      total: 120
    });

    const response = await request(app)
      .get('/api/fema/disasters')
      .query({
        state: 'tx',
        county: 'Harris',
        since: '2024-01-01',
        types: ['DR', 'EM'],
        limit: '50',
        page: '2'
      });

    expect(fetchDisastersMock).toHaveBeenCalledWith({
      state: 'TX',
      county: 'Harris',
      since: '2024-01-01',
      types: ['DR', 'EM'],
      limit: 50,
      page: 2
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          disasterNumber: 1234,
          declarationType: 'DR',
          state: 'TX',
          county: 'HARRIS',
          title: 'Severe Storms',
          incidentBeginDate: '2024-01-01T00:00:00Z',
          incidentEndDate: null,
          declarationDate: '2024-02-01T12:00:00Z'
        }
      ],
      page: 2,
      pageSize: 50,
      total: 120
    });
  });

  it('maps provider errors to ErrorDTO responses', async () => {
    const app = await loadApp();
    fetchDisastersMock.mockRejectedValue(new MockOpenFemaError('timeout', 503, 'openfema_timeout'));

    const response = await request(app)
      .get('/api/fema/disasters')
      .query({ state: 'FL' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'openfema_timeout',
      message: 'We could not load FEMA incidents right now.',
      source: 'openfema',
      status: 503
    });
  });
});
