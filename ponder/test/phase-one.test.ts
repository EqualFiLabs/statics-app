import { describe, expect, it } from "vitest";
import { encodeFunctionData, toHex, type Hex } from "viem";

import { staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";

import {
  allocationSnapshotJson,
  decodeGaugeAllocationInput,
  reconcileGaugeAllocation,
  unpackBalanceDelta,
  unpackUint128Pair,
} from "../src/phase-one";

const poolA = `0x${"11".repeat(32)}` as Hex;
const poolB = `0x${"22".repeat(32)}` as Hex;
const versionA = `0x${"aa".repeat(32)}` as Hex;
const versionB = `0x${"bb".repeat(32)}` as Hex;

function packInt128Pair(amount0: bigint, amount1: bigint): bigint {
  const mask = (1n << 128n) - 1n;
  const packed = ((amount0 & mask) << 128n) | (amount1 & mask);
  return packed >= 1n << 255n ? packed - (1n << 256n) : packed;
}

describe("Phase 1 indexer reconciliation", () => {
  it("unpacks signed BalanceDelta and unsigned fee pairs", () => {
    expect(unpackBalanceDelta(packInt128Pair(-100n, 90n))).toEqual({
      amount0: -100n,
      amount1: 90n,
    });
    expect(unpackBalanceDelta(packInt128Pair(50n, -45n))).toEqual({
      amount0: 50n,
      amount1: -45n,
    });
    expect(unpackUint128Pair(7n | (3n << 128n))).toEqual({ amount0: 7n, amount1: 3n });
  });

  it("decodes and reconciles allocation calldata against same-block state", () => {
    const input = encodeFunctionData({
      abi: staticsGaugeIncentivesAbi,
      functionName: "setGaugeAllocations",
      args: [42n, [poolA, poolB], [60n, 40n]],
    });
    const snapshot = {
      nextAllocationAt: 1_000n,
      totalAllocated: 100n,
      active: [
        { poolId: poolA, amount: 60n, eligibilityVersion: versionA },
        { poolId: poolB, amount: 40n, eligibilityVersion: versionB },
      ],
      lockedStake: 100n,
    } as const;

    expect(decodeGaugeAllocationInput(input)).toEqual({
      positionId: 42n,
      poolIds: [poolA, poolB],
      amounts: [60n, 40n],
    });
    expect(() => reconcileGaugeAllocation(input, 42n, snapshot)).not.toThrow();
    expect(allocationSnapshotJson(snapshot)).toEqual({
      poolIdsJson: JSON.stringify([poolA, poolB]),
      amountsJson: JSON.stringify(["60", "40"]),
      eligibilityVersionsJson: JSON.stringify([versionA, versionB]),
    });
  });

  it("fails closed when calldata and state diverge", () => {
    const input = encodeFunctionData({
      abi: staticsGaugeIncentivesAbi,
      functionName: "setGaugeAllocations",
      args: [42n, [poolA], [100n]],
    });
    const snapshot = {
      nextAllocationAt: 1_000n,
      totalAllocated: 99n,
      active: [{ poolId: poolA, amount: 99n, eligibilityVersion: versionA }],
      lockedStake: 99n,
    } as const;
    expect(() => reconcileGaugeAllocation(input, 42n, snapshot)).toThrow(
      "does not match same-block"
    );
    expect(() => reconcileGaugeAllocation(toHex("not allocations"), 42n, snapshot)).toThrow();
  });
});
