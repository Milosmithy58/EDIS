import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseTflResponse } from '../tfl';

describe('tfl parser', () => {
  it('extracts disruption tickets', () => {
    const payload = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', '__fixtures__', 'tfl-response.json'), 'utf8')
    );
    const tickets = parseTflResponse(payload);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].title).toContain('Northern');
    expect(tickets[0].severity).toBe('moderate');
    expect(tickets[0].status).toBe('ongoing');
  });
});
