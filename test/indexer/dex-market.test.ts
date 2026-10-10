import { describe, expect, it } from "vitest";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  parseDexEmissions,
  parseDexPools,
  parseDexSummary,
  parseDexTokens,
  parseDexTrades,
  parseDexVolume,
  DexMarketRestartError,
} from "@/lib/indexer/dex-market";
import { dexFixture } from "@/lib/indexer/dex-market-fixture";

const token = (n: number, symbol: string) => ({
  address: `0x${String(n).repeat(40)}`,
  symbol,
  name: symbol,
  decimals: 18,
});
const deployment = {
  descriptor: { deploymentId: "dex-fixture" },
  contracts: { weth: token(2, "WETH").address },
  supportedPools: [1, 3, 4, 5].map((n) => ({
    poolId: `0x${String(n).repeat(64)}`,
    token0: token(2, "WETH"),
    token1: token(n + 4, `T${n}`),
    enabled: true,
  })),
} as unknown as PhaseOneDeployment;

describe("DEX market responses", () => {
  it("parses every endpoint's sample response in both quote currencies", () => {
    for (const quote of ["usdg", "weth"] as const) {
      const sample = dexFixture(deployment, quote);
      const summary = parseDexSummary(sample.summary, "dex-fixture");
      expect(summary.quote.kind).toBe(quote);
      expect(summary.quote.decimals).toBe(quote === "usdg" ? 6 : 18);
      expect(summary.unpricedPools).toBe(1);
      const pools = parseDexPools(sample.pools, "dex-fixture");
      const unpriced = pools.items.filter((pool) => !pool.priced);
      expect(unpriced).toHaveLength(1);
      expect(unpriced[0]!.valueLocked).toBeNull();
      expect(unpriced[0]!.pairPrice).not.toBeNull();
      expect(parseDexTokens(sample.tokens, "dex-fixture").items.length).toBeGreaterThan(0);
      expect(parseDexVolume(sample.volume, "dex-fixture").days).toHaveLength(30);
      expect(parseDexEmissions(sample.emissions, "dex-fixture").period).not.toBeNull();
      expect(parseDexTrades(sample.trades, "dex-fixture").items.some((t) => !t.priced)).toBe(true);
    }
  });
  it("rejects another deployment, an unpriced pool with a value, and unknown quotes", () => {
    const sample = dexFixture(deployment, "usdg");
    expect(() => parseDexSummary(sample.summary, "other")).toThrow();
    const pools = structuredClone(sample.pools);
    const unpriced = pools.items.find((pool) => !pool.priced)!;
    (unpriced as { valueLocked: string | null }).valueLocked = "1";
    expect(() => parseDexPools(pools, "dex-fixture")).toThrow();
    expect(() =>
      parseDexSummary(
        { ...sample.summary, quote: { ...sample.summary.quote, kind: "eur" } },
        "dex-fixture"
      )
    ).toThrow();
  });
  it("rejects malformed booleans, duplicate records, unnormalized shares and impossible dates", () => {
    const sample = dexFixture(deployment, "usdg");
    const trades = structuredClone(sample.trades);
    (trades.items[0] as unknown as { priced: unknown }).priced = "true";
    expect(() => parseDexTrades(trades, "dex-fixture")).toThrow();
    expect(() =>
      parseDexPools(
        { ...sample.pools, items: [sample.pools.items[0], sample.pools.items[0]] },
        "dex-fixture"
      )
    ).toThrow();
    expect(() =>
      parseDexEmissions({ ...sample.emissions, othersBps: 10000 }, "dex-fixture")
    ).toThrow();
    const volume = structuredClone(sample.volume);
    volume.days[0]!.day = "2026-02-30";
    expect(() => parseDexVolume(volume, "dex-fixture")).toThrow();
    const partial = structuredClone(sample.volume);
    partial.days[0]!.coverage.historyComplete = false;
    expect(parseDexVolume(partial, "dex-fixture").days[0]!.coverage.historyComplete).toBe(false);
    expect(() =>
      parseDexVolume(
        {
          ...partial,
          days: [
            {
              ...partial.days[0],
              coverage: { includedPools: 0, omittedPools: 0, historyComplete: "false" },
            },
          ],
        },
        "dex-fixture"
      )
    ).toThrow();
    expect(new DexMarketRestartError().name).toBe("DexMarketRestartError");
  });
  it("supports empty deployments, literal filters, sorting, pages and exact requested fixture ranges", () => {
    const empty = dexFixture({ ...deployment, supportedPools: [] }, "weth");
    expect(parseDexTrades(empty.trades, "dex-fixture").items).toHaveLength(0);
    expect(parseDexPools(empty.pools, "dex-fixture").total).toBe(0);
    expect(parseDexEmissions(empty.emissions, "dex-fixture").othersBps).toBe(10000);
    const first = dexFixture(deployment, "weth", { limit: 1, days: 7 });
    const second = dexFixture(deployment, "weth", { limit: 1, cursor: first.pools.nextCursor! });
    expect(first.pools.items[0]!.poolId).not.toBe(second.pools.items[0]!.poolId);
    expect(first.volume.days).toHaveLength(7);
    expect(dexFixture(deployment, "usdg", { search: "missing" }).pools.total).toBe(0);
  });
});
