import request from 'supertest';
import { createApp } from '../app';
import * as pathfinder from '../pathfinder';
import * as stellar from '../stellar';

jest.mock('../pathfinder');
jest.mock('../stellar');
jest.mock('../cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  getRedis: jest.fn(),
}));

const mockQuote = {
  sourceAsset: { code: 'XLM' },
  destinationAsset: { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
  requestedAmount: '10',
  routes: [],
  splitPlan: null,
  bestRoute: { path: [], sourceAmount: '100', destinationAmount: '10', fee: '100', estimatedSlippage: 0.001 },
  totalFee: '100',
  estimatedSlippage: 0.001,
  cachedAt: Date.now(),
};

const app = createApp();

describe('POST /api/v1/quote', () => {
  beforeEach(() => {
    jest.spyOn(pathfinder, 'computeQuote').mockResolvedValue(mockQuote);
  });

  it('returns 200 with valid body', async () => {
    const res = await request(app).post('/api/v1/quote').send({
      sourceAsset: { code: 'XLM' },
      destinationAsset: { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
      amount: '10',
    });
    expect(res.status).toBe(200);
    expect(res.body.bestRoute).toBeDefined();
  });

  it('returns 400 for invalid amount', async () => {
    const res = await request(app).post('/api/v1/quote').send({
      sourceAsset: { code: 'XLM' },
      destinationAsset: { code: 'USDC' },
      amount: 'not-a-number',
    });
    expect(res.status).toBe(400);
  });

  it('returns 502 when pathfinder throws', async () => {
    jest.spyOn(pathfinder, 'computeQuote').mockRejectedValue(new Error('No routes found'));
    const res = await request(app).post('/api/v1/quote').send({
      sourceAsset: { code: 'XLM' },
      destinationAsset: { code: 'USDC' },
      amount: '10',
    });
    expect(res.status).toBe(502);
  });
});

describe('POST /api/v1/execute', () => {
  const validBody = {
    sourceAccount: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNG',
    route: {
      path: [{ code: 'XLM' }, { code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }],
      sourceAmount: '100',
      destinationAmount: '10',
      fee: '100',
      estimatedSlippage: 0.001,
    },
    simulate: true,
  };

  it('returns 200 with simulated XDR', async () => {
    jest.spyOn(stellar, 'buildPathPayment').mockResolvedValue({ xdr: 'AAAA...', hash: undefined });
    const res = await request(app).post('/api/v1/execute').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.envelopeXdr).toBe('AAAA...');
    expect(res.body.simulated).toBe(true);
  });

  it('returns 400 for invalid account', async () => {
    const res = await request(app).post('/api/v1/execute').send({ ...validBody, sourceAccount: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
