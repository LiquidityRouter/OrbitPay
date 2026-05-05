import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { computeQuote } from '../pathfinder';
import { buildPathPayment } from '../stellar';
import { quoteRequests, executeRequests } from '../metrics';
import { logger } from '../logger';
import { ExecuteResult } from '../types';

export const router = Router();

const AssetSchema = z.object({
  code: z.string().min(1).max(12),
  issuer: z.string().optional(),
});

const QuoteSchema = z.object({
  sourceAsset: AssetSchema,
  destinationAsset: AssetSchema,
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/, 'Invalid amount'),
});

const ExecuteSchema = z.object({
  sourceAccount: z.string().length(56),
  route: z.object({
    path: z.array(AssetSchema).min(2),
    sourceAmount: z.string(),
    destinationAmount: z.string(),
    fee: z.string(),
    estimatedSlippage: z.number(),
  }),
  simulate: z.boolean().default(true),
});

function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}

router.post('/quote', validate(QuoteSchema), async (req: Request, res: Response) => {
  const { sourceAsset, destinationAsset, amount } = req.body;
  try {
    const quote = await computeQuote(sourceAsset, destinationAsset, amount);
    quoteRequests.inc({ status: 'success' });
    res.json(quote);
  } catch (err) {
    quoteRequests.inc({ status: 'error' });
    logger.error({ err }, 'Quote failed');
    res.status(502).json({ error: (err as Error).message });
  }
});

router.post('/execute', validate(ExecuteSchema), async (req: Request, res: Response) => {
  const { sourceAccount, route, simulate } = req.body;
  const result: ExecuteResult = { simulated: simulate, success: false };
  try {
    const { xdr, hash } = await buildPathPayment(route, sourceAccount, simulate);
    result.success = true;
    result.envelopeXdr = xdr;
    if (hash) result.transactionHash = hash;
    executeRequests.inc({ status: 'success', simulated: String(simulate) });
    res.json(result);
  } catch (err) {
    result.error = (err as Error).message;
    executeRequests.inc({ status: 'error', simulated: String(simulate) });
    logger.error({ err }, 'Execute failed');
    res.status(502).json(result);
  }
});
