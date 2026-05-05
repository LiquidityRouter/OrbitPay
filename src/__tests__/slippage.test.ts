import { estimateSlippageFromOrderbook, calculateFees } from '../slippage';
import { PathRoute } from '../types';
import { Horizon } from '@stellar/stellar-sdk';

const makeLevel = (price: string, amount: string) => ({
  price,
  amount,
  price_r: { n: Math.round(parseFloat(price) * 100), d: 100 },
});

const makeOrderbook = (asks: ReturnType<typeof makeLevel>[]): Horizon.ServerApi.OrderbookRecord =>
  ({ asks, bids: [], base: {} as any, counter: {} as any, _links: {} as any });

describe('estimateSlippageFromOrderbook', () => {
  it('returns 0 slippage when single level fills exactly', () => {
    const ob = makeOrderbook([makeLevel('1.0', '1000')]);
    expect(estimateSlippageFromOrderbook(ob, 500, 'buy')).toBe(0);
  });

  it('returns 1 when no liquidity', () => {
    const ob = makeOrderbook([]);
    expect(estimateSlippageFromOrderbook(ob, 100, 'buy')).toBe(1);
  });

  it('returns 1 when insufficient liquidity', () => {
    const ob = makeOrderbook([makeLevel('1.0', '10')]);
    expect(estimateSlippageFromOrderbook(ob, 100, 'buy')).toBe(1);
  });

  it('calculates weighted slippage across levels', () => {
    const ob = makeOrderbook([makeLevel('1.0', '50'), makeLevel('1.1', '50')]);
    const slippage = estimateSlippageFromOrderbook(ob, 100, 'buy');
    expect(slippage).toBeCloseTo(0.05, 5);
  });
});

describe('calculateFees', () => {
  it('sums fees across routes', () => {
    const routes: PathRoute[] = [
      { path: [], sourceAmount: '10', destinationAmount: '10', fee: '100', estimatedSlippage: 0 },
      { path: [], sourceAmount: '10', destinationAmount: '10', fee: '200', estimatedSlippage: 0 },
    ];
    expect(calculateFees(routes)).toBe('300.0000000');
  });
});
