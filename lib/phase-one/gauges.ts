import type { Address, Hex, PublicClient } from "viem";

import {
  buildClaimGaugeAllocatorRewardsCall,
  buildClaimRangeLpRewardsCall,
  buildForfeitGaugeAllocatorRewardCall,
  buildForfeitRangeLpRewardCall,
  buildSetGaugeAllocationsCall,
  staticsGaugeIncentivesAbi,
  staticsRangeGaugeAbi,
  type GaugeAllocatorClaimPreview,
  type GaugePositionAllocations,
  type RangeGaugePendingRewards,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";

export type GaugeAllocationInput = Readonly<{ poolId: Hex; amount: bigint }>;

export type GaugeAllocationValidation = Readonly<{
  valid: boolean;
  coolingDown: boolean;
  reductionOnly: boolean;
  totalAllocated: bigint;
  availableStake: bigint;
  errors: readonly string[];
}>;

export type PositionGaugeState = Readonly<{
  allocations: GaugePositionAllocations;
  maximumAllocations: bigint;
  coolingDown: boolean;
}>;

export function validateGaugeAllocationChange(input: {
  current: GaugePositionAllocations;
  next: readonly GaugeAllocationInput[];
  stakedBalance: bigint;
  maximumAllocations: bigint;
  now: number;
}): GaugeAllocationValidation {
  const errors: string[] = [];
  const coolingDown = input.now < input.current.nextAllocationAt;
  if (BigInt(input.next.length) > input.maximumAllocations) {
    errors.push("Allocation count exceeds the live per-position limit.");
  }
  const prior = new Map(
    input.current.active.map((allocation) => [allocation.poolId.toLowerCase(), allocation.amount])
  );
  const seen = new Set<string>();
  let totalAllocated = 0n;
  for (const allocation of input.next) {
    const key = allocation.poolId.toLowerCase();
    if (seen.has(key)) errors.push(`Pool ${allocation.poolId} is allocated more than once.`);
    seen.add(key);
    if (allocation.amount <= 0n)
      errors.push(`Pool ${allocation.poolId} must have a positive allocation.`);
    totalAllocated += allocation.amount;
    if (coolingDown) {
      const priorAmount = prior.get(key);
      if (priorAmount === undefined || allocation.amount > priorAmount) {
        errors.push("During cooldown, allocations may only be reduced or removed.");
      }
    }
  }
  if (totalAllocated > input.stakedBalance) errors.push("Total allocation exceeds staked STATICS.");
  return {
    valid: errors.length === 0,
    coolingDown,
    reductionOnly: coolingDown,
    totalAllocated,
    availableStake:
      input.stakedBalance > totalAllocated ? input.stakedBalance - totalAllocated : 0n,
    errors: [...new Set(errors)],
  };
}

export function buildGaugeAllocationTransaction(input: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  next: readonly GaugeAllocationInput[];
  validation: GaugeAllocationValidation;
}): Readonly<{ target: Address; calldata: Hex; value: 0n }> {
  if (!input.validation.valid)
    throw new Error(input.validation.errors[0] ?? "Gauge allocation change is invalid.");
  return {
    target: input.deployment.contracts.diamond,
    calldata: buildSetGaugeAllocationsCall(
      input.positionId,
      input.next.map((allocation) => allocation.poolId),
      input.next.map((allocation) => allocation.amount)
    ),
    value: 0n,
  };
}

export async function readPositionGaugeState(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  now: number;
  account: Address;
}): Promise<PositionGaugeState> {
  const [rawAllocations, maximumAllocations] = await Promise.all([
    input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugePositionAllocations",
      args: [input.positionId],
      account: input.account,
    }),
    input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "maxGaugeAllocationsPerPosition",
      account: input.account,
    }),
  ]);
  const allocations: GaugePositionAllocations = {
    nextAllocationAt: rawAllocations[0],
    totalAllocated: rawAllocations[1],
    active: rawAllocations[2],
    lockedStake: rawAllocations[3],
  };
  return {
    allocations,
    maximumAllocations,
    coolingDown: input.now < allocations.nextAllocationAt,
  };
}

export async function readPositionGaugeRewards(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: Hex;
  allocatorSlots?: readonly number[];
  includeProtocolAccrual?: boolean;
  account: Address;
}): Promise<
  Readonly<{ lp: RangeGaugePendingRewards; allocator: readonly GaugeAllocatorClaimPreview[] }>
> {
  let lp = await input.publicClient.readContract({
    address: input.deployment.contracts.diamond,
    abi: staticsRangeGaugeAbi,
    functionName: "previewLpRewards",
    args: [input.positionId, input.poolId],
    account: input.account,
  });
  if (input.includeProtocolAccrual !== false && lp.slotCount > 0) {
    const leg = await input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsRangeGaugeAbi,
      functionName: "lpLeg",
      args: [input.positionId, input.poolId],
    });
    if (leg.liquidity > 0n) {
      // The slot-0 view omits uncheckpointed reserve routing. eth_call runs the
      // claim's settlement without signing, transferring tokens, or persisting state.
      const preview = await input.publicClient.simulateContract({
        address: input.deployment.contracts.diamond,
        abi: staticsRangeGaugeAbi,
        functionName: "claimLpRewards",
        args: [input.positionId, input.poolId, [0], [0n], input.account],
        account: input.account,
      });
      if (preview.result.length !== 1) throw new Error("Invalid LP Gauge Rewards preview.");
      lp = {
        ...lp,
        amounts: [preview.result[0], lp.amounts[1], lp.amounts[2], lp.amounts[3], lp.amounts[4]],
      };
    }
  }
  const allocatorSlots =
    input.allocatorSlots ??
    Array.from({ length: Math.max(0, lp.slotCount - 1) }, (_, index) => index + 1);
  const allocator =
    allocatorSlots.length === 0
      ? ([] as readonly GaugeAllocatorClaimPreview[])
      : await input.publicClient.readContract({
          address: input.deployment.contracts.diamond,
          abi: staticsGaugeIncentivesAbi,
          functionName: "previewGaugeAllocatorRewards",
          args: [input.positionId, input.poolId, allocatorSlots],
          account: input.account,
        });
  return { lp, allocator };
}

export function buildGaugeRewardResolution(input: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: Hex;
  action:
    | Readonly<{
        kind: "claim-lp";
        slots: readonly number[];
        minimumAmounts: readonly bigint[];
        receiver: Address;
      }>
    | Readonly<{ kind: "forfeit-lp"; slot: number }>
    | Readonly<{
        kind: "claim-allocator";
        slots: readonly number[];
        minimumAmounts: readonly bigint[];
        receiver: Address;
      }>
    | Readonly<{ kind: "forfeit-allocator"; slot: number }>;
}): Readonly<{ target: Address; calldata: Hex; value: 0n }> {
  let calldata: Hex;
  switch (input.action.kind) {
    case "claim-lp":
      calldata = buildClaimRangeLpRewardsCall(
        input.positionId,
        input.poolId,
        input.action.slots,
        input.action.minimumAmounts,
        input.action.receiver
      );
      break;
    case "forfeit-lp":
      calldata = buildForfeitRangeLpRewardCall(input.positionId, input.poolId, input.action.slot);
      break;
    case "claim-allocator":
      calldata = buildClaimGaugeAllocatorRewardsCall(
        input.positionId,
        input.poolId,
        input.action.slots,
        input.action.minimumAmounts,
        input.action.receiver
      );
      break;
    case "forfeit-allocator":
      calldata = buildForfeitGaugeAllocatorRewardCall(
        input.positionId,
        input.poolId,
        input.action.slot
      );
      break;
  }
  return { target: input.deployment.contracts.diamond, calldata, value: 0n };
}

/** Editing a single pool never clears allocations to other pools. */
export function replacePoolAllocation(
  current: readonly GaugeAllocationInput[],
  poolId: Hex,
  amount: bigint
): readonly GaugeAllocationInput[] {
  if (amount < 0n) throw new Error("Allocation cannot be negative.");
  const others = current.filter((entry) => entry.poolId.toLowerCase() !== poolId.toLowerCase());
  return amount === 0n ? others : [...others, { poolId, amount }];
}
