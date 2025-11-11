import type { Request, Response } from 'express';
import { Router } from 'express';
import { getTicketsForArea } from '../adapters/tickets';
import type { TicketAreaContext } from '../adapters/tickets';

const router = Router();

const parseNumber = (value?: string | string[]) => {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const sanitizeString = (value?: string | string[]) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

router.get('/', async (req: Request, res: Response) => {
  const lat = parseNumber(req.query.lat);
  const lon = parseNumber(req.query.lon);
  const countryCode = sanitizeString((req.query.countryCode as string) || (req.query.country as string));
  const admin1 = sanitizeString(req.query.admin1 as string);
  const admin2 = sanitizeString(req.query.admin2 as string);
  const city = sanitizeString(req.query.city as string);
  const postalCode = sanitizeString(req.query.postalCode as string);

  if (!countryCode && lat === undefined && lon === undefined && !city && !admin1) {
    res.status(400).json({ message: 'A countryCode or coordinates are required', status: 400 });
    return;
  }

  if ((lat === undefined) !== (lon === undefined)) {
    res
      .status(400)
      .json({ message: 'Both lat and lon are required when specifying coordinates', status: 400 });
    return;
  }

  const context: TicketAreaContext = {
    countryCode: countryCode?.toUpperCase(),
    admin1,
    admin2,
    city,
    postalCode,
    lat,
    lon
  };

  try {
    const payload = await getTicketsForArea(context);
    res.json({ tickets: payload.tickets, source_errors: payload.sourceErrors });
  } catch (error) {
    console.error('Failed to load tickets', error);
    res.status(500).json({ message: 'Failed to load tickets', status: 500, code: 'TICKETS_ERROR' });
  }
});

export default router;
