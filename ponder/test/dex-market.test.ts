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
  it("annualises yield over the history available, from one day to seven", () => {
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
    s.pools[0]!.historyStart = "0";
    const week = buildMarket(s, "selected", config, p.token0.address).pools[0]!;
    // Three days of history: the same earnings annualised over a shorter window.
    s.pools[0]!.historyStart = String(1_000_000 - 3 * 86_400);
    const partial = buildMarket(s, "selected", config, p.token0.address).pools[0]!;
    expect(week.yieldComponents).toMatchObject({ complete: true, windowSeconds: 604_800n });
    expect(partial.yieldComponents).toMatchObject({ complete: false, windowSeconds: 259_200n });
    expect(partial.estimatedYieldBps! / week.estimatedYieldBps!).toBeCloseTo(7 / 3, 2);
    // Under a day of history is too little to annualise.
    s.pools[0]!.historyStart = String(1_000_000 - 23 * 3600);
    expect(
      buildMarket(s, "selected", config, p.token0.address).pools[0]!.estimatedYieldBps
    ).toBeNull();
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

describe("projected LP reward APR", () => {
  const unit = 10n ** 18n;
  function funded() {
    const s = snapshot(),
      p = s.pools[0]!;
    p.legs = [{ ...range(p), positionId: "1" }];
    p.historyStart = "999999"; // A campaign can be projected before one day of history exists.
    p.streams = [
      {
        slot: 1,
        asset: p.token1.address,
        start: "1000000",
        finish: "1604800",
        last: "1000000",
        budget: String(unit),
        emitted: "0",
      },
    ];
    return s;
  }
  const build = (s: DexSnapshot) =>
    buildMarket(s, "selected", config, s.pools[0]!.token0.address).pools[0]!;
  it("annualizes the current LP-only schedule without trading fees or a history wait", () => {
    const s = funded();
    s.metrics = [metric({ bucket: "week", lp0: String(unit * 100n) })];
    const p = build(s);
    expect(p.estimatedYieldBps).toBeNull();
    expect(p.lpRewardProjection).toMatchObject({
      annualRewardValue: 52n * unit,
      creatorAnnualRewards: 52n * unit,
      gaugeAnnualRewards: 0n,
      eligibleValueLocked: p.valueLocked,
      status: "active",
    });
    expect(p.projectedLpAprBps).toBe(Number((52n * unit * 10000n) / p.valueLocked!));
  });
  it("excludes unmanaged TVL, but includes all managed principal including out-of-range legs", () => {
    const s = funded(),
      first = build(s),
      p = s.pools[0]!;
    s.ranges.push({ ...range(p), rangeKey: "unmanaged" });
    const unmanaged = build(s);
    expect(unmanaged.valueLocked).toBe(first.valueLocked! * 2n);
    expect(unmanaged.projectedLpAprBps).toBe(first.projectedLpAprBps);
    p.legs.push({ ...range(p), positionId: "2", tickLower: 100, tickUpper: 200 });
    const moreManaged = build(s);
    expect(moreManaged.lpRewardProjection.eligibleValueLocked).toBeGreaterThan(first.valueLocked!);
    expect(moreManaged.projectedLpAprBps!).toBeLessThan(first.projectedLpAprBps!);
  });
  it("uses a top-up's rolled budget over its remaining duration immediately", async () => {
    const { advanceStreams, fundLp } = await import("../src/dex-domain");
    const s = funded(),
      p = s.pools[0]!;
    const before = build(s);
    s.checkpoint = checkpoint(1302400); // Halfway through a seven-day campaign.
    advanceStreams(p, 1302400n);
    fundLp(p, 1, p.token1.address, unit, 1302400n, 1604800n);
    expect(build(s).lpRewardProjection.annualRewardValue).toBe(
      3n * before.lpRewardProjection.annualRewardValue!
    );
  });
  it("returns zero for expired/stopped schedules and paused earning, null for missing valuation", () => {
    const s = funded(),
      p = s.pools[0]!;
    p.stopped = true;
    expect(build(s)).toMatchObject({
      projectedLpAprBps: 0,
      lpRewardProjection: { status: "inactive" },
    });
    p.stopped = false;
    s.checkpoint = checkpoint(1604800);
    expect(build(s).projectedLpAprBps).toBe(0);
    s.checkpoint = checkpoint(1000000);
    p.legs[0]!.tickLower = 100;
    p.legs[0]!.tickUpper = 200;
    expect(build(s)).toMatchObject({
      projectedLpAprBps: 0,
      lpRewardProjection: { status: "paused" },
    });
    p.legs = [];
    expect(build(s).projectedLpAprBps).toBeNull();
    p.legs = [{ ...range(p), positionId: "1" }];
    p.streams.push({ ...p.streams[0]!, slot: 2, asset: `0x${"99".repeat(20)}` });
    expect(build(s).projectedLpAprBps).toBeNull();
    p.streams.pop();
    p.liquidityComplete = false;
    expect(build(s).projectedLpAprBps).toBeNull();
  });
  it("adds only the current eligible reserve share without inventing future periods", () => {
    const s = funded(),
      p = s.pools[0]!;
    s.reserve = {
      activated: true,
      periodStart: "1000000",
      periodFinish: "1604800",
      periodBudget: String(10n * unit),
      periodAccounted: "0",
      totalAllocatedWeight: "100",
      updatedAtBlock: "100",
      updatedAtTimestamp: "1000000",
    };
    s.allocations = [{ poolId: p.poolId, weight: "20", eligible: true, incentiveStreamCount: 1 }];
    expect(build(s).lpRewardProjection.gaugeAnnualRewards).toBe(104n * unit);
    s.allocations[0]!.eligible = false;
    expect(build(s).lpRewardProjection.gaugeAnnualRewards).toBe(0n);
    s.allocations[0]!.eligible = true;
    p.quarantined = true;
    expect(build(s).lpRewardProjection).toMatchObject({
      gaugeAnnualRewards: 0n,
      creatorAnnualRewards: 52n * unit,
    });
    p.quarantined = false;
    s.reserve.activated = false;
    expect(build(s).lpRewardProjection.gaugeAnnualRewards).toBe(0n);
    s.reserve.activated = true;
    s.checkpoint = checkpoint(1604800);
    expect(build(s).lpRewardProjection.gaugeAnnualRewards).toBe(0n);
  });
});

it("values mixed-decimal LP reward assets at current prices without including the allocator share", async () => {
  const { projectLpRewards } = await import("../src/dex-lp-projection");
  const p = pool();
  p.legs = [{ ...range(p), positionId: "1" }];
  const schedule = { start: "1000000", finish: "1604800", last: "1000000", emitted: "0" };
  // Onchain LP amounts after the 90/10 split of 750k STATICS + 2,500 USDG.
  p.streams = [
    { ...schedule, slot: 1, asset: p.token0.address, budget: String(675000n * 10n ** 18n) },
    { ...schedule, slot: 2, asset: p.token1.address, budget: String(2250n * 10n ** 6n) },
  ];
  const quote = (asset: string) =>
    asset === p.token0.address ? { n: 10120n, d: 10n ** 18n } : { n: 1n, d: 1n };
  const result = projectLpRewards(p, 1000000n, 500000n * 10n ** 6n, quote, null, undefined, null);
  expect(result.lpRewardProjection.annualRewardValue).toBe(472212n * 10n ** 6n);
  expect(result.projectedLpAprBps).toBe(9444);
  // A sub-quote-unit per-second rate must survive annualization.
  p.streams = [{ ...schedule, slot: 1, asset: p.token1.address, budget: "1" }];
  expect(projectLpRewards(p, 1000000n, 100n, quote, null, undefined, null).projectedLpAprBps).toBe(
    5200
  );
});

describe("USD reference valuation", () => {
  const usdConfig = pricingConfig("usd", {});
  const referenceSnapshot = (s: DexSnapshot, values = [700n, 200n]) => ({
    asOf: 1_000_000_000,
    allowDerived: true,
    restricted: s.pools.flatMap((p) => [p.token0.address, p.token1.address]),
    prices: [s.pools[0]!.token0, s.pools[0]!.token1].map((t, i) => ({
      address: t.address,
      decimals: t.decimals!,
      valueWad: values[i]! * 10n ** 18n,
      reference: {
        source: "robinhood" as const,
        asset: t.address,
        observedAt: 1_000_000_000,
        fetchedAt: 1_000_000_000,
        expiresAt: 1_000_900_000,
        stale: false,
        halted: false,
      },
    })),
  });
  it("values disconnected SPY/NVDA using independent references and preserves pair history", () => {
    const s = snapshot();
    s.metrics = [metric()];
    const refs = referenceSnapshot(s);
    const b = buildMarket(s, "mainnet", usdConfig, null, refs);
    expect(b.observed.quote).toEqual({ kind: "usd", address: null, symbol: "USD", decimals: 18 });
    expect(b.tokens.items.map((t) => t.price)).toEqual([700n * 10n ** 18n, 200n * 10n ** 18n]);
    expect(b.pools[0]!.valueLocked).toBeGreaterThan(0n);
    expect(b.pools[0]!.pairPrice).toBe("1");
    expect(b.pools[0]!.references).toHaveLength(2);
    expect(b.summary.current.volume).toBe(700n * 10n ** 18n);
    expect(b.tokens.items.every((t) => t.change24hBps === null)).toBe(true);
    expect(b.volume.days.slice(0, -1).every((d) => d.volume === null)).toBe(true);
  });
  it("propagates depegged USDG, but preserves the liquidity floor for unrelated assets", () => {
    const s = snapshot();
    const refs = referenceSnapshot(s);
    refs.prices = [{ ...refs.prices[1]!, valueWad: 8n * 10n ** 17n }];
    refs.restricted = [];
    const b = buildMarket(s, "mainnet", { ...usdConfig, floor: 1n }, null, refs);
    expect(b.tokens.items[0]!.price).toBe(8n * 10n ** 17n);
    expect(b.tokens.items[0]!.references).toEqual([refs.prices[0]!.reference]);
    const thin = buildMarket(s, "mainnet", { ...usdConfig, floor: 10n ** 40n }, null, refs);
    expect(thin.tokens.items[0]!.price).toBeNull();
    expect(thin.tokens.items[1]!.price).toBe(8n * 10n ** 17n);
  });
  it("never pool-prices expired mapped stocks and reports partial totals", () => {
    const s = snapshot();
    const refs = referenceSnapshot(s);
    refs.prices[0]!.reference.expiresAt = refs.asOf;
    const b = buildMarket(s, "mainnet", { ...usdConfig, floor: 1n }, null, refs);
    expect(b.tokens.items[0]!.price).toBeNull();
    expect(b.pools[0]!.valueLocked).toBeNull();
    expect(b.summary.current.coverage.valueLocked).toMatchObject({
      includedPools: 0,
      omittedPools: 1,
    });
  });
});

describe("USD daily volume at USDG parity", () => {
  it("restores completed days with six-decimal USDG precision, independently of current quotes", () => {
    const s = snapshot();
    s.pools[0]!.token1.decimals = 6;
    const usd = pricingConfig("usd", {
      PONDER_PRICING_QUOTE_USDG: s.pools[0]!.token1.address,
      PONDER_PRICING_DECIMALS_USDG: "6",
      PONDER_PRICING_MIN_LIQUIDITY_USDG: "0",
    });
    s.daily = ["10", "11"].map((bucket) => metric({ bucket, volume0: "0", volume1: "2500001" }));
    const data = buildMarket(s, "mainnet", usd, null);
    expect(data.volume.days.slice(-2).map((d) => d.volume)).toEqual([
      2500001n * 10n ** 12n,
      2500001n * 10n ** 12n,
    ]);
    expect(data.volume.days.at(-2)!.provisional).toBe(false);
    expect(data.volume.days.at(-1)!.provisional).toBe(true);
    expect(data.summary.statics.price).toBeNull();
    expect(data.volume.days.at(-2)!.coverage).toMatchObject({ includedPools: 1, omittedPools: 0 });
    const refs = {
      asOf: 0,
      allowDerived: true,
      restricted: [],
      prices: [
        {
          address: s.pools[0]!.token1.address,
          decimals: 6,
          valueWad: 8n * 10n ** 17n,
          reference: {
            source: "kraken" as const,
            asset: s.pools[0]!.token1.address,
            observedAt: 0,
            fetchedAt: 0,
            expiresAt: 900000,
            stale: false,
            halted: false,
          },
        },
      ],
    };
    const depegged = buildMarket(s, "mainnet", usd, null, refs);
    expect(depegged.tokens.items[1]!.price).toBe(8n * 10n ** 17n);
    expect(depegged.volume.days).toEqual(data.volume.days);
  });
  it("matches the existing historical pool graph and preserves missing-route coverage", () => {
    const s = snapshot();
    s.daily = [metric({ bucket: "10" })];
    const env = {
      PONDER_PRICING_QUOTE_USDG: s.pools[0]!.token1.address,
      PONDER_PRICING_DECIMALS_USDG: "18",
      PONDER_PRICING_MIN_LIQUIDITY_USDG: "0.000000000000000001",
    };
    const usd = pricingConfig("usd", env),
      usdg = pricingConfig("usdg", env);
    expect(buildMarket(s, "mainnet", usd, null).volume.days).toEqual(
      buildMarket(s, "mainnet", usdg, null).volume.days
    );
    const thin = { ...usd, historyUsdG: { ...usd.historyUsdG!, floor: 10n ** 40n } };
    const day = buildMarket(s, "mainnet", thin, null).volume.days.at(-2)!;
    expect(day.volume).toBeNull();
    expect(day.coverage.omittedPools).toBe(1);
  });
});
