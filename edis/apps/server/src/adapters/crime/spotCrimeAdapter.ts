import { NewsItem } from '../../core/normalize';

export type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  void location;
  void categories;
  void limit;
  console.warn('SpotCrime adapter disabled due to licensing constraints.');
  return [];
};
