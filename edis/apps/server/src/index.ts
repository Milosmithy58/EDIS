import 'undici/register';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import geocodeRouter from './routes/geocode';
import weatherRouter from './routes/weather';
import crimeRouter from './routes/crime';
import newsRouter from './routes/news';
import adminRouter from './routes/admin';
import femaRouter from './routes/fema';
import ticketsRouter from './routes/tickets';
import placesRouter from './routes/places';
import { env } from './core/env';
import crimeNewsRoutes from './routes/crimeNewsRoutes';
import { scrapeRouter } from './routes/scrape';

const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 600
  })
);

app.use(express.json({ limit: '16kb' }));

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

app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'EDIS API is running. Refer to /healthz for status and /api/* for resources.'
  });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/geocode', geocodeRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/crime', crimeRouter);
app.use('/api/news', newsRouter);
app.use('/api', crimeNewsRoutes);
app.use('/api/scrape', scrapeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/fema', femaRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/places', placesRouter);

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
