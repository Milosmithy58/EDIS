import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import crimeRouter from '../crime';
import * as lessCrime from '../../adapters/crime/lessCrime';
import * as fbiCrime from '../../adapters/crime/fbiCrime';

vi.mock('../../adapters/crime/lessCrime');
vi.mock('../../adapters/crime/fbiCrime');

const mockLessCrime = vi.mocked(lessCrime);
const mockFbiCrime = vi.mocked(fbiCrime);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/crime', crimeRouter);
  return app;
};

describe('crime route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses LessCrime data for US requests', async () => {
    mockLessCrime.getCrimeForState.mockResolvedValue({
      period: '2022',
      totalsByCategory: [{ category: 'Violent crime', count: 100 }],
      total: 100,
      source: 'LessCrime',
      url: 'https://pkgs.lesscrime.info/crimedata/'
    });

    const app = createApp();

    const response = await request(app)
      .get('/api/crime')
      .query({ country: 'US', lat: '1', lon: '2', admin1: 'Texas' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'LessCrime',
      period: '2022'
    });
    expect(mockLessCrime.getCrimeForState).toHaveBeenCalledWith('TX');
    expect(mockFbiCrime.getCrimeForState).not.toHaveBeenCalled();
  });

  it('falls back to FBI data when LessCrime fails', async () => {
    mockLessCrime.getCrimeForState.mockRejectedValue(new Error('LessCrime unavailable'));
    mockFbiCrime.getCrimeForState.mockResolvedValue({
      period: '2021',
      totalsByCategory: [{ category: 'Violent crime', count: 50 }],
      total: 50,
      source: 'FBI',
      url: 'https://example.com'
    });

    const app = createApp();

    const response = await request(app)
      .get('/api/crime')
      .query({ country: 'US', lat: '1', lon: '2', admin1: 'Oregon' });

    expect(response.status).toBe(200);
    expect(mockLessCrime.getCrimeForState).toHaveBeenCalledWith('OR');
    expect(mockFbiCrime.getCrimeForState).toHaveBeenCalledWith('OR');
    expect(response.body).toMatchObject({
      source: 'FBI',
      period: '2021'
    });
  });

  it('returns a friendly message when all US providers fail', async () => {
    mockLessCrime.getCrimeForState.mockRejectedValue(new Error('LessCrime offline'));
    mockFbiCrime.getCrimeForState.mockRejectedValue(new Error('FBI offline'));

    const app = createApp();

    const response = await request(app)
      .get('/api/crime')
      .query({ country: 'US', lat: '1', lon: '2', admin1: 'Nevada' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'U.S. crime data is unavailable right now. Please try again later.'
    });
  });
});
