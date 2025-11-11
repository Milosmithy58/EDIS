import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseNationalRail } from '../nationalRail';

describe('national rail parser', () => {
  it('parses html notices into tickets', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '..', '..', '__fixtures__', 'national-rail.html'),
      'utf8'
    );
    const tickets = parseNationalRail(html);
    expect(tickets).toHaveLength(2);
    expect(tickets[0].category).toBe('Transport');
    expect(tickets[0].severity).toBe('major');
    expect(tickets[1].status).toBe('planned');
  });
});
