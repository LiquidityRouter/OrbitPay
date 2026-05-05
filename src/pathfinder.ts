import { Asset, PathRoute, QuoteResult, SplitPlan } from './types';
import { fetchPaymentPaths, fetchOrderbook } from './stellar';
import { annotateSlippage, calculateFees } from './slippage';
import { config } from './config';
import { routingDuration } from './metrics';

/**
 * Score a route: lower is better.
 * Weights: 60% slippage, 40% source amount (normalized).
 */
function scoreRoute(route: PathRoute, maxSourceAmount: number): number {
  const normalizedAmount = parseFloat(route.sourceAmount) / maxSourceAmount;
  return 0.6 * route.estimatedSlippage + 0.4 * normalizedAmount;
}

/**
 * Split a large amount across multiple routes to minimize slippage.
 * Uses a greedy approach: allocate proportionally to available liquidity.
 */
function buildSplitPlan(routes: PathRoute[], totalAmount: string): SplitPlan {
  const total = parseFloat(totalAmount);
  const topRoutes = routes.slice(0, config.routing.maxSplitPaths);

  // Weight by inverse slippage (better routes get more)
  const weights = topRoutes.map((r) => 1 / (r.estimatedSlippage + 0.001));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  let totalDest = 0;
  let totalSrc = 0;

  const splits = topRoutes.map((route, i) => {
    const fraction = weights[i] / weightSum;
    const amount = (total * fraction).toFixed(7);
    const destAmount = (parseFloat(route.destinationAmount) * fraction).toFixed(7);
    totalDest += parseFloat(destAmount);
    totalSrc += parseFloat(amount);
    return { route, amount, fraction };
  });

  return {
    splits,
    totalSourceAmount: totalSrc.toFixed(7),
    totalDestinationAmount: totalDest.toFixed(7),
  };
}

/** Determine if splitting is beneficial: slippage reduction > 20% */
function shouldSplit(routes: PathRoute[], amount: number): boolean {
  if (routes.length < 2) return false;
  const bestSlippage = routes[0].estimatedSlippage;
  // Split when best route slippage is high or amount is large relative to liquidity
  return bestSlippage > config.routing.slippageTolerance * 2 || amount > 10000;
}

export async function computeQuote(
  sourceAsset: Asset,
  destAsset: Asset,
  amount: string,
): Promise<QuoteResult> {
  const end = routingDuration.startTimer();

  const [rawRoutes, orderbook] = await Promise.all([
    fetchPaymentPaths(sourceAsset, destAsset, amount),
    fetchOrderbook(destAsset, sourceAsset),
  ]);

  if (!rawRoutes.length) {
    end();
    throw new Error(`No routes found for ${sourceAsset.code} → ${destAsset.code}`);
  }

  // Annotate with slippage and sort by score
  const routes = annotateSlippage(rawRoutes, orderbook);
  const maxSrc = Math.max(...routes.map((r) => parseFloat(r.sourceAmount)));
  const sorted = routes
    .sort((a, b) => scoreRoute(a, maxSrc) - scoreRoute(b, maxSrc))
    .slice(0, config.routing.maxPaths);

  const bestRoute = sorted[0];
  const splitPlan = shouldSplit(sorted, parseFloat(amount))
    ? buildSplitPlan(sorted, amount)
    : null;

  end();

  return {
    sourceAsset,
    destinationAsset: destAsset,
    requestedAmount: amount,
    routes: sorted,
    splitPlan,
    bestRoute,
    totalFee: calculateFees(sorted),
    estimatedSlippage: bestRoute.estimatedSlippage,
    cachedAt: Date.now(),
  };
}
