import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import { v4PoolId } from "@statics-protocol/sdk/phase-one";
import {
  candidatePoolId,
  candidatePoolKey,
  percentToPips,
  pipsToPercent,
  startingSqrtPrice,
  tickSpacingForFee,
  validateStaticsFee,
  validateTier,
} from "@/lib/phase-one/pool-creation";

const a = getAddress(`0x${"b".repeat(40)}`);
const b = getAddress(`0x${"2".repeat(40)}`);
const hook = getAddress(`0x${"9".repeat(40)}`);

describe("pool creation rules", () => {
  it("converts percent text to pips and back", () => {
    expect(percentToPips("0.3")).toBe(3_000);
    expect(percentToPips("0.05")).toBe(500);
    expect(percentToPips("0.001")).toBe(10);
    expect(percentToPips("1")).toBe(10_000);
    expect(percentToPips("0.00001")).toBeNull();
    expect(percentToPips("-1")).toBeNull();
    expect(percentToPips("abc")).toBeNull();
    expect(pipsToPercent(500)).toBe("0.05");
    expect(pipsToPercent(10_000)).toBe("1");
  });

  it("validates tiers and Statics fees as the contract does", () => {
    expect(validateTier({ lpFee: 3_000, tickSpacing: 60 })).toBeNull();
    expect(validateTier({ lpFee: 1_000_000, tickSpacing: 60 })).toBe("lp-fee");
    expect(validateTier({ lpFee: 3_000, tickSpacing: 0 })).toBe("tick-spacing");
    expect(validateTier({ lpFee: 3_000, tickSpacing: 32_768 })).toBe("tick-spacing");
    expect(validateStaticsFee(500, 500)).toBeNull();
    expect(validateStaticsFee(10, 10)).toBeNull();
    expect(validateStaticsFee(9, 500)).toBe("statics-fee-minimum");
    expect(validateStaticsFee(10_000, 10_000)).toBeNull();
    expect(validateStaticsFee(10_000, 10_001)).toBe("statics-fee-maximum");
  });

  it("picks conventional tick spacings for custom fees", () => {
    expect(tickSpacingForFee(100)).toBe(1);
    expect(tickSpacingForFee(500)).toBe(10);
    expect(tickSpacingForFee(2_500)).toBe(60);
    expect(tickSpacingForFee(9_000)).toBe(200);
  });

  it("sorts currencies into the Statics PoolKey regardless of selection order", () => {
    const key = candidatePoolKey(a, b, { lpFee: 3_000, tickSpacing: 60 }, hook);
    expect(key).toEqual({ currency0: b, currency1: a, fee: 3_000, tickSpacing: 60, hooks: hook });
    expect(candidatePoolId(a, b, { lpFee: 3_000, tickSpacing: 60 }, hook)).toBe(v4PoolId(key));
    expect(candidatePoolId(b, a, { lpFee: 3_000, tickSpacing: 60 }, hook)).toBe(v4PoolId(key));
  });

  it("encodes the starting price as sqrt(raw B per raw A) in Q64.96", () => {
    const Q96 = 1n << 96n;
    // Same decimals, price 1: sqrt(1) × 2^96.
    expect(startingSqrtPrice("1", 18, 18)).toBe(Q96);
    // Price 4: sqrt(4) × 2^96.
    expect(startingSqrtPrice("4", 18, 18)).toBe(2n * Q96);
    // 1 WETH (18) = 2,500 USDG (6): raw ratio 2,500 × 10^-12.
    const sqrt = startingSqrtPrice("2500", 18, 6)!;
    const price = (Number(sqrt) / 2 ** 96) ** 2 * 10 ** (18 - 6);
    expect(price).toBeCloseTo(2_500, 6);
    expect(startingSqrtPrice("0", 18, 18)).toBeNull();
    expect(startingSqrtPrice("1e3", 18, 18)).toBeNull();
    expect(startingSqrtPrice("", 18, 18)).toBeNull();
    expect(startingSqrtPrice("1", -1, 18)).toBeNull();
    expect(startingSqrtPrice("1", 18, 256)).toBeNull();
    expect(startingSqrtPrice("1" + "0".repeat(257), 18, 18)).toBeNull();
    expect(startingSqrtPrice("1", 0, 255)).toBeNull();
  });
});
