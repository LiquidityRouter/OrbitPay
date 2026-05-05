import {
  Horizon,
  Asset as StellarAsset,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { config } from './config';
import { Asset, PathRoute } from './types';
import { cacheGet, cacheSet } from './cache';
import { logger } from './logger';

const server = new Horizon.Server(config.stellar.horizonUrl);

export function toStellarAsset(a: Asset): StellarAsset {
  return a.issuer ? new StellarAsset(a.code, a.issuer) : StellarAsset.native();
}

export function fromStellarAsset(a: StellarAsset): Asset {
  return a.isNative() ? { code: 'XLM' } : { code: a.getCode(), issuer: a.getIssuer() };
}

/** Fetch strict-receive payment paths from Horizon */
export async function fetchPaymentPaths(
  sourceAsset: Asset,
  destAsset: Asset,
  destAmount: string,
): Promise<PathRoute[]> {
  const cacheKey = `paths:${sourceAsset.code}:${destAsset.code}:${destAmount}`;
  const cached = await cacheGet<PathRoute[]>(cacheKey);
  if (cached) return cached;

  const src = toStellarAsset(sourceAsset);
  const dst = toStellarAsset(destAsset);

  const resp = await server
    .strictReceivePaths([src], dst, destAmount)
    .call()
    .catch((err) => {
      logger.warn({ err }, 'Horizon path fetch failed');
      return { records: [] };
    });

  const routes: PathRoute[] = (resp.records ?? []).map((r: Horizon.ServerApi.PaymentPathRecord) => ({
    path: [
      fromStellarAsset(src),
      ...r.path.map((p) =>
        p.asset_type === 'native'
          ? { code: 'XLM' }
          : { code: p.asset_code, issuer: p.asset_issuer },
      ),
      fromStellarAsset(dst),
    ],
    sourceAmount: r.source_amount,
    destinationAmount: destAmount,
    fee: String(BASE_FEE),
    estimatedSlippage: 0,
  }));

  await cacheSet(cacheKey, routes);
  return routes;
}

/** Fetch orderbook for a trading pair */
export async function fetchOrderbook(
  buying: Asset,
  selling: Asset,
): Promise<Horizon.ServerApi.OrderbookRecord> {
  const cacheKey = `ob:${buying.code}:${selling.code}`;
  const cached = await cacheGet<Horizon.ServerApi.OrderbookRecord>(cacheKey);
  if (cached) return cached;

  const ob = await server
    .orderbook(toStellarAsset(buying), toStellarAsset(selling))
    .call();

  await cacheSet(cacheKey, ob);
  return ob;
}

/** Build and optionally submit a path payment transaction */
export async function buildPathPayment(
  route: PathRoute,
  sourceAccount: string,
  simulate: boolean,
): Promise<{ xdr: string; hash?: string }> {
  const account = await server.loadAccount(sourceAccount);
  const network = config.stellar.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const sendAsset = toStellarAsset(route.path[0]);
  const destAsset = toStellarAsset(route.path[route.path.length - 1]);
  const intermediary = route.path.slice(1, -1).map(toStellarAsset);

  // Add 1% buffer on sendMax to account for slippage
  const sendMax = (parseFloat(route.sourceAmount) * 1.01).toFixed(7);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax,
        destination: sourceAccount,
        destAsset,
        destAmount: route.destinationAmount,
        path: intermediary,
      }),
    )
    .setTimeout(30)
    .build();

  const xdr = tx.toXDR();

  if (simulate) return { xdr };

  if (!config.stellar.secretKey) throw new Error('STELLAR_SECRET_KEY not configured');
  const keypair = Keypair.fromSecret(config.stellar.secretKey);
  tx.sign(keypair);

  const result = await server.submitTransaction(tx);
  return { xdr, hash: result.hash };
}
