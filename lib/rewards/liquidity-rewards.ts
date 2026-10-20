import type { Hex } from "viem";

/** Live gauge state for one pool. */
export type GaugePoolState = Readonly<{
  poolId: Hex;
  stopped: boolean;
  referenceTick: number;
  activeGaugeLiquidity: bigint;
  /** Protocol allocation weight routed to this pool. */
  weight: bigint;
  /** Allocations target an outdated eligibility version, so their share is recycled. */
  stale: boolean;
}>;

/** One Position NFT's managed liquidity leg in one pool. */
export type GaugeLegState = Readonly<{
  positionId: bigint;
  poolId: Hex;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}>;

export type GaugeReserveState = Readonly<{
  activated: boolean;
  periodBudget: bigint;
  periodFinish: bigint;
  totalAllocatedWeight: bigint;
}>;

export type LiquidityStatus =
  "stopped" | "no-emissions" | "out-of-range" | "earning" | "no-liquidity" | "unavailable";

/** Mirrors LibRangeGauge.containsTick: a leg earns while tickLower <= tick < tickUpper. */
export function legInRange(leg: GaugeLegState, pool: GaugePoolState): boolean {
  return leg.tickLower <= pool.referenceTick && pool.referenceTick < leg.tickUpper;
}

/**
 * The pool's share of this period's protocol STATICS budget at current weights. An estimate:
 * weights, active liquidity and the budget all change, and an ineligible pool recycles its share.
 */
export function poolPeriodEmission(pool: GaugePoolState, reserve: GaugeReserveState): bigint {
  if (
    !reserve.activated ||
    pool.stopped ||
    pool.stale ||
    pool.weight === 0n ||
    reserve.totalAllocatedWeight === 0n
  )
    return 0n;
  return (reserve.periodBudget * pool.weight) / reserve.totalAllocatedWeight;
}

/** A leg's share of the pool's active gauge liquidity, in basis points; zero when out of range. */
export function legShareBps(leg: GaugeLegState, pool: GaugePoolState): bigint {
  if (!legInRange(leg, pool) || pool.activeGaugeLiquidity === 0n) return 0n;
  return (leg.liquidity * 10_000n) / pool.activeGaugeLiquidity;
}

export function legPeriodEstimate(
  leg: GaugeLegState,
  pool: GaugePoolState,
  reserve: GaugeReserveState
): bigint {
  if (!legInRange(leg, pool) || pool.activeGaugeLiquidity === 0n) return 0n;
  return (poolPeriodEmission(pool, reserve) * leg.liquidity) / pool.activeGaugeLiquidity;
}

/** Why a pool is or isn't paying you, most fundamental reason first. */
export function liquidityStatus(
  pool: GaugePoolState,
  legs: readonly GaugeLegState[],
  reserve: GaugeReserveState | undefined
): LiquidityStatus {
  if (pool.stopped) return "stopped";
  const live = legs.filter((leg) => leg.liquidity > 0n);
  if (!live.length) return "no-liquidity";
  // Range and lifecycle state remain known when the stored emission period expires.
  // Its old budget cannot establish whether an in-range leg earns in the new period.
  const inRange = live.some((leg) => legInRange(leg, pool));
  if (!reserve) return inRange ? "unavailable" : "out-of-range";
  if (poolPeriodEmission(pool, reserve) === 0n) return "no-emissions";
  return inRange ? "earning" : "out-of-range";
}

export function needsLiquidityAttention(status: LiquidityStatus): boolean {
  return status === "out-of-range" || status === "no-emissions" || status === "stopped";
}
