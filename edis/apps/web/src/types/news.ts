export type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAtISO: string;
  imageUrl?: string;
};

export type NewsDTO = {
  items: NewsItem[];
  total?: number;
  source: string;
  next?: string;
  notice?: string;
  cached?: boolean;
  fetchedAt?: string;
};
