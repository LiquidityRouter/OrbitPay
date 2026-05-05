import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const quoteRequests = new Counter({
  name: 'orbitpay_quote_requests_total',
  help: 'Total quote requests',
  labelNames: ['status'],
  registers: [registry],
});

export const executeRequests = new Counter({
  name: 'orbitpay_execute_requests_total',
  help: 'Total execute requests',
  labelNames: ['status', 'simulated'],
  registers: [registry],
});

export const routingDuration = new Histogram({
  name: 'orbitpay_routing_duration_seconds',
  help: 'Time spent computing routes',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [registry],
});

export const cacheHits = new Counter({
  name: 'orbitpay_cache_hits_total',
  help: 'Redis cache hits',
  labelNames: ['hit'],
  registers: [registry],
});
