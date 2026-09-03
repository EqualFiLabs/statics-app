import { describe, expect, it } from "vitest";

import { parseCoinGeckoHistoricalTradeQuery } from "@/lib/market/coingecko-query";

const ticker = "0xbase_0xtarget";

describe("CoinGecko historical trade query", () => {
  it("applies the bounded default and accepts filters", () => {
    expect(
      parseCoinGeckoHistoricalTradeQuery(
        `https://staticsprotocol.com/api?` +
          new URLSearchParams({
            ticker_id: ticker.toUpperCase(),
            type: "sell",
            limit: "500",
            start_time: "10",
            end_time: "20",
          }),
        ticker
      )
    ).toEqual({ ok: true, query: { limit: 500, from: "10", to: "20", side: "sell" } });
    expect(
      parseCoinGeckoHistoricalTradeQuery(
        `https://staticsprotocol.com/api?ticker_id=${ticker}`,
        ticker
      )
    ).toEqual({ ok: true, query: { limit: 200 } });
  });

  it.each([
    "",
    `ticker_id=wrong`,
    `ticker_id=${ticker}&limit=0`,
    `ticker_id=${ticker}&limit=501`,
    `ticker_id=${ticker}&limit=1.5`,
    `ticker_id=${ticker}&type=both`,
    `ticker_id=${ticker}&start_time=nope`,
    `ticker_id=${ticker}&start_time=20&end_time=10`,
  ])("rejects invalid query %s", (query) => {
    expect(
      parseCoinGeckoHistoricalTradeQuery(`https://staticsprotocol.com/api?${query}`, ticker).ok
    ).toBe(false);
  });
});
