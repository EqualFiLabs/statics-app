import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import type { IndexedAllocationPool } from "@/lib/indexer/phase-one";
import {
  THOUSAND_STATICS,
  allocationStatus,
  directedEmission,
  evenSplit,
  unlockReductions,
  WEEK,
  perThousandWeekly,
  planAllocationChange,
  poolIncentiveEstimates,
  streamWeeklyEstimate,
  suggestDestination,
  sumAssetAmounts,
} from "@/lib/rewards/allocations";

const poolA = `0x${"a".repeat(64)}` as Hex,
  poolB = `0x${"b".repeat(64)}` as Hex,
  poolC = `0x${"c".repeat(64)}` as Hex;
const version = `0x${"9".repeat(64)}` as Hex;
const usdc = `0x${"1".repeat(40)}` as Address,
  weth = `0x${"2".repeat(40)}` as Address;
type Stream = IndexedAllocationPool["allocatorStreams"][number];

const stream = (overrides: Partial<Stream> = {}): Stream =>
  ({
    slot: 1,
    asset: { address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 },
    allocatorShareBps: 5000,
    funded: true,
    paused: false,
    invalidated: false,
    terminated: false,
    rateNumerator: 14_000n,
    rateDenominator: 2n * WEEK,
    lastUpdate: 8n * WEEK,
    periodFinish: 10n * WEEK,
    ...overrides,
  }) as Stream;
const pool = (overrides: Partial<IndexedAllocationPool> = {}): IndexedAllocationPool =>
  ({
    poolId: poolA,
    weight: 100n,
    stale: false,
    eligibility: { eligible: true, reasons: [] },
    incentiveStreamCount: 1,
    allocatorStreams: [stream()],
    ...overrides,
  }) as IndexedAllocationPool;

describe("allocator incentive estimates", () => {
  it("pays the weekly slice of a longer stream pro rata to weight", () => {
    // 14,000 over two weeks → 7,000 this week; 25 of 100 weight → 1,750.
    expect(streamWeeklyEstimate(stream(), 100n, 25n)).toBe(1_750n);
  });

  it("dilutes new weight by itself", () => {
    // Adding 100 to a 100-weight pool earns half, not all, of the week.
    expect(streamWeeklyEstimate(stream(), 100n, 0n, 100n)).toBe(3_500n);
  });

  it("caps a stream ending within the week at its remaining budget", () => {
    expect(streamWeeklyEstimate(stream({ rateDenominator: WEEK / 2n }), 100n, 100n)).toBe(14_000n);
  });

  it("bounds the coming week by chain time rather than the stored finish", () => {
    expect(streamWeeklyEstimate(stream(), 100n, 100n, 0n, 9n * WEEK + WEEK / 2n)).toBe(3_500n);
    expect(streamWeeklyEstimate(stream(), 100n, 100n, 0n, 10n * WEEK)).toBe(0n);
  });

  it("resumes a paused stream once weight arrives, and pays nothing when unfunded or over", () => {
    expect(streamWeeklyEstimate(stream({ paused: true }), 0n, 0n, 10n)).toBe(7_000n);
    expect(streamWeeklyEstimate(stream({ funded: false }), 100n, 100n)).toBe(0n);
    expect(streamWeeklyEstimate(stream(), 100n, 0n)).toBe(0n);
    expect(streamWeeklyEstimate(stream(), 100n, 50n, 0n, 10n * WEEK)).toBe(0n);
  });

  it("sums per asset and never across assets", () => {
    const mixed = pool({
      allocatorStreams: [
        stream(),
        stream({ slot: 2 }),
        stream({
          slot: 3,
          asset: { address: weth, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
        }),
      ],
    });
    expect(poolIncentiveEstimates(mixed, 100n)).toEqual([
      { asset: usdc, amount: 14_000n },
      { asset: weth, amount: 7_000n },
    ]);
    expect(
      sumAssetAmounts([
        [{ asset: usdc, amount: 1n }],
        [{ asset: usdc.toUpperCase() as Address, amount: 2n }],
      ])
    ).toEqual([{ asset: usdc, amount: 3n }]);
  });

  it("compares pools per 1,000 STATICS including dilution", () => {
    const thin = pool({ weight: 0n }),
      thick = pool({ weight: 9n * THOUSAND_STATICS });
    expect(perThousandWeekly(thin)).toEqual([{ asset: usdc, amount: 7_000n }]);
    expect(perThousandWeekly(thick)).toEqual([{ asset: usdc, amount: 700n }]);
  });
});

describe("allocation change planning", () => {
  const current = (overrides = {}) => ({
    nextAllocationAt: 0,
    totalAllocated: 300n,
    lockedStake: 300n,
    active: [
      { poolId: poolA, amount: 200n, eligibilityVersion: version },
      { poolId: poolB, amount: 100n, eligibilityVersion: version },
    ],
    ...overrides,
  });
  const plan = (
    edits: [Hex, bigint][],
    overrides: Partial<Parameters<typeof planAllocationChange>[0]> = {}
  ) =>
    planAllocationChange({
      positionId: 7n,
      current: current(),
      stakedBalance: 1_000n,
      maximumAllocations: 16n,
      cooldown: 14_400n,
      now: 1_000n,
      edits: new Map(edits.map(([poolId, amount]) => [poolId.toLowerCase(), { poolId, amount }])),
      eligible: () => true,
      ...overrides,
    });

  it("keeps other pools, adds the edit and starts a cooldown outside one", () => {
    const result = plan([[poolC, 50n]]);
    expect(result.validation.valid).toBe(true);
    expect(result.next).toEqual([
      { poolId: poolA, amount: 200n },
      { poolId: poolB, amount: 100n },
      { poolId: poolC, amount: 50n },
    ]);
    expect(result.changes).toEqual([{ poolId: poolC, before: 0n, after: 50n }]);
    expect(result.startsCooldown).toBe(true);
    expect(result.cooldownUntil).toBe(15_400n);
    expect(result.lockedAfter).toBe(350n);
  });

  it("starts a cooldown even for a pure reduction outside cooldown", () => {
    const result = plan([[poolA, 0n]]);
    expect(result.validation.valid).toBe(true);
    expect(result.changes).toEqual([{ poolId: poolA, before: 200n, after: 0n }]);
    expect(result.startsCooldown).toBe(true);
  });

  it("allows only reductions during cooldown and does not restart it", () => {
    const cooling = { current: current({ nextAllocationAt: 5_000 }) };
    expect(plan([[poolA, 150n]], cooling)).toMatchObject({
      validation: { valid: true },
      startsCooldown: false,
      cooldownUntil: null,
    });
    expect(plan([[poolA, 250n]], cooling).validation.valid).toBe(false);
    expect(plan([[poolC, 1n]], cooling).validation.valid).toBe(false);
  });

  it("drops ineligible pools the contract would reject, even during cooldown", () => {
    const result = plan([[poolC, 100n]], {
      eligible: (poolId) => poolId !== poolB,
    });
    expect(result.droppedIneligible).toEqual([poolB]);
    expect(result.next.map((entry) => entry.poolId)).toEqual([poolA, poolC]);
    expect(result.changes).toContainEqual({ poolId: poolB, before: 100n, after: 0n });
    expect(result.validation.valid).toBe(true);
    // Moving the stale stake during cooldown is still an addition, so it is rejected.
    const cooling = plan([[poolC, 100n]], {
      current: current({ nextAllocationAt: 5_000 }),
      eligible: (poolId) => poolId !== poolB,
    });
    expect(cooling.validation.valid).toBe(false);
    expect(
      plan([], { current: current({ nextAllocationAt: 5_000 }), eligible: (id) => id !== poolB })
        .validation.valid
    ).toBe(true);
  });

  it("can clear a stale-only set during cooldown with no eligible destination", () => {
    const result = plan([[poolA, 0n]], {
      current: current({
        nextAllocationAt: 5_000,
        totalAllocated: 200n,
        lockedStake: 0n,
        active: [{ poolId: poolA, amount: 200n, eligibilityVersion: version }],
      }),
      eligible: () => false,
    });
    expect(result.validation.valid).toBe(true);
    expect(result.next).toEqual([]);
    expect(result.changes).toEqual([{ poolId: poolA, before: 200n, after: 0n }]);
  });

  it("rejects allocating to an ineligible pool, over stake, or past the pool limit", () => {
    expect(plan([[poolC, 1n]], { eligible: (id) => id !== poolC }).validation.errors).toContain(
      `Pool ${poolC} is not eligible for allocations.`
    );
    expect(plan([[poolC, 701n]]).issues).toEqual(["exceeds-stake"]);
    expect(plan([[poolC, 1n]], { maximumAllocations: 2n }).issues).toEqual(["pool-limit"]);
    expect(plan([[poolC, 1n]], { eligible: (id) => id !== poolC }).issues).toEqual([
      "ineligible-target",
    ]);
    expect(plan([[poolA, 250n]], { current: current({ nextAllocationAt: 5_000 }) }).issues).toEqual(
      ["cooldown-increase"]
    );
    expect(plan([[poolA, 150n]]).issues).toEqual([]);
  });

  it("reports no change and no cooldown when nothing differs", () => {
    expect(plan([[poolA, 200n]])).toMatchObject({ changes: [], startsCooldown: false });
  });
});

describe("stale allocation destination", () => {
  const pools = [
    pool({ poolId: poolA, incentiveStreamCount: 3, weight: 500n }),
    pool({ poolId: poolB, incentiveStreamCount: 1, weight: 10n }),
    pool({ poolId: poolC, incentiveStreamCount: 3, weight: 50n }),
  ];
  const suggest = (overrides: Partial<Parameters<typeof suggestDestination>[0]> = {}) =>
    suggestDestination({
      pools,
      exclude: [],
      liquidityPools: [],
      allocatedPools: [],
      ...overrides,
    });

  it("prefers a pool where the wallet provides liquidity", () => {
    expect(suggest({ liquidityPools: [poolB] })).toEqual({
      poolId: poolB,
      reason: "provides-liquidity",
    });
  });

  it("then a pool the position already allocates to", () => {
    expect(suggest({ allocatedPools: [poolA] })).toEqual({
      poolId: poolA,
      reason: "already-allocated",
    });
  });

  it("otherwise the most incentivised pool, thinner weight first", () => {
    expect(suggest()).toEqual({ poolId: poolC, reason: "incentives" });
  });

  it("skips excluded and ineligible pools, and suggests nothing without incentives", () => {
    const stopped = pool({
      poolId: poolC,
      incentiveStreamCount: 4,
      eligibility: { eligible: false, reasons: ["gauge-stopped"] },
    });
    expect(suggest({ pools: [stopped, pools[0]], exclude: [poolA] })).toBeNull();
    expect(suggest({ pools: [pool({ incentiveStreamCount: 0 })] })).toBeNull();
  });
});

describe("allocation status and directed emissions", () => {
  const current = `0x${"5".repeat(64)}` as Hex,
    old = `0x${"6".repeat(64)}` as Hex;
  const eligible = pool({ currentVersion: current } as Partial<IndexedAllocationPool>);

  it("is active only on the pool's current eligibility version", () => {
    expect(allocationStatus({ eligibilityVersion: current }, eligible)).toBe("active");
    // Restriction lifted: eligible again, but the old allocation must be resubmitted.
    expect(allocationStatus({ eligibilityVersion: old }, eligible)).toBe("stale");
    expect(
      allocationStatus(
        { eligibilityVersion: current },
        pool({
          currentVersion: current,
          eligibility: { eligible: false, reasons: ["gauge-stopped"] },
        } as Partial<IndexedAllocationPool>)
      )
    ).toBe("stale");
    expect(allocationStatus({ eligibilityVersion: current }, undefined)).toBe("unknown");
  });

  it("routes the period budget pro rata and is unknown once the period expires", () => {
    const reserve = {
      activated: true,
      periodBudget: 700n,
      totalAllocatedWeight: 200n,
      periodExpired: false,
    };
    expect(directedEmission(50n, reserve)).toBe(175n);
    expect(directedEmission(50n, { ...reserve, activated: false })).toBe(0n);
    expect(directedEmission(50n, { ...reserve, periodExpired: true })).toBeUndefined();
    expect(directedEmission(50n, null)).toBeUndefined();
  });
});

describe("allocation editor helpers", () => {
  it("frees stake from the largest allocations first", () => {
    expect(
      unlockReductions(
        [
          { poolId: poolA, amount: 10n },
          { poolId: poolB, amount: 30n },
          { poolId: poolC, amount: 20n },
        ],
        35n
      )
    ).toEqual([
      { poolId: poolB, amount: 0n },
      { poolId: poolC, amount: 15n },
    ]);
    expect(unlockReductions([{ poolId: poolA, amount: 10n }], 0n)).toEqual([]);
  });
  it("splits evenly with the remainder on the first pool", () => {
    expect(evenSplit([poolA, poolB, poolC], 100n)).toEqual([
      { poolId: poolA, amount: 34n },
      { poolId: poolB, amount: 33n },
      { poolId: poolC, amount: 33n },
    ]);
    expect(evenSplit([], 100n)).toEqual([]);
  });
});
