import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { registry } from './metrics';
import { router as paymentsRouter } from './routes/payments';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.use('/api/v1', paymentsRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}
