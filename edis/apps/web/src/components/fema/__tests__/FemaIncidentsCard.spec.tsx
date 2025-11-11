import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FemaIncidentsCard from '../FemaIncidentsCard';

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

const renderWithClient = (state?: string | null, county?: string | null) => {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <FemaIncidentsCard state={state} county={county ?? undefined} />
    </QueryClientProvider>
  );
};

describe('FemaIncidentsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders incidents returned from the API', async () => {
    const payload = {
      items: [
        {
          disasterNumber: 1234,
          declarationType: 'DR',
          state: 'CA',
          county: 'Los Angeles County',
          title: 'Severe Storms',
          incidentBeginDate: '2024-01-10T00:00:00Z',
          incidentEndDate: null,
          declarationDate: '2024-02-10T00:00:00Z'
        }
      ],
      page: 1,
      pageSize: 25,
      total: 10
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    renderWithClient('CA', 'Los Angeles County');

    await waitFor(() => {
      expect(screen.getByText('Severe Storms')).toBeInTheDocument();
    });

    expect(screen.getByText('View on FEMA')).toHaveAttribute('href', 'https://www.fema.gov/disaster/1234');
    expect(screen.getByText('Los Angeles County, CA')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('updates the query when filters change', async () => {
    const payload = {
      items: [],
      page: 1,
      pageSize: 25,
      total: 0
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => payload
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    renderWithClient('TX', 'Harris County');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();

    const select = screen.getByLabelText('Since');
    await user.selectOptions(select, '7');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const latestCall = fetchMock.mock.calls.at(-1)?.[0];
    expect(typeof latestCall).toBe('string');
    const latestUrl = new URL(latestCall as string, 'http://localhost');
    expect(latestUrl.searchParams.get('since')).not.toBeNull();
    expect(latestUrl.searchParams.get('types')).toBe('DR,EM,FM');

    const typeCheckbox = screen.getByLabelText('Fire Mgmt (FM)');
    await user.click(typeCheckbox);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const finalCall = fetchMock.mock.calls.at(-1)?.[0];
    const finalUrl = new URL(finalCall as string, 'http://localhost');
    expect(finalUrl.searchParams.get('types')).toBe('DR,EM');
  });

  it('shows empty and error states with retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          page: 1,
          pageSize: 25,
          total: 0
        })
      })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              disasterNumber: 7777,
              declarationType: 'EM',
              state: 'FL',
              county: 'Miami-Dade County',
              title: 'Hurricane Response',
              incidentBeginDate: '2024-02-01T00:00:00Z',
              incidentEndDate: null,
              declarationDate: '2024-02-12T00:00:00Z'
            }
          ],
          page: 1,
          pageSize: 25,
          total: 1
        })
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    renderWithClient('FL', 'Miami-Dade County');

    await waitFor(() => {
      expect(screen.getByText('No recent declarations for this area.')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const select = screen.getByLabelText('Since');
    await user.selectOptions(select, '7');

    await waitFor(() => {
      expect(screen.getByText('We could not load FEMA incidents.')).toBeInTheDocument();
    });

    const retry = screen.getByRole('button', { name: 'Try again' });
    await user.click(retry);

    await waitFor(() => {
      expect(screen.getByText('Hurricane Response')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
