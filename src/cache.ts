import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';
import { cacheHits } from './metrics';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redis.url, { lazyConnect: true, maxRetriesPerRequest: 2 });
    client.on('error', (err) => logger.warn({ err }, 'Redis error'));
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const val = await getRedis().get(key);
    const hit = val !== null;
    cacheHits.inc({ hit: String(hit) });
    return hit ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = config.redis.ttl): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // non-fatal
  }
}

export async function closeRedis(): Promise<void> {
  await client?.quit();
  client = null;
}
