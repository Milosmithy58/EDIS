export type CrimeNewsResponse = {
  location: string;
  count: number;
  items: Array<{
    id: string;
    title: string;
    url: string;
    summary?: string;
    source: string;
    source_type: string;
    published?: string;
    scraped_at: string;
  }>;
};

export async function fetchCrimeNews(location: string, categories: string[] = ['crime'], limit = 25) {
  const params = new URLSearchParams({
    location,
    categories: categories.join(','),
    limit: String(limit)
  });
  const response = await fetch(`/api/crime-news?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`CrimeNews HTTP ${response.status}`);
  }
  return (await response.json()) as CrimeNewsResponse;
}
