import { describe, expect, it } from 'vitest';
import { composeNewsQuery, serializeFilters } from '../newsFilters';

describe('composeNewsQuery', () => {
  it('adds grouped clauses joined by OR operators', () => {
    const query = composeNewsQuery('London, UK', ['Flooding', 'Civil Unrest / Protests']);

    expect(query.startsWith('London, UK')).toBe(true);
    expect(query).toContain('(flood OR flooding OR "flash flood" OR "river levels" OR deluge)');
    expect(query).toContain(') OR (');
    expect(query).toContain('(protest OR demonstration');
  });

  it('quotes multi-word keywords to preserve phrases', () => {
    const query = composeNewsQuery('Berlin', ['Public Transport Strike / Protest']);

    expect(query).toContain('"strike action"');
    expect(query).toContain('"industrial action"');
  });
});

describe('serializeFilters', () => {
  it('sorts and deduplicates labels for stable cache keys', () => {
    const serialized = serializeFilters(['Flooding', 'Civil Unrest / Protests', 'Flooding']);

    expect(serialized).toBe(JSON.stringify(['Civil Unrest / Protests', 'Flooding']));
  });
});
