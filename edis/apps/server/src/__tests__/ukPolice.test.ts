import { describe, expect, it, vi, afterEach } from 'vitest';
import * as ukPolice from '../adapters/crime/ukPolice';

afterEach(() => {
  vi.resetAllMocks();
});

describe('UK Police adapter', () => {
  it('aggregates totals by category', async () => {
    const responses = [
      { ok: true, json: async () => ({ date: '2023-12-01' }) },
      {
        ok: true,
        json: async () => [
          { category: 'anti-social-behaviour' },
          { category: 'anti-social-behaviour' },
          { category: 'burglary' }
        ]
      }
    ];
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => responses.shift() as unknown as Response)
    );

    const data = await ukPolice.getCrime(51.5, -0.12);
    expect(data.period).toBe('2023-12');
    expect(data.total).toBe(3);
    expect(data.totalsByCategory).toEqual([
      { category: 'anti-social-behaviour', count: 2 },
      { category: 'burglary', count: 1 }
    ]);
  });
});
