import { describe, expect, it } from "vitest";

import {
  absoluteAmount,
  aggregateMarketCandles,
  candleBucket,
  marketCandleKey,
  readMarketResolution,
  type MarketCandleRow,
} from "../src/market";

function candle(overrides: Partial<MarketCandleRow> = {}): MarketCandleRow {
  return {
    bucketTimestamp: 120n,
    openSqrtPriceX96: 10n,
    highSqrtPriceX96: 12n,
    lowSqrtPriceX96: 9n,
    closeSqrtPriceX96: 11n,
    volume0: 5n,
    volume1: 50n,
    zeroForOneCount: 1,
    oneForZeroCount: 0,
    swapCount: 1,
    firstBlock: 10n,
    lastBlock: 10n,
    ...overrides,
  };
}

describe("canonical market candles", () => {
  it("normalizes signed swap amounts and minute buckets", () => {
    expect(absoluteAmount(-42n)).toBe(42n);
    expect(candleBucket(179n)).toBe(120n);
    expect(marketCandleKey("launch", `0x${"12".repeat(32)}`, 179n)).toContain(":120");
  });

  it("aggregates exact OHLC, volume, direction counts, and block bounds", () => {
    const result = aggregateMarketCandles(
      [
        candle(),
        candle({
          bucketTimestamp: 180n,
          openSqrtPriceX96: 11n,
          highSqrtPriceX96: 15n,
          lowSqrtPriceX96: 8n,
          closeSqrtPriceX96: 14n,
          volume0: 7n,
          volume1: 70n,
          zeroForOneCount: 0,
          oneForZeroCount: 2,
          swapCount: 2,
          firstBlock: 11n,
          lastBlock: 12n,
        }),
      ],
      5
    );

    expect(result).toEqual([
      candle({
        bucketTimestamp: 0n,
        highSqrtPriceX96: 15n,
        lowSqrtPriceX96: 8n,
        closeSqrtPriceX96: 14n,
        volume0: 12n,
        volume1: 120n,
        zeroForOneCount: 1,
        oneForZeroCount: 2,
        swapCount: 3,
        lastBlock: 12n,
      }),
    ]);
  });

  it("accepts only supported TradingView resolutions", () => {
    expect(readMarketResolution("240")).toBe(240);
    expect(readMarketResolution("2")).toBeNull();
  });
});
