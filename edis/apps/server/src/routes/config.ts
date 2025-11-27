import { Router } from 'express';

export const configRouter = Router();

configRouter.get('/google-maps-key', (_req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return res.status(500).json({ code: 'NO_KEY', message: 'Google Maps API key not set' });
  }
  res.json({ key });
});
