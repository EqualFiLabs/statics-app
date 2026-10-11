import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import { v4PoolId, type V4PoolKey } from "@statics-protocol/sdk/phase-one";

import {
  gaugeScheduleFreshness,
  requireCanonicalPublicPoolKey,
  samePoolKey,
} from "@/lib/phase-one/pools";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);

const poolKey: V4PoolKey = {
  currency0: address("1"),
  currency1: address("2"),
  fee: 3_000,
  tickSpacing: 60,
  hooks: address("3"),
};

describe("Phase 1 public pools", () => {
  it("derives the PoolId only for canonical keys using the reviewed hook", () => {
    expect(requireCanonicalPublicPoolKey(poolKey, poolKey.hooks)).toBe(v4PoolId(poolKey));
    expect(samePoolKey(poolKey, { ...poolKey })).toBe(true);
    expect(() =>
      requireCanonicalPublicPoolKey(
        { ...poolKey, currency0: poolKey.currency1, currency1: poolKey.currency0 },
        poolKey.hooks
      )
    ).toThrow("canonical address order");
    expect(() => requireCanonicalPublicPoolKey(poolKey, address("4"))).toThrow(
      "reviewed Statics hook"
    );
    expect(() =>
      requireCanonicalPublicPoolKey({ ...poolKey, fee: 1_000_000 }, poolKey.hooks)
    ).toThrow("supported static");
  });

  it("reports bounded permissionless gauge catch-up without treating it as swap state", () => {
    expect(
      gaugeScheduleFreshness(
        { activated: true, periodFinish: 1_000, lastCheckpoint: 900 },
        1_000 + 53 * 7 * 24 * 60 * 60,
        52
      )
    ).toEqual({
      activated: true,
      stale: true,
      periodFinish: 1_000,
      lastCheckpoint: 900,
      periodsBehind: 54,
      maximumPeriodsPerCall: 52,
      catchupCallsRequired: 2,
    });
    expect(
      gaugeScheduleFreshness({ activated: false, periodFinish: 0, lastCheckpoint: 0 }, 999_999, 52)
        .stale
    ).toBe(false);
  });
});
