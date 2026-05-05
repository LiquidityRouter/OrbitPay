import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { closeRedis } from './cache';

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'OrbitPay started');
});

async function shutdown() {
  logger.info('Shutting down...');
  server.close(async () => {
    await closeRedis();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
