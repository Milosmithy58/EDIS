import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseLeedsCouncil } from '../leedsCouncil';

describe('leeds council parser', () => {
  it('extracts council notices', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '..', '..', '__fixtures__', 'leeds-council.html'),
      'utf8'
    );
    const tickets = parseLeedsCouncil(html);
    expect(tickets).toHaveLength(2);
    expect(tickets[0].category).toBe('Council');
    expect(tickets[0].severity).toBe('major');
    expect(tickets[0].status).toBe('ongoing');
  });
});
