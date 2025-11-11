import { NewsItem } from '../../core/normalize';

export type CrimeAdapterArgs = {
  location: string;
  categories: string[];
  limit: number;
};

const unsupported = () => {
  console.warn('CrimeMapping adapter skipped: no approved endpoint configured.');
  return [] as NewsItem[];
};

export const fetchCrimeItems = async ({ location, categories, limit }: CrimeAdapterArgs): Promise<NewsItem[]> => {
  void location;
  void categories;
  void limit;
  return unsupported();
};
