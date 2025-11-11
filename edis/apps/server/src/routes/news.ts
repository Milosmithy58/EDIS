import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { geocode } from '../adapters/geocode/nominatim';
import { scrapeNews } from '../adapters/scraper/newsScraper';
import { buildQueryForFilters, filterSlugs } from '../core/news/filters';
import { loadSources } from '../core/secure/sourcesStore';
import { NewsFeedDTO, StandardizedLocation, StandardizedLocationSchema } from '../types/news';

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

const CursorSchema = z.object({
  filters: z.array(z.string()),
  query: z.string().optional(),
  since: z.string().optional(),
  limit: z.number().int().min(1).max(200),
  page: z.number().int().min(1),
  location: StandardizedLocationSchema.nullable()
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
const DEFAULT_LIMIT = 50;

const encodeCursor = (value: z.infer<typeof CursorSchema>): string => {
  const serialized = JSON.stringify(value);
  const base64 = Buffer.from(serialized, 'utf8').toString('base64');
  return base64.replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
};

const decodeCursor = (value: string): Record<string, unknown> => {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + '='.repeat(padding);
  const decoded = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(decoded) as Record<string, unknown>;
};

const fetchPage = async (
  options: {
    filters: string[];
    filterQueries: string[];
    location: StandardizedLocation | null;
    keywords: string[] | undefined;
    domains: string[];
    since: Date;
  },
  pageSize: number,
  page: number
) => {
  const effectiveLimit = Math.min(pageSize * page, 200);
  const items = await scrapeNews({
    filters: options.filters,
    filterQueries: options.filterQueries,
    location: options.location,
    keywords: options.keywords,
    domains: options.domains,
    since: options.since,
    limit: effectiveLimit
  });
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  const hasMore = effectiveLimit < 200 && items.length === effectiveLimit;
  return { items: pageItems, hasMore };
};

const buildEmptyFeed = (): NewsFeedDTO => ({ items: [], fetchedAt: new Date().toISOString() });

const handlePost = async (req: Request, res: Response) => {
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
    res.json(buildEmptyFeed());
    return;
  }

  const filters = Array.from(new Set(payload.filters));
  const filterQueries = buildQueryForFilters(filters);
  const query = payload.query?.trim();
  const keywords = query ? [query] : undefined;
  const limit = payload.limit ?? DEFAULT_LIMIT;

  try {
    const { items, hasMore } = await fetchPage(
      { filters, filterQueries, location, keywords, domains, since: sinceDate },
      limit,
      1
    );
    const cursorPayload = hasMore
      ? {
          filters,
          query: query ?? undefined,
          since: sinceDate.toISOString(),
          limit,
          page: 2,
          location
        }
      : undefined;
    const response: NewsFeedDTO = {
      items,
      fetchedAt: new Date().toISOString(),
      nextCursor: cursorPayload ? encodeCursor(CursorSchema.parse(cursorPayload)) : undefined
    };
    res.json(response);
  } catch (error) {
    console.error({ err: error instanceof Error ? error.message : error }, 'Failed to scrape news feed');
    res.status(500).json({ message: 'Failed to scrape news feed', status: 500, retryable: true });
  }
};

router.post('/', (req, res) => {
  void handlePost(req, res);
});

router.post('/scrape', (req, res) => {
  void handlePost(req, res);
});

router.get('/', async (req, res) => {
  const nextCursor = typeof req.query.next === 'string' ? req.query.next : undefined;
  if (!nextCursor) {
    res.status(400).json({ message: 'next cursor is required', status: 400 });
    return;
  }

  let decoded: Record<string, unknown>;
  try {
    decoded = decodeCursor(nextCursor);
  } catch (error) {
    res.status(400).json({ message: 'Invalid cursor', status: 400 });
    return;
  }

  let cursor: z.infer<typeof CursorSchema>;
  try {
    cursor = CursorSchema.parse(decoded);
  } catch (error) {
    res.status(400).json({ message: 'Invalid cursor payload', status: 400 });
    return;
  }

  if (cursor.page * cursor.limit > 200) {
    res.status(400).json({ message: 'Cursor exceeds pagination window', status: 400 });
    return;
  }

  const sinceDate = parseSince(cursor.since) ?? new Date(Date.now() - DEFAULT_WINDOW_MS);
  const sources = await loadSources();
  const domains = sources.domains ?? [];
  if (domains.length === 0) {
    res.json(buildEmptyFeed());
    return;
  }

  const filterQueries = buildQueryForFilters(cursor.filters);
  const keywords = cursor.query ? [cursor.query] : undefined;

  try {
    const { items, hasMore } = await fetchPage(
      {
        filters: cursor.filters,
        filterQueries,
        location: cursor.location,
        keywords,
        domains,
        since: sinceDate
      },
      cursor.limit,
      cursor.page
    );
    const response: NewsFeedDTO = {
      items,
      fetchedAt: new Date().toISOString(),
      nextCursor: hasMore
        ? encodeCursor(
            CursorSchema.parse({
              filters: cursor.filters,
              query: cursor.query,
              since: sinceDate.toISOString(),
              limit: cursor.limit,
              page: cursor.page + 1,
              location: cursor.location
            })
          )
        : undefined
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
