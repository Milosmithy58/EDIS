import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WeatherCard from '../WeatherCard';

describe('WeatherCard', () => {
  it('asks for location when none selected', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <WeatherCard geo={null} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Select a location/)).toBeInTheDocument();
  });
});
