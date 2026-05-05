import { computeQuote } from '../pathfinder';
import * as stellar from '../stellar';
import * as cache from '../cache';

jest.mock('../stellar');
jest.mock('../cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

const mockOrderbook = {
  asks: [{ price: '1.0', amount: '10000' }],
  bids: [],
  base: {},
  counter: {},
};

const mockRoutes = [
  {
    path: [{ code: 'XLM' }, { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }],
    sourceAmount: '100',
    destinationAmount: '10',
    fee: '100',
    estimatedSlippage: 0,
  },
  {
    path: [{ code: 'XLM' }, { code: 'BTC', issuer: 'GDXTJEK4JZNSTNQAWA53RZNS2GIKTDRPEUWDXELFMKU52XNECNVDVXDI' }, { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }],
    sourceAmount: '105',
    destinationAmount: '10',
    fee: '100',
    estimatedSlippage: 0,
  },
];

beforeEach(() => {
  jest.spyOn(stellar, 'fetchPaymentPaths').mockResolvedValue(mockRoutes);
  jest.spyOn(stellar, 'fetchOrderbook').mockResolvedValue(mockOrderbook as any);
});

describe('computeQuote', () => {
  const src = { code: 'XLM' };
  const dst = { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' };

  it('returns a quote with best route', async () => {
    const quote = await computeQuote(src, dst, '10');
    expect(quote.bestRoute).toBeDefined();
    expect(quote.routes.length).toBeGreaterThan(0);
    expect(quote.sourceAsset).toEqual(src);
    expect(quote.destinationAsset).toEqual(dst);
  });

  it('throws when no routes found', async () => {
    jest.spyOn(stellar, 'fetchPaymentPaths').mockResolvedValue([]);
    await expect(computeQuote(src, dst, '10')).rejects.toThrow('No routes found');
  });

  it('best route has lowest score (cheapest)', async () => {
    const quote = await computeQuote(src, dst, '10');
    // Route with sourceAmount=100 should beat 105
    expect(parseFloat(quote.bestRoute.sourceAmount)).toBeLessThanOrEqual(
      parseFloat(quote.routes[quote.routes.length - 1].sourceAmount),
    );
  });
});
