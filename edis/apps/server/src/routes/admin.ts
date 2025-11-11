import type { RequestHandler } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../core/env';
import { getKey, setKey } from '../core/secrets/secureStore';
import type { ProviderName } from '../core/secrets/types';

const PROVIDERS: ProviderName[] = ['visualcrossing', 'newsapi', 'gnews'];
type Provider = ProviderName;

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized', status: 401 });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token || token !== env.ADMIN_TOKEN) {
    res.status(401).json({ message: 'Unauthorized', status: 401 });
    return;
  }
  next();
};

const sanitizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
};

const testVisualCrossing = async (key: string): Promise<{ ok: boolean; details: string }> => {
  const url = new URL(
    'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/40.7128,-74.0060'
  );
  url.searchParams.set('unitGroup', 'metric');
  url.searchParams.set('include', 'current');
  url.searchParams.set('key', key);
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    return { ok: false, details: `Visual Crossing responded with status ${response.status}` };
  }
  return { ok: true, details: 'Visual Crossing key accepted (sample request succeeded).' };
};

const testNewsApi = async (key: string): Promise<{ ok: boolean; details: string }> => {
  const url = new URL('https://newsapi.org/v2/top-headlines');
  url.searchParams.set('country', 'us');
  url.searchParams.set('pageSize', '1');
  const response = await fetch(url, {
    headers: { 'X-Api-Key': key },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    return { ok: false, details: `NewsAPI responded with status ${response.status}` };
  }
  return { ok: true, details: 'NewsAPI key accepted (sample request succeeded).' };
};

const testGNews = async (key: string): Promise<{ ok: boolean; details: string }> => {
  const url = new URL('https://gnews.io/api/v4/top-headlines');
  url.searchParams.set('token', key);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('country', 'us');
  url.searchParams.set('max', '1');
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    return { ok: false, details: `GNews responded with status ${response.status}` };
  }
  return { ok: true, details: 'GNews key accepted (sample request succeeded).' };
};

const runConnectivityCheck = async (provider: Provider): Promise<{ ok: boolean; details: string }> => {
  const key = await getKey(provider);
  if (!key) {
    return { ok: false, details: 'No key stored for this provider.' };
  }
  if (env.NODE_ENV === 'test') {
    return { ok: true, details: 'Connectivity check skipped in test environment.' };
  }
  try {
    if (provider === 'visualcrossing') {
      return await testVisualCrossing(key);
    }
    if (provider === 'newsapi') {
      return await testNewsApi(key);
    }
    return await testGNews(key);
  } catch (error) {
    return { ok: false, details: `Connectivity check failed: ${sanitizeError(error)}` };
  }
};

const adminRouter = Router();

adminRouter.use(adminLimiter);
adminRouter.use(requireAdmin);

adminRouter.get('/providers', (req, res) => {
  res.json({ providers: PROVIDERS });
});

adminRouter.post('/keys', async (req, res) => {
  const { provider, secret } = (req.body ?? {}) as { provider?: Provider; secret?: string };
  if (!provider || !PROVIDERS.includes(provider)) {
    res.status(400).json({ message: 'provider must be one of visualcrossing, newsapi, or gnews', status: 400 });
    return;
  }
  if (typeof secret !== 'string' || !secret.trim()) {
    res.status(400).json({ message: 'secret must be a non-empty string', status: 400 });
    return;
  }
  try {
    await setKey(provider, secret);
    if ('log' in req && typeof (req as any).log?.info === 'function') {
      (req as any).log.info({ provider }, 'Provider key rotated');
    }
    res.status(204).send();
  } catch (error) {
    const message = sanitizeError(error);
    res.status(500).json({ message: `Failed to persist provider key: ${message}`, status: 500 });
  }
});

adminRouter.post('/test', async (req, res) => {
  const { provider } = (req.body ?? {}) as { provider?: Provider };
  if (!provider || !PROVIDERS.includes(provider)) {
    res.status(400).json({ message: 'provider must be one of visualcrossing, newsapi, or gnews', status: 400 });
    return;
  }
  const result = await runConnectivityCheck(provider);
  res.json(result);
});

export default adminRouter;
