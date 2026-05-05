import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  stellar: {
    network: process.env.STELLAR_NETWORK ?? 'testnet',
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    secretKey: process.env.STELLAR_SECRET_KEY ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ttl: parseInt(process.env.CACHE_TTL_SECONDS ?? '30', 10),
  },
  routing: {
    maxPaths: parseInt(process.env.MAX_PATHS ?? '3', 10),
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE ?? '0.005'),
    maxSplitPaths: parseInt(process.env.MAX_SPLIT_PATHS ?? '3', 10),
  },
} as const;
