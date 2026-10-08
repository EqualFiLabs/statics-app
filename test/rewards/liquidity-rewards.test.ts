import { describe, expect, it } from "vitest";
import {
  legInRange,
  legPeriodEstimate,
  legShareBps,
  liquidityStatus,
  poolPeriodEmission,
  type GaugeLegState,
  type GaugePoolState,
  type GaugeReserveState,
} from "@/lib/rewards/liquidity-rewards";

const poolId = `0x${"1".repeat(64)}` as const;
const pool = (overrides: Partial<GaugePoolState> = {}): GaugePoolState => ({
  poolId,
  stopped: false,
  referenceTick: 0,
  activeGaugeLiquidity: 1_000n,
  weight: 25n,
  stale: false,
  ...overrides,
});
const leg = (overrides: Partial<GaugeLegState> = {}): GaugeLegState => ({
  positionId: 1n,
  poolId,
  tickLower: -60,
  tickUpper: 60,
  liquidity: 400n,
  ...overrides,
});
const reserve: GaugeReserveState = {
  activated: true,
  periodBudget: 1_000n,
  periodFinish: 0n,
  totalAllocatedWeight: 100n,
};

describe("liquidity rewards", () => {
  it("matches the contract's half-open range check", () => {
    expect(legInRange(leg({ tickLower: 0 }), pool())).toBe(true);
    expect(legInRange(leg({ tickUpper: 0 }), pool())).toBe(false);
    expect(legInRange(leg(), pool({ referenceTick: 60 }))).toBe(false);
  });

  it("splits the period budget by allocation weight and active liquidity", () => {
    expect(poolPeriodEmission(pool(), reserve)).toBe(250n);
    expect(legShareBps(leg(), pool())).toBe(4_000n);
    expect(legPeriodEstimate(leg(), pool(), reserve)).toBe(100n);
    expect(legPeriodEstimate(leg(), pool({ referenceTick: 100 }), reserve)).toBe(0n);
  });

  it("pays nothing when inactive, unweighted, stale or stopped", () => {
    expect(poolPeriodEmission(pool(), { ...reserve, activated: false })).toBe(0n);
    expect(poolPeriodEmission(pool({ weight: 0n }), reserve)).toBe(0n);
    expect(poolPeriodEmission(pool({ stale: true }), reserve)).toBe(0n);
    expect(poolPeriodEmission(pool({ stopped: true }), reserve)).toBe(0n);
    expect(poolPeriodEmission(pool(), { ...reserve, totalAllocatedWeight: 0n })).toBe(0n);
  });

  it("explains the most fundamental reason a pool is not paying", () => {
    expect(liquidityStatus(pool({ stopped: true }), [leg()])).toBe("stopped");
    expect(liquidityStatus(pool(), [leg({ liquidity: 0n })])).toBe("no-liquidity");
    expect(liquidityStatus(pool({ weight: 0n }), [leg()])).toBe("no-emissions");
    expect(liquidityStatus(pool({ stale: true }), [leg()])).toBe("no-emissions");
    expect(liquidityStatus(pool({ referenceTick: 500 }), [leg()])).toBe("out-of-range");
    expect(
      liquidityStatus(pool({ referenceTick: 500 }), [
        leg(),
        leg({ positionId: 2n, tickUpper: 600 }),
      ])
    ).toBe("earning");
  });
});
