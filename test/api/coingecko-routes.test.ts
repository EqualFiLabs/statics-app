import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSupply: vi.fn(),
}));

vi.mock("@/lib/server/coingecko-market", () => ({
  loadCoinGeckoSupply: mocks.loadSupply,
}));

import { GET as getSupply } from "@/app/api/coingecko/v1/supply/route";
import {
  GET as getCirculating,
  OPTIONS as optionsCirculating,
} from "@/app/api/coingecko/v1/supply/circulating/route";
import { GET as getTotal } from "@/app/api/coingecko/v1/supply/total/route";

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

    const preflight = optionsCirculating();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });

  it("returns a cache-disabled 503 when authoritative dependencies are unavailable", async () => {
    mocks.loadSupply.mockRejectedValueOnce(new Error("RPC unavailable"));
    const response = await getCirculating();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Market data are temporarily unavailable." });
  });
});
