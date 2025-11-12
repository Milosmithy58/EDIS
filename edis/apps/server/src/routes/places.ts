import { Router } from 'express';
import { findNearbyPlaces } from '../adapters/places/overpass';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address : '';
    if (!address.trim()) {
      res
        .status(400)
        .json({ code: 'BAD_REQUEST', message: 'address required', source: 'places', status: 400 });
      return;
    }

    const radiusParam = req.query.radius_km;
    let radiusKm: number | undefined;

    if (typeof radiusParam === 'string') {
      radiusKm = Number(radiusParam);
      if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'radius_km must be a positive number',
          source: 'places',
          status: 400
        });
        return;
      }
    }

    const payload = await (radiusKm ? findNearbyPlaces(address, radiusKm) : findNearbyPlaces(address));

    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown places error';
    res.status(502).json({ code: 'PLACES_ERROR', message, source: 'places', status: 502 });
  }
});

export default router;
