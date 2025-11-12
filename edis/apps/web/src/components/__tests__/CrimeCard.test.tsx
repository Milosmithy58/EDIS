import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import CrimeCard from '../CrimeCard';
import type { GeoContext } from '../../components/LocationSearch';

describe('CrimeCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prompts for location when missing', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <CrimeCard geo={null} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Select a location to see crime statistics/i)).toBeInTheDocument();
  });

  it('shows the UK crime map when the selected location is in the UK', async () => {
    const client = new QueryClient();
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        period: 'January 2024',
        total: 120,
        totalsByCategory: [
          { category: 'Robbery', count: 10 },
          { category: 'Burglary', count: 5 }
        ],
        source: 'Test Source'
      })
    } as Response);

    const geo: GeoContext = {
      query: 'London, UK',
      country: 'United Kingdom',
      countryCode: 'GB',
      city: 'London',
      lat: 51.5074,
      lon: -0.1278
    };

    render(
      <QueryClientProvider client={client}>
        <CrimeCard geo={geo} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTitle(/UK crime map/i)).toBeInTheDocument();
    });
  });

  it('does not show the UK crime map for non-UK locations', async () => {
    const client = new QueryClient();
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        period: 'January 2024',
        total: 120,
        totalsByCategory: [
          { category: 'Robbery', count: 10 },
          { category: 'Burglary', count: 5 }
        ],
        source: 'Test Source'
      })
    } as Response);

    const geo: GeoContext = {
      query: 'New York, USA',
      country: 'United States',
      countryCode: 'US',
      city: 'New York',
      lat: 40.7128,
      lon: -74.006
    };

    render(
      <QueryClientProvider client={client}>
        <CrimeCard geo={geo} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTitle(/UK crime map/i)).not.toBeInTheDocument();
    });
  });
});
