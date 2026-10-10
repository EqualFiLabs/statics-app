import { type Address, type Hex } from "viem";

import { getSqrtPriceAtTick } from "@statics-protocol/sdk/phase-one";

import {
  absoluteAmount,
  aggregateMarketCandles,
  candleBucket,
  type MarketCandleRow,
  type MarketResolution,
} from "./market";

const UINT128_MASK = (1n << 128n) - 1n;
const INT128_SIGN = 1n << 127n;
const INT128_MODULUS = 1n << 128n;

function signedInt128(value: bigint): bigint {
  const masked = value & UINT128_MASK;
  return masked >= INT128_SIGN ? masked - INT128_MODULUS : masked;
}

export function unpackBalanceDelta(delta: bigint): Readonly<{ amount0: bigint; amount1: bigint }> {
  return {
    amount0: signedInt128(delta >> 128n),
    amount1: signedInt128(delta),
  };
}

export function unpackUint128Pair(packed: bigint): Readonly<{ amount0: bigint; amount1: bigint }> {
  return {
    amount0: packed & UINT128_MASK,
    amount1: (packed >> 128n) & UINT128_MASK,
  };
}

export type GaugeAllocationSnapshot = Readonly<{
  nextAllocationAt: bigint;
  totalAllocated: bigint;
  active: readonly Readonly<{
    poolId: Hex;
    amount: bigint;
    eligibilityVersion: Hex;
  }>[];
  lockedStake: bigint;
}>;

export function normalizeGaugeAllocationSnapshot(
  value: readonly [
    nextAllocationAt: number,
    totalAllocated: bigint,
    active: readonly Readonly<{
      poolId: Hex;
      amount: bigint;
      eligibilityVersion: Hex;
    }>[],
    lockedStake: bigint,
  ]
): GaugeAllocationSnapshot {
  return {
    nextAllocationAt: BigInt(value[0]),
    totalAllocated: value[1],
    active: value[2],
    lockedStake: value[3],
  };
}

export function allocationSnapshotJson(snapshot: GaugeAllocationSnapshot): Readonly<{
  poolIdsJson: string;
  amountsJson: string;
  eligibilityVersionsJson: string;
}> {
  return {
    poolIdsJson: JSON.stringify(snapshot.active.map((allocation) => allocation.poolId)),
    amountsJson: JSON.stringify(snapshot.active.map((allocation) => allocation.amount.toString())),
    eligibilityVersionsJson: JSON.stringify(
      snapshot.active.map((allocation) => allocation.eligibilityVersion)
    ),
  };
}

export function phaseOneEntityKey(deploymentId: string, ...parts: readonly (string | bigint)[]) {
  return `${deploymentId}:${parts.map(String).join(":")}`;
}

export type GaugeReserveSnapshot = Readonly<{
  activated: boolean;
  releaseBps: number;
  pendingReleaseBps: number;
  pendingReleaseAt: number;
  scheduleStart: number;
  lastCheckpoint: number;
  periodStart: number;
  periodFinish: number;
  currentPeriod: bigint;
  allocationCooldown: number;
  available: bigint;
  deferred: bigint;
  committed: bigint;
  periodBudget: bigint;
  periodAccounted: bigint;
  totalAllocatedWeight: bigint;
  unsettledRoutingLiability: bigint;
}>;

export type PhaseOneActivityInput = Readonly<{
  kind: string;
  positionId?: bigint;
  poolId?: Hex;
  asset?: Address;
  amount?: bigint;
  slot?: number;
  actor?: Address;
}>;

export type PhaseOneSwapCandleInput = Readonly<{
  finalTick: number;
  amount0: bigint;
  amount1: bigint;
  flags: number;
  blockNumber: bigint;
  blockTimestamp: bigint;
}>;

export function aggregatePhaseOneSwapCandles(
  swaps: readonly PhaseOneSwapCandleInput[],
  resolution: MarketResolution
): MarketCandleRow[] {
  const minutes = swaps.flatMap((swap) => {
    const minute = phaseOneMinuteCandle(swap);
    return minute ? [minute] : [];
  });
  return aggregateMarketCandles(minutes, resolution);
}

export function phaseOneMinuteCandle(swap: PhaseOneSwapCandleInput): MarketCandleRow | null {
  if ((swap.flags & 4) !== 0) return null;
  const sqrtPriceX96 = getSqrtPriceAtTick(swap.finalTick);
  const zeroForOne = (swap.flags & 1) !== 0;
  return {
    bucketTimestamp: candleBucket(swap.blockTimestamp),
    openSqrtPriceX96: sqrtPriceX96,
    highSqrtPriceX96: sqrtPriceX96,
    lowSqrtPriceX96: sqrtPriceX96,
    closeSqrtPriceX96: sqrtPriceX96,
    volume0: absoluteAmount(swap.amount0),
    volume1: absoluteAmount(swap.amount1),
    zeroForOneCount: zeroForOne ? 1 : 0,
    oneForZeroCount: zeroForOne ? 0 : 1,
    swapCount: 1,
    firstBlock: swap.blockNumber,
    lastBlock: swap.blockNumber,
  };
}

export function mergeMinuteCandle(row: MarketCandleRow, next: MarketCandleRow): MarketCandleRow {
  return {
    bucketTimestamp: row.bucketTimestamp,
    openSqrtPriceX96: row.openSqrtPriceX96,
    firstBlock: row.firstBlock,
    highSqrtPriceX96:
      row.highSqrtPriceX96 > next.highSqrtPriceX96 ? row.highSqrtPriceX96 : next.highSqrtPriceX96,
    lowSqrtPriceX96:
      row.lowSqrtPriceX96 < next.lowSqrtPriceX96 ? row.lowSqrtPriceX96 : next.lowSqrtPriceX96,
    closeSqrtPriceX96: next.closeSqrtPriceX96,
    volume0: row.volume0 + next.volume0,
    volume1: row.volume1 + next.volume1,
    zeroForOneCount: row.zeroForOneCount + next.zeroForOneCount,
    oneForZeroCount: row.oneForZeroCount + next.oneForZeroCount,
    swapCount: row.swapCount + next.swapCount,
    lastBlock: next.lastBlock,
  };
}
