import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import LocalTicketsCard, { TicketDTO } from '../LocalTicketsCard';
import type { GeoContext } from '../LocationSearch';

describe('LocalTicketsCard', () => {
  const geo: GeoContext = {
    query: 'Leeds, United Kingdom',
    country: 'United Kingdom',
    countryCode: 'GB',
    admin1: 'West Yorkshire',
    admin2: 'Leeds',
    city: 'Leeds',
    lat: 53.801,
    lon: -1.548
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prompts when no geo is selected', () => {
    render(<LocalTicketsCard geo={null} />);
    expect(screen.getByText(/select a location/i)).toBeInTheDocument();
  });

  it('renders tickets when available', async () => {
    const payload = {
      tickets: [
        {
          id: '1',
          source: { id: 'tfl', name: 'Transport for London', url: 'https://tfl.gov.uk' },
          title: 'Line closed',
          description: 'Test disruption',
          category: 'Transport' as TicketDTO['category'],
          severity: 'major' as TicketDTO['severity'],
          status: 'ongoing' as TicketDTO['status'],
          url: 'https://example.com'
        }
      ]
    };
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    render(<LocalTicketsCard geo={geo} />);

    await waitFor(() => {
      expect(screen.getByText('Line closed')).toBeInTheDocument();
    });
    expect(screen.getByText(/Transport for London/)).toBeInTheDocument();
  });

  it('shows an error message when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('fail', { status: 500 })
    );
    render(<LocalTicketsCard geo={geo} />);
    await waitFor(() => {
      expect(screen.getByText(/unable to load local notices/i)).toBeInTheDocument();
    });
  });

});
