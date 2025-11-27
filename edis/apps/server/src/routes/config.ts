import { Router } from 'express';

export const configRouter = Router();

configRouter.get('/mapbox-token', (_req, res) => {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    return res.status(500).json({ code: 'NO_TOKEN', message: 'Mapbox token not set' });
  }
  res.json({ token });
});
