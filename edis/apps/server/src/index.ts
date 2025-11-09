import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import geocodeRouter from './routes/geocode';
import weatherRouter from './routes/weather';
import crimeRouter from './routes/crime';
import newsRouter from './routes/news';
import { env } from './core/env';

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173'],
    methods: ['GET'],
    maxAge: 600
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(
  pinoHttp({
    logger,
    autoLogging: env.NODE_ENV !== 'test'
  })
);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/geocode', geocodeRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/crime', crimeRouter);
app.use('/api/news', newsRouter);

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ message: 'Internal server error', status: 500 });
});

const port = env.PORT;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info(`EDIS API listening on http://localhost:${port}`);
  });
}

export default app;
