import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CrimeCard from '../CrimeCard';

describe('CrimeCard', () => {
  it('prompts for location when missing', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <CrimeCard geo={null} country="UK" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Select a location to see crime statistics/i)).toBeInTheDocument();
  });
});
