import { z } from 'zod';

export type StandardizedLocation = {
  lat: number;
  lon: number;
  displayName: string;
  countryCode?: string;
  adminLevels?: string[];
};

export const StandardizedLocationSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  displayName: z.string(),
  countryCode: z.string().optional(),
  adminLevels: z.array(z.string()).optional()
});

export type NewsItemDTO = {
  url: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  image?: string;
  categories: string[];
  locationHints?: string[];
};

export type NewsFeedDTO = {
  items: NewsItemDTO[];
  fetchedAt: string;
  nextCursor?: string;
};
