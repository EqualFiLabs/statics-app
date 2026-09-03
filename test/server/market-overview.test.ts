import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBlockNumber: vi.fn(),
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  loadEthUsd: vi.fn(),
}));

vi.mock("viem", async (importOriginal) => {
  const original = await importOriginal<typeof import("viem")>();
  return {
    ...original,
    createPublicClient: () => ({
      getBlockNumber: mocks.getBlockNumber,
      readContract: mocks.readContract,
      simulateContract: mocks.simulateContract,
    }),
    http: vi.fn(),
  };
});

vi.mock("@/lib/server/eth-usd", () => ({ loadEthUsd: mocks.loadEthUsd }));
vi.mock("@/lib/server/launch-verification", () => ({
  verifyLaunchDeploymentOnServer: () => ({ status: "hit", verification: Promise.resolve() }),
}));
vi.mock("@/lib/server/robinhood-rpc", () => ({
  robinhoodRpcUrl: () => "https://rpc.example",
}));
vi.mock("@/lib/server/statics-indexer-url", () => ({
  staticsMainnetIndexerUrl: (path: string) => new URL(`https://indexer.example/${path}`),
}));

import {
  loadMarketOverview,
  loadMarketSpotOverview,
  loadMarketSupplySnapshot,
  resetMarketOverviewCacheForTest,
} from "@/lib/server/market-overview";

const WAD = 10n ** 18n;
const NOW = Date.parse("2026-09-01T12:00:00.000Z");

beforeEach(() => {
  resetMarketOverviewCacheForTest();
  mocks.getBlockNumber.mockReset().mockResolvedValue(123n);
  mocks.readContract.mockReset().mockImplementation(({ functionName }) => {
    if (functionName === "getPoolTVL") {
      return Promise.resolve({
        coreAmount0: 400n * WAD,
        coreAmount1: 99_900_000n * WAD,
        sqrtPriceX96: 1n << 96n,
      });
    }
    if (functionName === "vaultAccounting") {
      return Promise.resolve({ tokenBacking: 117_900_000n * WAD });
    }
    if (functionName === "totalSupply") return Promise.resolve(1_000_000_000n * WAD);
    if (functionName === "vestingOf") return Promise.resolve([100_100_000n * WAD, 0n]);
    throw new Error(`Unexpected read: ${String(functionName)}`);
  });
  mocks.simulateContract.mockReset().mockRejectedValue(new Error("Quoter unavailable"));
  mocks.loadEthUsd.mockReset().mockResolvedValue(null);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        deploymentId: "robinhood-genesis",
        from: "1",
        to: "2",
        volume0: (10_000_000n * WAD).toString(),
        volume1: (40n * WAD).toString(),
        swapCount: 12,
        zeroForOneCount: 5,
        oneForZeroCount: 7,
        openPrice1Per0Wad: (250_000n * WAD).toString(),
        highPrice1Per0Wad: (333_333n * WAD).toString(),
        lowPrice1Per0Wad: (200_000n * WAD).toString(),
        closePrice1Per0Wad: (222_222n * WAD).toString(),
        lastBlock: "122",
        lastTimestamp: "1788263990",
        lastLogIndex: 3,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    )
  );
});

describe("shared market fundamentals", () => {
  it("serves supply without indexer, USD, or Quoter calls and reuses reads for the overview", async () => {
    const supply = await loadMarketSupplySnapshot(NOW);
    expect(supply).toMatchObject({
      status: "fresh",
      asOfBlock: "123",
      strictLiquidFloat: (682_100_000n * WAD).toString(),
    });
    expect(mocks.readContract).toHaveBeenCalledTimes(4);
    expect(mocks.loadEthUsd).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.simulateContract).not.toHaveBeenCalled();

    await loadMarketOverview(NOW);
    expect(mocks.readContract).toHaveBeenCalledTimes(4);
    expect(mocks.loadEthUsd).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("uses a last-good supply snapshot only within the bounded stale window", async () => {
    await loadMarketSupplySnapshot(NOW);
    mocks.readContract.mockRejectedValue(new Error("RPC unavailable"));
    expect(await loadMarketSupplySnapshot(NOW + 61_000)).toMatchObject({ status: "stale" });
    await expect(loadMarketSupplySnapshot(NOW + 30 * 60_000 + 1)).rejects.toThrow(
      "RPC unavailable"
    );
  });

  it("loads exact indexed activity without running executable depth quotes", async () => {
    const overview = await loadMarketSpotOverview(NOW);
    expect(overview.activity24h).toMatchObject({
      available: true,
      swaps: 12,
      buys: 5,
      sells: 7,
      highWethPerStaticsWad: ((WAD * WAD) / (200_000n * WAD)).toString(),
      lowWethPerStaticsWad: ((WAD * WAD) / (333_333n * WAD)).toString(),
      lastWethPerStaticsWad: ((WAD * WAD) / (222_222n * WAD)).toString(),
      lastTradeAt: "2026-09-01T11:59:50.000Z",
    });
    expect(mocks.simulateContract).not.toHaveBeenCalled();
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("/market/activity?");
  });
});
