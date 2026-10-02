import { decodeFunctionData, getAddress, zeroAddress, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  staticsGaugeIncentivesAbi,
  staticsRangeGaugeAbi,
  type GaugePositionAllocations,
} from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  buildGaugeAllocationTransaction,
  buildGaugeRewardResolution,
  readPositionGaugeRewards,
  validateGaugeAllocationChange,
} from "@/lib/phase-one/gauges";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;
const deployment = { contracts: { diamond: address("1") } } as PhaseOneDeployment;
const current: GaugePositionAllocations = {
  nextAllocationAt: 2_000,
  totalAllocated: 70n,
  active: [
    { poolId: hash("1"), amount: 40n, eligibilityVersion: hash("a") },
    { poolId: hash("2"), amount: 30n, eligibilityVersion: hash("b") },
  ],
  lockedStake: 70n,
};

describe("Phase 1 gauge allocations and rewards", () => {
  it("allows only reductions and removals during cooldown", () => {
    const reduced = validateGaugeAllocationChange({
      current,
      next: [
        { poolId: hash("1"), amount: 35n },
        { poolId: hash("2"), amount: 30n },
      ],
      stakedBalance: 100n,
      maximumAllocations: 16n,
      now: 1_500,
    });
    expect(reduced).toMatchObject({
      valid: true,
      coolingDown: true,
      reductionOnly: true,
      totalAllocated: 65n,
    });

    expect(
      validateGaugeAllocationChange({
        current,
        next: [{ poolId: hash("3"), amount: 1n }],
        stakedBalance: 100n,
        maximumAllocations: 16n,
        now: 1_500,
      }).errors
    ).toContain("During cooldown, allocations may only be reduced or removed.");
    expect(
      validateGaugeAllocationChange({
        current,
        next: [{ poolId: hash("1"), amount: 41n }],
        stakedBalance: 100n,
        maximumAllocations: 16n,
        now: 1_500,
      }).valid
    ).toBe(false);
  });

  it("allows persistent redirects after cooldown and enforces staked capacity", () => {
    const valid = validateGaugeAllocationChange({
      current,
      next: [{ poolId: hash("3"), amount: 100n }],
      stakedBalance: 100n,
      maximumAllocations: 16n,
      now: 2_000,
    });
    expect(valid.valid).toBe(true);
    const transaction = buildGaugeAllocationTransaction({
      deployment,
      positionId: 9n,
      next: [{ poolId: hash("3"), amount: 100n }],
      validation: valid,
    });
    const decoded = decodeFunctionData({
      abi: staticsGaugeIncentivesAbi,
      data: transaction.calldata,
    });
    expect(decoded.functionName).toBe("setGaugeAllocations");
    expect(decoded.args).toEqual([9n, [hash("3")], [100n]]);

    expect(
      validateGaugeAllocationChange({
        current,
        next: [{ poolId: hash("3"), amount: 101n }],
        stakedBalance: 100n,
        maximumAllocations: 16n,
        now: 2_000,
      }).errors
    ).toContain("Total allocation exceeds staked STATICS.");
  });

  it("keeps LP and allocator claim and forfeiture encodings distinct", () => {
    const receiver = address("2");
    const actions = [
      { kind: "claim-lp" as const, slots: [0, 1], minimumAmounts: [1n, 2n], receiver },
      { kind: "forfeit-lp" as const, slot: 1 },
      { kind: "claim-allocator" as const, slots: [1], minimumAmounts: [3n], receiver },
      { kind: "forfeit-allocator" as const, slot: 1 },
    ];
    expect(
      actions.map((action) => {
        const transaction = buildGaugeRewardResolution({
          deployment,
          positionId: 9n,
          poolId: hash("3"),
          action,
        });
        return decodeFunctionData({
          abi: action.kind.includes("allocator") ? staticsGaugeIncentivesAbi : staticsRangeGaugeAbi,
          data: transaction.calldata,
        }).functionName;
      })
    ).toEqual([
      "claimLpRewards",
      "forfeitLpReward",
      "claimGaugeAllocatorRewards",
      "forfeitGaugeAllocatorReward",
    ]);
  });

  it("derives only configured non-STATICS allocator slots from the LP reward config", async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce({
        slotCount: 3,
        assets: [zeroAddress, address("2"), address("3"), zeroAddress, zeroAddress],
        amounts: [0n, 1n, 2n, 0n, 0n],
      })
      .mockResolvedValueOnce([]);
    await readPositionGaugeRewards({
      publicClient: { readContract } as unknown as PublicClient,
      deployment,
      positionId: 9n,
      poolId: hash("3"),
      account: address("4"),
    });
    expect(readContract.mock.calls[1]?.[0].args).toEqual([9n, hash("3"), [1, 2]]);
  });
});
