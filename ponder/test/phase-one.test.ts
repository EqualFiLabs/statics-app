import { describe, expect, it } from "vitest";
import { type Hex } from "viem";

import {
  allocationSnapshotJson,
  unpackBalanceDelta,
  unpackUint128Pair,
  aggregatePhaseOneSwapCandles,
  phaseOneMinuteCandle,
  mergeMinuteCandle,
} from "../src/phase-one";

const poolA = `0x${"11".repeat(32)}` as Hex;
const versionA = `0x${"aa".repeat(32)}` as Hex;

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

  it("serializes the block ending allocation snapshot", () => {
    expect(
      allocationSnapshotJson({
        nextAllocationAt: 1000n,
        totalAllocated: 5n,
        active: [{ poolId: poolA, amount: 5n, eligibilityVersion: versionA }],
        lockedStake: 5n,
      })
    ).toEqual({
      poolIdsJson: JSON.stringify([poolA]),
      amountsJson: '["5"]',
      eligibilityVersionsJson: JSON.stringify([versionA]),
    });
  });
  it("keeps every swap in busy minute intervals and excludes internal swaps", () => {
    const input = {
      finalTick: 0,
      amount0: -100n,
      amount1: 99n,
      flags: 1,
      blockNumber: 10n,
      blockTimestamp: 60n,
    };
    let minute = phaseOneMinuteCandle(input)!;
    for (let index = 1; index < 50000; index++)
      minute = mergeMinuteCandle(
        minute,
        phaseOneMinuteCandle({ ...input, finalTick: index === 49999 ? 60 : 0 })!
      );
    expect(minute.swapCount).toBe(50000);
    expect(minute.volume0).toBe(5000000n);
    expect(minute.closeSqrtPriceX96).not.toBe(minute.openSqrtPriceX96);
    expect(phaseOneMinuteCandle({ ...input, flags: 5 })).toBeNull();
  });

  it("builds canonical Phase 1 candles from external MarketTape swaps", () => {
    const candles = aggregatePhaseOneSwapCandles(
      [
        {
          finalTick: 0,
          amount0: -100n,
          amount1: 99n,
          flags: 1,
          blockNumber: 10n,
          blockTimestamp: 60n,
        },
        {
          finalTick: 60,
          amount0: 90n,
          amount1: -100n,
          flags: 0,
          blockNumber: 11n,
          blockTimestamp: 90n,
        },
      ],
      1
    );
    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({
      volume0: 190n,
      volume1: 199n,
      zeroForOneCount: 1,
      oneForZeroCount: 1,
      swapCount: 2,
      firstBlock: 10n,
      lastBlock: 11n,
    });
    expect(candles[0]!.openSqrtPriceX96).not.toBe(candles[0]!.closeSqrtPriceX96);
  });
});
