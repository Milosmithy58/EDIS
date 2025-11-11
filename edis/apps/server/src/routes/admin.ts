import type { Request, RequestHandler } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../core/env';
import { getKey, setKey } from '../core/secrets/secureStore';
import type { ProviderName } from '../core/secrets/types';

const PROVIDERS: ProviderName[] = ['visualcrossing', 'newsapi', 'gnews'];
type Provider = ProviderName;

type RequestWithLogger = Request & {
  log?: {
    info?: (payload: unknown, message?: string) => void;
  };
};

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
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

type TestDetails = {
  status: string;
  providerLatencyMs?: number;
  httpStatus?: number;
  message?: string;
};

type ConnectivityResult = { ok: boolean; details: TestDetails };

const sanitizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
};

const measureFetch = async (input: URL, init?: RequestInit): Promise<{ response: Response; latency: number }> => {
  const signal = AbortSignal.timeout(5000);
  const started = Date.now();
  const response = await fetch(input, { ...(init ?? {}), signal });
  const latency = Date.now() - started;
  return { response, latency };
};

const testVisualCrossing = async (key: string): Promise<ConnectivityResult> => {
  const url = new URL(
    'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/0,0'
  );
  url.searchParams.set('unitGroup', 'metric');
  url.searchParams.set('include', 'current');
  url.searchParams.set('key', key);
  const { response, latency } = await measureFetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    return {
      ok: false,
      details: {
        status: 'http-error',
        providerLatencyMs: latency,
        httpStatus: response.status,
        message: `Visual Crossing responded with status ${response.status}`
      }
    };
  }
  return {
    ok: true,
    details: {
      status: 'ok',
      providerLatencyMs: latency,
      httpStatus: response.status
    }
  };
};

const testNewsApi = async (key: string): Promise<ConnectivityResult> => {
  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q', 'test');
  url.searchParams.set('pageSize', '1');
  const { response, latency } = await measureFetch(url, {
    headers: { 'X-Api-Key': key }
  });
  if (!response.ok) {
    return {
      ok: false,
      details: {
        status: 'http-error',
        providerLatencyMs: latency,
        httpStatus: response.status,
        message: `NewsAPI responded with status ${response.status}`
      }
    };
  }
  return {
    ok: true,
    details: {
      status: 'ok',
      providerLatencyMs: latency,
      httpStatus: response.status
    }
  };
};

const testGNews = async (key: string): Promise<ConnectivityResult> => {
  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q', 'test');
  url.searchParams.set('token', key);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('max', '1');
  const { response, latency } = await measureFetch(url);
  if (!response.ok) {
    return {
      ok: false,
      details: {
        status: 'http-error',
        providerLatencyMs: latency,
        httpStatus: response.status,
        message: `GNews responded with status ${response.status}`
      }
    };
  }
  return {
    ok: true,
    details: {
      status: 'ok',
      providerLatencyMs: latency,
      httpStatus: response.status
    }
  };
};

const resolveProviderKey = async (provider: Provider): Promise<string | undefined> => {
  const stored = await getKey(provider);
  if (stored?.trim()) {
    return stored.trim();
  }
  if (provider === 'visualcrossing') {
    return env.VISUALCROSSING_API_KEY?.trim();
  }
  if (provider === 'newsapi') {
    return env.NEWSAPI_API_KEY?.trim();
  }
  if (provider === 'gnews') {
    return env.GNEWS_API_KEY?.trim();
  }
  return undefined;
};

const runConnectivityCheck = async (provider: Provider): Promise<ConnectivityResult> => {
  try {
    const key = await resolveProviderKey(provider);
    if (!key) {
      return {
        ok: false,
        details: { status: 'missing-key', message: 'No key stored or configured for this provider.' }
      };
    }

    if (provider === 'visualcrossing') {
      return await testVisualCrossing(key);
    }
    if (provider === 'newsapi') {
      return await testNewsApi(key);
    }
    return await testGNews(key);
  } catch (error) {
    return {
      ok: false,
      details: {
        status: 'network-error',
        message: `Connectivity check failed: ${sanitizeError(error)}`
      }
    };
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
    const reqWithLogger = req as RequestWithLogger;
    if (typeof reqWithLogger.log?.info === 'function') {
      reqWithLogger.log.info({ provider }, 'Provider key rotated');
    }
    res.status(204).send();
  } catch (error) {
    const message = sanitizeError(error);
    res.status(500).json({ message: `Failed to persist provider key: ${message}`, status: 500 });
  }
});

adminRouter.post('/test', testLimiter, async (req, res) => {
  const { provider } = (req.body ?? {}) as { provider?: Provider };
  if (!provider || !PROVIDERS.includes(provider)) {
    res.status(400).json({ message: 'provider must be one of visualcrossing, newsapi, or gnews', status: 400 });
    return;
  }
  const result = await runConnectivityCheck(provider);
  res.json(result);
});

export default adminRouter;
