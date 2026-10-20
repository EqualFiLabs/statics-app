import { describe, expect, it } from "vitest";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  parseDexDepth,
  quoteValue,
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
  it("validates weekly incentive amounts, window, unique tokens and pause state", () => {
    const sample = dexFixture(deployment, "usdg").emissions;
    const from = BigInt(sample.indexedAtTimestamp);
    const row = {
      poolId: deployment.supportedPools[0]!.poolId,
      token0: token(2, "WETH"),
      token1: token(5, "STATICS"),
      lp: [{ token: token(5, "STATICS"), amount: "700", quoteValue: null }],
      allocator: [{ token: token(5, "STATICS"), amount: "300", quoteValue: "30" }],
      lpPaused: false,
      allocatorPaused: false,
    };
    const weekly = { from: String(from), until: String(from + 604800n), pools: [row] };
    const parse = (weeklyIncentives: unknown) =>
      parseDexEmissions({ ...sample, weeklyIncentives }, "dex-fixture");
    expect(parse(weekly).weeklyIncentives!.pools[0]!.lp[0]!.amount).toBe(700n);
    expect(parse(null).weeklyIncentives).toBeNull();
    expect(parseDexEmissions(sample, "dex-fixture").weeklyIncentives).toBeNull();
    expect(() => parse({ ...weekly, until: String(from + 604801n) })).toThrow(/incentive window/);
    expect(() => parse({ ...weekly, pools: [row, row] })).toThrow(/duplicate incentive pools/);
    expect(() => parse({ ...weekly, pools: [{ ...row, lp: [...row.lp, ...row.lp] }] })).toThrow(
      /duplicate incentive assets/
    );
    expect(() => parse({ ...weekly, pools: [{ ...row, lpPaused: true }] })).toThrow(
      /paused incentives/
    );
    expect(() =>
      parse({ ...weekly, pools: [{ ...row, lp: [{ ...row.lp[0], amount: "-1" }] }] })
    ).toThrow(/incentive amount/);
  });
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

describe("yield windows", () => {
  it("accepts yields over at least a day of history and rejects shorter or inconsistent windows", () => {
    const sample = dexFixture(deployment, "usdg");
    const withWindow = (windowSeconds: string, complete: boolean, yieldBps: number | null) => {
      const pools = structuredClone(sample.pools);
      const pool = pools.items.find((item) => item.priced)!;
      pool.yieldComponents = { ...pool.yieldComponents, windowSeconds, complete };
      (pool as { estimatedYieldBps: number | null }).estimatedYieldBps = yieldBps;
      return () => parseDexPools(pools, "dex-fixture");
    };
    expect(withWindow("259200", false, 1200)).not.toThrow();
    expect(withWindow("86399", false, 1200)).toThrow();
    expect(withWindow("86399", false, null)).not.toThrow();
    expect(withWindow("259200", true, 1200)).toThrow();
    expect(withWindow("700000", false, null)).toThrow();
    // An older indexer without the field: yields only with a complete week, as before.
    const legacy = structuredClone(sample.pools);
    for (const pool of legacy.items)
      delete (pool.yieldComponents as { windowSeconds?: string }).windowSeconds;
    expect(() => parseDexPools(legacy, "dex-fixture")).not.toThrow();
  });
});

describe("pool depth", () => {
  const pool = `0x${"ab".repeat(32)}` as const;
  const body = (overrides: Record<string, unknown> = {}) => ({
    deploymentId: "fixture",
    indexedAtBlock: "10",
    indexedAtTimestamp: "100",
    liquidityComplete: true,
    poolId: pool,
    tickSpacing: 60,
    tick: 5,
    sqrtPriceX96: String(1n << 96n),
    liquidity: "150",
    ticks: [
      { tick: -120, liquidityNet: "150" },
      { tick: 120, liquidityNet: "-150" },
    ],
    ...overrides,
  });

  it("parses signed tick liquidity in ascending order", () => {
    expect(parseDexDepth(body(), "fixture", pool)).toMatchObject({
      poolId: pool,
      tick: 5,
      liquidity: 150n,
      ticks: [
        { tick: -120, liquidityNet: 150n },
        { tick: 120, liquidityNet: -150n },
      ],
    });
  });

  it("rejects another pool or deployment, unordered ticks and malformed liquidity", () => {
    expect(() => parseDexDepth(body(), "other", pool)).toThrow("deployment");
    expect(() => parseDexDepth(body(), "fixture", `0x${"cd".repeat(32)}`)).toThrow("depth pool");
    expect(() =>
      parseDexDepth(
        body({
          ticks: [
            { tick: 60, liquidityNet: "1" },
            { tick: 60, liquidityNet: "-1" },
          ],
        }),
        "fixture",
        pool
      )
    ).toThrow("order");
    expect(() =>
      parseDexDepth(body({ ticks: [{ tick: 60, liquidityNet: "-0" }] }), "fixture", pool)
    ).toThrow("net liquidity");
    expect(() => parseDexDepth(body({ tick: 900_000 }), "fixture", pool)).toThrow("pool tick");
    for (const invalid of [
      { liquidity: "149" },
      { sqrtPriceX96: "0" },
      { liquidityComplete: "true" },
      {
        ticks: [
          { tick: -119, liquidityNet: "150" },
          { tick: 120, liquidityNet: "-150" },
        ],
      },
      { ticks: [{ tick: 120, liquidityNet: "-150" }] },
    ])
      expect(() => parseDexDepth(body(invalid), "fixture", pool)).toThrow();
  });
});

describe("quote values", () => {
  it("scales an exact per-token price by the token's and the quote's decimals", () => {
    // 2,486.45112 USDG (6 decimals) per WETH (18 decimals).
    const weth = { priceNumerator: 2486451120n, priceDenominator: 1n };
    expect(quoteValue(weth, 5n * 10n ** 17n, 18, 6)).toBeCloseTo(1243.22556);
    // A sub-unit price keeps its precision through the ratio.
    expect(
      quoteValue({ priceNumerator: 1n, priceDenominator: 3n }, 3n * 10n ** 8n, 8, 6)
    ).toBeCloseTo(1e-6);
    expect(quoteValue({ priceNumerator: null, priceDenominator: null }, 1n, 18, 6)).toBeNull();
  });
});

it("retains headline price provenance and accepts older indexers without it", () => {
  const sample = dexFixture(deployment, "usdg");
  expect(
    parseDexSummary(
      { ...sample.summary, statics: { ...sample.summary.statics, priceFallback: true } },
      "dex-fixture"
    ).statics.priceFallback
  ).toBe(true);
  const legacy = structuredClone(sample.summary);
  delete (legacy.statics as { priceFallback?: boolean }).priceFallback;
  expect(parseDexSummary(legacy, "dex-fixture").statics.priceFallback).toBeNull();
  expect(() =>
    parseDexSummary(
      { ...sample.summary, statics: { ...sample.summary.statics, priceFallback: "false" } },
      "dex-fixture"
    )
  ).toThrow(/price fallback/);
});

describe("LP reward projections", () => {
  it("retains the projection separately from trailing yield and tolerates older indexers", () => {
    const sample = dexFixture(deployment, "usdg");
    const current = parseDexPools(sample.pools, "dex-fixture").items[0]!;
    expect(current.projectedLpAprBps).toBeGreaterThan(0);
    expect(current.projectedLpAprBps).not.toBe(current.estimatedYieldBps);
    expect(current.lpRewardProjection?.annualRewardValue).toBe(100_000n * 10n ** 6n);
    const legacy = structuredClone(sample.pools);
    for (const p of legacy.items) {
      delete (p as { projectedLpAprBps?: number }).projectedLpAprBps;
      delete (p as { lpRewardProjection?: unknown }).lpRewardProjection;
    }
    expect(parseDexPools(legacy, "dex-fixture").items[0]).toMatchObject({
      projectedLpAprBps: null,
      lpRewardProjection: null,
    });
  });
  it("rejects APRs with missing or inconsistent denominators and malformed projection data", () => {
    const sample = dexFixture(deployment, "usdg");
    for (const update of [
      { eligibleValueLocked: "0" },
      { annualRewardValue: null },
      { status: "unknown" },
      { basis: "total-pool-tvl" },
      { assets: ["not-an-address"] },
    ]) {
      const pools = structuredClone(sample.pools);
      Object.assign(pools.items[0]!.lpRewardProjection, update);
      expect(() => parseDexPools(pools, "dex-fixture")).toThrow();
    }
    const pools = structuredClone(sample.pools);
    pools.items[0]!.projectedLpAprBps = 999;
    expect(() => parseDexPools(pools, "dex-fixture")).toThrow("projected LP APR");
  });
});
