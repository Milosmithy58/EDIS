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
      expect(screen.getByRole('link', { name: /open map on police.uk/i })).toBeInTheDocument();
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
      expect(screen.queryByRole('link', { name: /open map on police.uk/i })).not.toBeInTheDocument();
    });
  });

  it('renders UK-specific details when provided by the API', async () => {
    const client = new QueryClient();
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        period: '2024-03',
        total: 42,
        totalsByCategory: [
          { category: 'Anti-social behaviour', count: 20 },
          { category: 'Violence and sexual offences', count: 10 }
        ],
        source: 'Test Source',
        topLocations: [
          { name: 'High Street', count: 12 },
          { name: 'Market Road', count: 8 }
        ],
        outcomesByCategory: [
          { category: 'Under investigation', count: 15 },
          { category: 'No further action', count: 5 }
        ],
        force: {
          id: 'metropolitan',
          name: 'Metropolitan Police Service',
          url: 'https://www.met.police.uk',
          neighbourhood: {
            id: 'metropolitan/E05000020',
            name: 'Junction',
            url: 'https://www.met.police.uk/a/your-area/metropolitan-police-service/junction/'
          }
        }
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
      expect(screen.getByText(/Local policing team/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Metropolitan Police Service/)).toBeInTheDocument();
    expect(screen.getByText(/High Street/)).toBeInTheDocument();
    expect(screen.getByText(/Under investigation/)).toBeInTheDocument();
  });
});
