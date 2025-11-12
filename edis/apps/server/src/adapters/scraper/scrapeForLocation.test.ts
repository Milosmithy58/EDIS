import { describe, it, expect } from 'vitest';
import { scrapeForLocation } from './scrapeForLocation';

describe('scrapeForLocation', () => {
  it(
    'returns structured items',
    async () => {
      const res = await scrapeForLocation({ q: 'london', filters: ['weather', 'transport'] });
      expect(Array.isArray(res)).toBe(true);
      if (res.length) {
        expect(res[0]).toHaveProperty('title');
        expect(res[0]).toHaveProperty('url');
        expect(res[0]).toHaveProperty('source');
      }
    },
    30_000
  );
});
