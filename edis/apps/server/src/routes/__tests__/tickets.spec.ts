import request from 'supertest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import app from '../../index';
import * as ticketsModule from '../../adapters/tickets';

describe('GET /api/tickets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requires minimal location context', async () => {
    const response = await request(app).get('/api/tickets');
    expect(response.status).toBe(400);
  });

  it('returns aggregated tickets', async () => {
    vi.spyOn(ticketsModule, 'getTicketsForArea').mockResolvedValue({
      tickets: [
        {
          id: 'abc',
          source: { id: 'test', name: 'Test Source', url: 'https://example.com' },
          title: 'Test disruption',
          category: 'Transport',
          url: 'https://example.com/ticket'
        }
      ],
      sourceErrors: []
    });

    const response = await request(app)
      .get('/api/tickets')
      .query({ countryCode: 'GB', city: 'London' });

    expect(response.status).toBe(200);
    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.source_errors).toEqual([]);
  });

  it('handles errors gracefully', async () => {
    vi.spyOn(ticketsModule, 'getTicketsForArea').mockRejectedValue(new Error('boom'));
    const response = await request(app)
      .get('/api/tickets')
      .query({ countryCode: 'GB', city: 'London' });
    expect(response.status).toBe(500);
  });
});
