export interface Asset {
  code: string;
  issuer?: string; // undefined = XLM (native)
}

export interface PathRoute {
  path: Asset[];
  sourceAmount: string;
  destinationAmount: string;
  fee: string;
  estimatedSlippage: number;
}

export interface QuoteResult {
  sourceAsset: Asset;
  destinationAsset: Asset;
  requestedAmount: string;
  routes: PathRoute[];
  splitPlan: SplitPlan | null;
  bestRoute: PathRoute;
  totalFee: string;
  estimatedSlippage: number;
  cachedAt: number;
}

export interface SplitPlan {
  splits: Array<{ route: PathRoute; amount: string; fraction: number }>;
  totalSourceAmount: string;
  totalDestinationAmount: string;
}

export interface ExecuteResult {
  simulated: boolean;
  success: boolean;
  transactionHash?: string;
  envelopeXdr?: string;
  error?: string;
}
