import { describe, expect, it } from 'vitest';
import { buildFilterQuery } from '../adapters/news/filterKeywords';

describe('buildFilterQuery', () => {
  it('wraps each filter group in parentheses and joins with OR', () => {
    const result = buildFilterQuery('London, UK', ['Flooding', 'Civil Unrest / Protests']);

    expect(result.startsWith('London, UK')).toBe(true);
    expect(result).toContain('(flood OR flooding OR "flash flood" OR "river levels" OR deluge)');
    expect(result).toContain(') OR (');
    expect(result).toContain('(protest OR demonstration OR march OR strike OR picket)');
  });
});
