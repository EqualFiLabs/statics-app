export type MarketDataStatus = "fresh" | "stale" | "partial";

export type MarketDepthLevel = Readonly<{
  targetImpactBps: number;
  actualImpactBps: number;
  inputToken: "WETH" | "STATICS";
  outputToken: "WETH" | "STATICS";
  amountIn: string;
  amountOut: string;
  inputUsdWad: string | null;
}>;

export type StaticsMarketOverview = Readonly<{
  schemaVersion: 1;
  status: MarketDataStatus;
  chainId: number;
  deploymentId: string;
  poolId: string;
  asOfBlock: string;
  price: Readonly<{
    staticsPerWethWad: string;
    wethPerStaticsWad: string;
    ethUsdWad: string | null;
    staticsUsdWad: string | null;
  }>;
  supply: Readonly<{
    total: string;
    poolInventory: string;
    publicDistributed: string;
    unreleasedTreasury: string;
    vaultBacking: string;
    strictLiquidFloat: string;
  }>;
  valuation: Readonly<{
    fdvUsdWad: string | null;
    publicMarketCapUsdWad: string | null;
    liquidFloatMarketCapUsdWad: string | null;
  }>;
  liquidity: Readonly<{
    principalWeth: string;
    principalStatics: string;
    tvlUsdWad: string | null;
  }>;
  activity24h: Readonly<{
    available: boolean;
    wethVolume: string;
    staticsVolume: string;
    swaps: number;
    buys: number;
    sells: number;
    priceChangeBps: number;
    highWethPerStaticsWad: string | null;
    lowWethPerStaticsWad: string | null;
    lastWethPerStaticsWad: string | null;
    lastTradeAt: string | null;
  }>;
  depth: Readonly<{
    buyStatics: readonly MarketDepthLevel[];
    sellStatics: readonly MarketDepthLevel[];
  }> | null;
  freshness: Readonly<{
    indexedAt: string | null;
    snapshotAt: string;
    depthAt: string | null;
    usdPriceAt: string | null;
    usdPriceStale: boolean;
  }>;
}>;

export type MarketSupplySnapshot = Readonly<{
  status: "fresh" | "stale";
  chainId: number;
  deploymentId: string;
  tokenAddress: string;
  decimals: 18;
  asOfBlock: string;
  snapshotAt: string;
  total: string;
  poolInventory: string;
  publicDistributed: string;
  unreleasedTreasury: string;
  vaultBacking: string;
  strictLiquidFloat: string;
}>;
