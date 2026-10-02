import { decodeFunctionData, type Address, type Hex } from "viem";

import { staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";

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

export function decodeGaugeAllocationInput(input: Hex): Readonly<{
  positionId: bigint;
  poolIds: readonly Hex[];
  amounts: readonly bigint[];
}> {
  const decoded = decodeFunctionData({ abi: staticsGaugeIncentivesAbi, data: input });
  if (decoded.functionName !== "setGaugeAllocations") {
    throw new Error("PositionGaugeAllocationsSet transaction did not call setGaugeAllocations.");
  }
  const [positionId, poolIds, amounts] = decoded.args;
  return { positionId, poolIds, amounts };
}

export function reconcileGaugeAllocation(
  input: Hex,
  eventPositionId: bigint,
  snapshot: GaugeAllocationSnapshot
): void {
  const decoded = decodeGaugeAllocationInput(input);
  if (decoded.positionId !== eventPositionId) {
    throw new Error("Gauge allocation calldata position does not match the emitted position.");
  }
  if (decoded.poolIds.length !== decoded.amounts.length) {
    throw new Error("Gauge allocation calldata arrays have different lengths.");
  }
  if (decoded.poolIds.length !== snapshot.active.length) {
    throw new Error("Gauge allocation calldata does not match same-block onchain state.");
  }
  let total = 0n;
  for (let index = 0; index < snapshot.active.length; index += 1) {
    const expectedPool = decoded.poolIds[index];
    const expectedAmount = decoded.amounts[index];
    const actual = snapshot.active[index];
    if (
      expectedPool.toLowerCase() !== actual.poolId.toLowerCase() ||
      expectedAmount !== actual.amount
    ) {
      throw new Error("Gauge allocation calldata does not match same-block onchain state.");
    }
    total += actual.amount;
  }
  if (total !== snapshot.totalAllocated || snapshot.lockedStake !== snapshot.totalAllocated) {
    throw new Error("Gauge allocation totals do not match same-block onchain state.");
  }
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
