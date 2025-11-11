import { describe, expect, it } from 'vitest';
import { buildDisasterQuery } from '../fema';

describe('buildDisasterQuery', () => {
  it('wraps since filters in datetime literals to satisfy OData', () => {
    const { url } = buildDisasterQuery({ state: 'CA', since: '2024-01-01' });
    const search = new URL(url).searchParams;
    const filter = search.get('$filter');

    expect(filter).toContain("incidentBeginDate ge datetime'2024-01-01T00:00:00Z'");
  });

  it('uppercases the state code and passes through pagination', () => {
    const { url, normalized } = buildDisasterQuery({ state: 'tx', limit: 25, page: 2 });
    const search = new URL(url).searchParams;

    expect(normalized.state).toBe('TX');
    expect(search.get('$top')).toBe('25');
    expect(search.get('$skip')).toBe(String(25));
  });
});
