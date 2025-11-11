import etag from 'etag';
import { LRUCache } from 'lru-cache';

type CacheEntry<T> = {
  value: T;
  etag: string;
  lastModified: string;
  expires: number;
};

const DEFAULT_TTL = 5 * 60 * 1000;

const cache = new LRUCache<string, CacheEntry<unknown>>({
  max: 500,
  ttl: DEFAULT_TTL,
  ttlAutopurge: true
});

export const getCache = <T>(key: string): CacheEntry<T> | null => {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
};

export const setCache = <T>(key: string, value: T, ttl = DEFAULT_TTL): CacheEntry<T> => {
  const serialized = JSON.stringify(value);
  const entry: CacheEntry<T> = {
    value,
    etag: etag(serialized),
    lastModified: new Date().toUTCString(),
    expires: Date.now() + ttl
  };
  cache.set(key, entry, { ttl });
  return entry;
};

export const deleteCache = (key: string) => {
  cache.delete(key);
};

export const clearCache = () => {
  cache.clear();
};

export const getDefaultTtl = () => DEFAULT_TTL;

export type { CacheEntry };
