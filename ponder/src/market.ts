export const MARKET_CANDLE_SECONDS = 60n;
export const MARKET_RESOLUTIONS = [1, 5, 15, 60, 240, 1_440] as const;

export type MarketResolution = (typeof MARKET_RESOLUTIONS)[number];

export type MarketCandleRow = Readonly<{
  bucketTimestamp: bigint;
  openSqrtPriceX96: bigint;
  highSqrtPriceX96: bigint;
  lowSqrtPriceX96: bigint;
  closeSqrtPriceX96: bigint;
  volume0: bigint;
  volume1: bigint;
  zeroForOneCount: number;
  oneForZeroCount: number;
  swapCount: number;
  firstBlock: bigint;
  lastBlock: bigint;
}>;

export function absoluteAmount(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function candleBucket(timestamp: bigint, resolutionMinutes = 1): bigint {
  const seconds = BigInt(resolutionMinutes) * MARKET_CANDLE_SECONDS;
  return timestamp - (timestamp % seconds);
}

export function marketCandleKey(deploymentId: string, poolId: string, timestamp: bigint): string {
  return `${deploymentId}:${poolId.toLowerCase()}:${candleBucket(timestamp)}`;
}

export function aggregateMarketCandles(
  rows: readonly MarketCandleRow[],
  resolutionMinutes: MarketResolution
): MarketCandleRow[] {
  const aggregated = new Map<bigint, MarketCandleRow>();
  for (const row of rows) {
    const bucketTimestamp = candleBucket(row.bucketTimestamp, resolutionMinutes);
    const current = aggregated.get(bucketTimestamp);
    if (!current) {
      aggregated.set(bucketTimestamp, { ...row, bucketTimestamp });
      continue;
    }
    aggregated.set(bucketTimestamp, {
      bucketTimestamp,
      openSqrtPriceX96: current.openSqrtPriceX96,
      highSqrtPriceX96:
        current.highSqrtPriceX96 > row.highSqrtPriceX96
          ? current.highSqrtPriceX96
          : row.highSqrtPriceX96,
      lowSqrtPriceX96:
        current.lowSqrtPriceX96 < row.lowSqrtPriceX96
          ? current.lowSqrtPriceX96
          : row.lowSqrtPriceX96,
      closeSqrtPriceX96: row.closeSqrtPriceX96,
      volume0: current.volume0 + row.volume0,
      volume1: current.volume1 + row.volume1,
      zeroForOneCount: current.zeroForOneCount + row.zeroForOneCount,
      oneForZeroCount: current.oneForZeroCount + row.oneForZeroCount,
      swapCount: current.swapCount + row.swapCount,
      firstBlock: current.firstBlock,
      lastBlock: row.lastBlock,
    });
  }
  return [...aggregated.values()].sort((left, right) =>
    left.bucketTimestamp < right.bucketTimestamp
      ? -1
      : left.bucketTimestamp > right.bucketTimestamp
        ? 1
        : 0
  );
}

export function readMarketResolution(value: string | undefined): MarketResolution | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const resolution = Number(value);
  return MARKET_RESOLUTIONS.includes(resolution as MarketResolution)
    ? (resolution as MarketResolution)
    : null;
}
