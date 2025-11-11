import { describe, expect, it, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getTicketsForArea, clearTicketCaches } from '../index';
import type { TicketAreaContext } from '../index';

const loadFixture = (filename: string) =>
  fs.readFileSync(path.join(__dirname, '..', '__fixtures__', filename), 'utf8');

const loadJson = <T>(filename: string): T =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', '__fixtures__', filename), 'utf8')) as T;

describe('tickets aggregator', () => {
  beforeEach(() => {
    clearTicketCaches();
    vi.restoreAllMocks();
  });

  it('aggregates tickets from matching sources', async () => {
    const jsonFixture = loadJson('tfl-response.json');
    const railFixture = loadFixture('national-rail.html');
    const leedsFixture = loadFixture('leeds-council.html');

    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('tfl.gov.uk')) {
        return Promise.resolve(
          new Response(JSON.stringify(jsonFixture), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      if (url.includes('nationalrail.co.uk')) {
        return Promise.resolve(
          new Response(railFixture, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          })
        );
      }
      if (url.includes('news.leeds.gov.uk')) {
        return Promise.resolve(
          new Response(leedsFixture, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          })
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const context: TicketAreaContext = {
      countryCode: 'GB',
      city: 'London',
      admin1: 'Greater London'
    };

    const result = await getTicketsForArea(context);
    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.sourceErrors).toEqual([]);
    const sources = new Set(result.tickets.map((ticket) => ticket.source.id));
    expect(sources).toContain('tfl');
    expect(sources).toContain('national-rail');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('caches repeated requests', async () => {
    const jsonFixture = loadJson('tfl-response.json');
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(jsonFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const context: TicketAreaContext = { countryCode: 'GB', city: 'London' };
    await getTicketsForArea(context);
    const afterFirstCall = fetchMock.mock.calls.length;
    await getTicketsForArea(context);
    expect(fetchMock.mock.calls.length).toBe(afterFirstCall);
  });

  it('returns partial data when a source fails', async () => {
    const jsonFixture = loadJson('tfl-response.json');
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('tfl.gov.uk')) {
        return Promise.resolve(
          new Response(JSON.stringify(jsonFixture), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      return Promise.resolve(new Response('Service unavailable', { status: 503 }));
    });

    const context: TicketAreaContext = { countryCode: 'GB', city: 'London' };
    const result = await getTicketsForArea(context);
    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.sourceErrors.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalled();
  });
});
