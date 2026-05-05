commit # OrbitPay

Liquidity routing engine for the Stellar network. Finds optimal payment paths across the Stellar DEX, predicts slippage before execution, and auto-splits large payments across multiple routes.

## Architecture

```
src/
├── config.ts          # Env-based config
├── logger.ts          # Pino logger
├── metrics.ts         # Prometheus counters/histograms
├── types.ts           # Shared interfaces
├── cache.ts           # Redis cache (ioredis)
├── stellar.ts         # Horizon SDK: paths, orderbooks, tx building
├── slippage.ts        # Orderbook-depth slippage estimation
├── pathfinder.ts      # Route scoring + multi-path split planner
├── routes/
│   └── payments.ts    # POST /quote, POST /execute
├── app.ts             # Express app factory
└── index.ts           # Entry point + graceful shutdown
```

## Quick Start

```bash
cp .env.example .env
# Fill in STELLAR_SECRET_KEY for live execution (optional for simulation)

docker compose up          # starts Redis + app
# or
npm install && npm run dev # local dev with hot reload
```

## API

### POST /api/v1/quote

Find optimal routes for a payment.

```json
{
  "sourceAsset": { "code": "XLM" },
  "destinationAsset": { "code": "USDC", "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  "amount": "100"
}
```

Response includes `bestRoute`, `routes[]`, `splitPlan` (when beneficial), `estimatedSlippage`, and `totalFee`.

### POST /api/v1/execute

Build and optionally submit a path payment transaction.

```json
{
  "sourceAccount": "G...",
  "route": { /* PathRoute from /quote */ },
  "simulate": true
}
```

Set `simulate: false` to sign and submit (requires `STELLAR_SECRET_KEY`). Returns `envelopeXdr` and `transactionHash` on success.

### GET /health

```json
{ "status": "ok" }
```

### GET /metrics

Prometheus metrics endpoint.

## Routing Algorithm

1. Fetch strict-receive payment paths from Horizon for the requested asset pair
2. Fetch orderbook to estimate slippage per route using depth-weighted average price
3. Score routes: `0.6 × slippage + 0.4 × normalizedSourceAmount` (lower = better)
4. If best-route slippage exceeds `2× SLIPPAGE_TOLERANCE` or amount > 10,000, build a split plan distributing the payment across top routes weighted by inverse slippage

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `STELLAR_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `STELLAR_HORIZON_URL` | testnet URL | Horizon endpoint |
| `STELLAR_SECRET_KEY` | — | Signing key (required for live execution) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `CACHE_TTL_SECONDS` | `30` | Liquidity data cache TTL |
| `MAX_PATHS` | `3` | Max routes returned |
| `SLIPPAGE_TOLERANCE` | `0.005` | 0.5% — threshold for split decisions |
| `MAX_SPLIT_PATHS` | `3` | Max legs in a split plan |

## Development

```bash
npm run dev      # ts-node-dev with hot reload
npm test         # Jest (14 tests across api, pathfinder, slippage)
npm run build    # tsc → dist/
```
