export interface ProviderKeys {
  visualcrossing?: string;
  newsapi?: string;
  gnews?: string;
}

export type ProviderName = keyof ProviderKeys;
