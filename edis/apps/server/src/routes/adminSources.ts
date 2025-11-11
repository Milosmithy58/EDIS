import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { loadSources, updateSources } from '../core/secure/sourcesStore';

const router = Router();

const adminSourcesLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(adminSourcesLimiter);

router.get('/', async (_req, res) => {
  const sources = await loadSources();
  res.json(sources);
});

const UpsertSchema = z.object({
  domains: z.array(z.string().min(1, 'domain entries must be non-empty strings')).max(200).default([]),
  blocked: z.array(z.string().min(1)).max(200).optional(),
  updatedBy: z.string().min(1).optional()
});

router.post('/', async (req, res) => {
  try {
    const payload = UpsertSchema.parse(req.body ?? {});
    const actor = payload.updatedBy ?? 'admin';
    const normalizedDomains = payload.domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    const normalizedBlocked = payload.blocked?.map((domain) => domain.trim().toLowerCase()).filter(Boolean);

    const result = await updateSources(normalizedDomains, normalizedBlocked, actor);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0]?.message ?? 'Invalid payload', status: 400 });
      return;
    }
    console.error({ err: error }, 'Failed to persist scrape sources');
    res.status(500).json({ message: 'Failed to persist scrape sources', status: 500 });
  }
});

const TestSchema = z.object({
  domains: z.array(z.string().min(1)).min(1, 'At least one domain required')
});

type ReachabilityResult = {
  domain: string;
  ok: boolean;
  status?: number;
  robotsAllowed?: boolean;
  error?: string;
};

const fetchWithTimeout = async (url: URL): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const testDomain = async (domain: string): Promise<ReachabilityResult> => {
  try {
    const url = new URL(`https://${domain.replace(/^https?:\/\//, '')}/robots.txt`);
    const response = await fetchWithTimeout(url);
    return {
      domain,
      ok: response.ok,
      status: response.status,
      robotsAllowed: response.status === 200
    };
  } catch (error) {
    return {
      domain,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

router.post('/test', async (req, res) => {
  try {
    const { domains } = TestSchema.parse(req.body ?? {});
    const results = await Promise.all(domains.map((domain) => testDomain(domain)));
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0]?.message ?? 'Invalid payload', status: 400 });
      return;
    }
    console.error({ err: error }, 'Failed to test scrape source domains');
    res.status(500).json({ message: 'Failed to test scrape source domains', status: 500 });
  }
});

export default router;
