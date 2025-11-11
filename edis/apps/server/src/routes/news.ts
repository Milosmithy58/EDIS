import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { geocode } from '../adapters/geocode/nominatim';
import { scrapeNews } from '../adapters/scraper/newsScraper';
import { buildQueryForFilters, filterSlugs } from '../core/news/filters';
import { loadSources } from '../core/secure/sourcesStore';
import { NewsFeedDTO, StandardizedLocation } from '../types/news';

const router = Router();

const newsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(newsLimiter);

const BodySchema = z.object({
  filters: z.array(z.string()).max(28).default([]),
  query: z.string().trim().optional(),
  locationQuery: z.string().trim().optional(),
  since: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional()
});

const parseSince = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
};

const DEFAULT_WINDOW_MS = 1000 * 60 * 60 * 48;

router.post('/scrape', async (req, res) => {
  let payload: z.infer<typeof BodySchema>;
  try {
    payload = BodySchema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues[0]?.message ?? 'Invalid request payload', status: 400 });
      return;
    }
    res.status(400).json({ message: 'Invalid request payload', status: 400 });
    return;
  }

  const invalidFilter = payload.filters.find((slug) => !filterSlugs.has(slug));
  if (invalidFilter) {
    res.status(400).json({ message: `Unknown filter: ${invalidFilter}`, status: 400 });
    return;
  }

  let location: StandardizedLocation | null = null;
  if (payload.locationQuery) {
    location = await geocode(payload.locationQuery);
    if (!location) {
      res.status(400).json({ message: 'Unable to resolve location from query', status: 400 });
      return;
    }
  }

  const sinceDate = parseSince(payload.since) ?? new Date(Date.now() - DEFAULT_WINDOW_MS);

  const sources = await loadSources();
  const domains = sources.domains ?? [];
  if (domains.length === 0) {
    const empty: NewsFeedDTO = { items: [], fetchedAt: new Date().toISOString() };
    res.json(empty);
    return;
  }

  const filterQueries = buildQueryForFilters(payload.filters);
  const keywords = payload.query ? [payload.query] : undefined;

  try {
    const items = await scrapeNews({
      filters: payload.filters,
      filterQueries,
      location,
      keywords,
      domains,
      since: sinceDate,
      limit: payload.limit ?? 50
    });
    const response: NewsFeedDTO = {
      items,
      fetchedAt: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    console.error({ err: error instanceof Error ? error.message : error }, 'Failed to scrape news feed');
    res.status(500).json({ message: 'Failed to scrape news feed', status: 500, retryable: true });
  }
});

router.all('*', (_req, res) => {
  res.status(404).json({ message: 'Not Found', status: 404 });
});

export default router;
