import { describe, expect, it } from 'vitest';
import { buildQueryForFilters, FILTERS, mapArticleToFilters } from '../core/news/filters';

describe('news filters helpers', () => {
  it('buildQueryForFilters deduplicates repeated filters', () => {
    const filters = [FILTERS[0].slug, FILTERS[0].slug];
    const queries = buildQueryForFilters(filters);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('shooting');
  });

  it('mapArticleToFilters tags based on keywords and url hints', () => {
    const text = 'A major wildfire spread near the coastal town with power outage warnings.';
    const tags = mapArticleToFilters(text, 'https://example.com/weather/wildfire');
    expect(tags).toContain('weather-wildfire');
    expect(tags).toContain('infrastructure-power');
  });
});
