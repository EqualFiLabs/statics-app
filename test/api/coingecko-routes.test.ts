import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSupply: vi.fn(),
  loadTickers: vi.fn(),
  loadTrades: vi.fn(),
  loadStatus: vi.fn(),
}));

vi.mock("@/lib/server/coingecko-market", () => ({
  loadCoinGeckoSupply: mocks.loadSupply,
  loadCoinGeckoTickers: mocks.loadTickers,
  loadCoinGeckoHistoricalTrades: mocks.loadTrades,
  loadCoinGeckoStatus: mocks.loadStatus,
  coinGeckoSpotMarket: () => ({ tickerId: "0xbase_0xtarget" }),
}));

import { GET as getHistory } from "@/app/api/coingecko/v1/historical_trades/route";
import { GET as getStatus } from "@/app/api/coingecko/v1/status/route";
import { GET as getSupply } from "@/app/api/coingecko/v1/supply/route";
import { GET as getCirculating } from "@/app/api/coingecko/v1/supply/circulating/route";
import { GET as getTotal } from "@/app/api/coingecko/v1/supply/total/route";
import { GET as getTickers, OPTIONS as optionsTickers } from "@/app/api/coingecko/v1/tickers/route";

const WAD = 10n ** 18n;
const supply = {
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  tokenAddress: "0x2d8d6F4A93AcD7a916A5a654ec8b690bA3B3EAdd",
  decimals: 18,
  asOfBlock: "123",
  snapshotAt: "2026-09-01T12:00:00.000Z",
  total: (1_000_000_000n * WAD).toString(),
  poolInventory: (99_900_000n * WAD).toString(),
  publicDistributed: (700_100_000n * WAD).toString(),
  unreleasedTreasury: (100_100_000n * WAD).toString(),
  vaultBacking: (117_900_000n * WAD).toString(),
  strictLiquidFloat: (682_100_000n * WAD).toString(),
};

beforeEach(() => {
  mocks.loadSupply.mockReset().mockResolvedValue(supply);
  mocks.loadTickers.mockReset().mockResolvedValue([{ ticker_id: "0xbase_0xtarget" }]);
  mocks.loadTrades.mockReset().mockResolvedValue({ buy: [], sell: [] });
  mocks.loadStatus.mockReset().mockResolvedValue({ ok: true });
});

describe("public CoinGecko routes", () => {
  it("serves exact anonymous supply results in decimal token units", async () => {
    expect(await (await getTotal()).json()).toEqual({ result: "1000000000" });
    expect(await (await getCirculating()).json()).toEqual({ result: "782000000" });
    expect(await (await getSupply()).json()).toMatchObject({
      decimals: 18,
      total_supply: "1000000000",
      circulating_supply: "782000000",
    });
  });

  it("applies public caching and permissive read-only CORS without authentication", async () => {
    const circulating = await getCirculating();
    expect(circulating.status).toBe(200);
    expect(circulating.headers.get("access-control-allow-origin")).toBe("*");
    expect(circulating.headers.get("cache-control")).toContain("s-maxage=300");

    const ticker = await getTickers();
    expect(ticker.headers.get("cache-control")).toContain("s-maxage=60");
    expect(await ticker.json()).toEqual([{ ticker_id: "0xbase_0xtarget" }]);

    const status = await getStatus();
    expect(status.headers.get("cache-control")).toContain("s-maxage=30");

    const preflight = optionsTickers();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });

  it("validates and forwards historical trade filters", async () => {
    const response = await getHistory(
      new Request(
        "https://staticsprotocol.com/api/coingecko/v1/historical_trades?" +
          "ticker_id=0xbase_0xtarget&type=buy&limit=500&start_time=10&end_time=20"
      )
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=15");
    expect(mocks.loadTrades).toHaveBeenCalledWith({
      limit: 500,
      from: "10",
      to: "20",
      side: "buy",
    });

    const invalid = await getHistory(
      new Request("https://staticsprotocol.com/api/coingecko/v1/historical_trades?ticker_id=wrong")
    );
    expect(invalid.status).toBe(400);
    expect(mocks.loadTrades).toHaveBeenCalledTimes(1);
  });

  it("returns a cache-disabled 503 when authoritative dependencies are unavailable", async () => {
    mocks.loadSupply.mockRejectedValueOnce(new Error("RPC unavailable"));
    const response = await getCirculating();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Market data are temporarily unavailable." });

    mocks.loadTickers.mockRejectedValueOnce(new Error("Indexer unavailable"));
    expect((await getTickers()).status).toBe(503);
  });
});
