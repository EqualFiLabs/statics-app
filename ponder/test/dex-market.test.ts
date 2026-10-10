import { describe, expect, it } from "vitest";
import { buildMarket, pricingConfig } from "../src/dex-market";
import type { DexSnapshot, Metric } from "../src/dex-snapshot";
import { pool, range, points } from "./dex-fixtures";
const checkpoint = (time: number) =>
  String(time).padStart(10, "0") +
  "4663".padStart(16, "0") +
  "100".padStart(16, "0") +
  "0".repeat(33);
const config = {
  kind: "weth" as const,
  address: pool().token1.address,
  decimals: 18,
  symbol: "WETH",
  floor: 1n,
  wrappedNative: null,
};
export function snapshot(): DexSnapshot {
  const p = pool();
  return {
    checkpoint: checkpoint(1000000),
    generation: "a",
    revision: "1",
    anchor: null,
    pools: [p],
    ranges: [{ ...range(p), rangeKey: "range" }],
    prices: points(p),
    metrics: [],
    daily: [],
    history: [],
    trades: [],
    tokens: [p.token0, p.token1],
    reserve: null,
    allocations: [],
    wallets: { current: "0", previous: "0" },
  };
}
const metric = (overrides: Partial<Metric> = {}): Metric => ({
  poolId: pool().poolId,
  bucket: "current",
  volume0: "1000000000000000000",
  volume1: "0",
  lp0: "3000000000000000",
  lp1: "0",
  fee0: "1000000000000000",
  fee1: "0",
  swaps: "1",
  wallets: "1",
  ...overrides,
});
describe("market accounting and history coverage", () => {
  it("keeps core one-sided volume, estimated LP fees and additional hook revenue separate", () => {
    const s = snapshot();
    s.metrics = [metric()];
    const b = buildMarket(s, "selected", config, null);
    expect(b.summary.current).toMatchObject({
      volume: 10n ** 18n,
      lpFees: 3n * 10n ** 15n,
      protocolFees: 10n ** 15n,
      swaps: 1n,
    });
  });
  it("models earned LP bribes, excludes recycling and requires all prices for yield", () => {
    const s = snapshot(),
      p = s.pools[0]!;
    s.metrics = [metric({ bucket: "week" })];
    s.history = [
      {
        key: "a",
        poolId: p.poolId,
        kind: "accrual",
        timestamp: "999999",
        blockNumber: "10",
        blockHash: "0x00",
        logIndex: 1,
        details: [
          {
            asset: p.token1.address,
            slot: 1,
            start: "900000",
            finish: "1000000",
            from: "900000",
            to: "1000000",
            budget: "1000000000000000000",
          },
        ],
      },
      {
        key: "b",
        poolId: p.poolId,
        kind: "credit",
        timestamp: "999999",
        blockNumber: "10",
        blockHash: "0x00",
        logIndex: 2,
        details: { amount: "1000000000000000000" },
      },
      {
        key: "c",
        poolId: p.poolId,
        kind: "recycle",
        timestamp: "999999",
        blockNumber: "10",
        blockHash: "0x00",
        logIndex: 3,
        details: { amount: "5000000000000000000" },
      },
    ];
    let b = buildMarket(s, "selected", config, p.token0.address);
    expect(b.pools[0]!.yieldComponents).toMatchObject({
      gaugeCredits: 10n ** 18n,
      lpBribeAccrual: 10n ** 18n,
      gaugeRecycledAmount: 5n * 10n ** 18n,
    });
    expect(b.pools[0]!.estimatedYieldBps).toBeGreaterThan(0);
    b = buildMarket(s, "selected", config, "0x0000000000000000000000000000000000000099");
    expect(b.pools[0]!.estimatedYieldBps).toBeNull();
  });
  it("never invents TVL or seven-day history when liquidity or swap history is incomplete", () => {
    const s = snapshot();
    s.pools[0]!.liquidityComplete = false;
    s.pools[0]!.historyStart = "999999";
    const b = buildMarket(s, "selected", config, null);
    expect(b.pools[0]!.valueLocked).toBeNull();
    expect(b.pools[0]!.estimatedYieldBps).toBeNull();
    expect(b.summary.current.coverage.volume.historyComplete).toBe(false);
  });
  it("retains observed expired budgets and denominator remainder rather than predicting next period", () => {
    const s = snapshot();
    s.reserve = {
      activated: true,
      periodBudget: "100",
      periodStart: "1",
      periodFinish: "2",
      periodAccounted: "90",
      totalAllocatedWeight: "100",
      updatedAtBlock: "10",
      updatedAtTimestamp: "20",
    };
    s.allocations = [
      { poolId: pool().poolId, weight: "20", eligible: true, incentiveStreamCount: 1 },
    ];
    const b = buildMarket(s, "selected", config, null);
    expect(b.emissions.period).toMatchObject({ expired: true, budget: 100n, accounted: 90n });
    expect(b.emissions.othersBps).toBe(8000);
  });
  it("uses independently configured floors and only falls back when USDG is absent", () => {
    expect(pricingConfig("usdg", { PONDER_PRICING_QUOTE_WETH: pool().token1.address }).floor).toBe(
      10n ** 18n
    );
    expect(pricingConfig("usdg", { PONDER_PRICING_QUOTE_USDG: pool().token0.address }).floor).toBe(
      2500n * 10n ** 6n
    );
    expect(() => pricingConfig("weth", {})).toThrow();
  });
});
