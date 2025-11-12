import { Router } from 'express';
import { scrapeForLocation } from '../adapters/scraper/scrapeForLocation';

export const scrapeRouter = Router();

/**
 * GET /api/scrape?q=<text>&lat=<num>&lon=<num>&filters=crime,weather,...
 * Returns normalized articles: { title, url, source, publishedAt, tags, location }
 */
scrapeRouter.get('/', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const lon = req.query.lon !== undefined ? Number(req.query.lon) : undefined;
    const filters = typeof req.query.filters === 'string'
      ? (req.query.filters as string)
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!q && (lat === undefined || lon === undefined)) {
      return res
        .status(400)
        .json({ code: 'BAD_REQUEST', message: 'Provide q or lat+lon', status: 400, source: 'scrape' });
    }

    const results = await scrapeForLocation({ q, lat, lon, filters });
    res.json(results);
  } catch (err: any) {
    console.error('[/api/scrape] error', err);
    res
      .status(500)
      .json({ code: 'SCRAPE_ERROR', message: err?.message || 'Unknown error', status: 500, source: 'scrape' });
  }
});

export default scrapeRouter;
