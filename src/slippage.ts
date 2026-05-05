import { Horizon } from '@stellar/stellar-sdk';
import { PathRoute } from './types';

/**
 * Estimate slippage from orderbook depth.
 * Walks asks/bids to see how much price moves to fill `amount`.
 */
export function estimateSlippageFromOrderbook(
  orderbook: Horizon.ServerApi.OrderbookRecord,
  amount: number,
  side: 'buy' | 'sell',
): number {
  const levels = side === 'buy' ? orderbook.asks : orderbook.bids;
  if (!levels.length) return 1; // 100% slippage if no liquidity

  const bestPrice = parseFloat(levels[0].price);
  let remaining = amount;
  let weightedPrice = 0;

  for (const level of levels) {
    const levelAmount = parseFloat(level.amount);
    const levelPrice = parseFloat(level.price);
    const filled = Math.min(remaining, levelAmount);
    weightedPrice += filled * levelPrice;
    remaining -= filled;
    if (remaining <= 0) break;
  }

  if (remaining > 0) return 1; // not enough liquidity

  const avgPrice = weightedPrice / amount;
  return Math.abs(avgPrice - bestPrice) / bestPrice;
}

/** Annotate routes with slippage estimates based on source amount */
export function annotateSlippage(
  routes: PathRoute[],
  orderbook: Horizon.ServerApi.OrderbookRecord,
): PathRoute[] {
  return routes.map((r) => ({
    ...r,
    estimatedSlippage: estimateSlippageFromOrderbook(
      orderbook,
      parseFloat(r.sourceAmount),
      'buy',
    ),
  }));
}

/** Calculate total fee for a set of routes */
export function calculateFees(routes: PathRoute[]): string {
  const total = routes.reduce((sum, r) => sum + parseFloat(r.fee), 0);
  return total.toFixed(7);
}
