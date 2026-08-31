import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  PUBLIC_DISTRIBUTION_BASE,
  TOTAL_STATICS_SUPPLY,
  WAD,
  canonicalPrices,
  feeAdjustedImpactBps,
  priceChangeBps,
  publicDistributedSupply,
  strictLiquidFloat,
} from "@/lib/market/analytics";

const statics = getAddress("0x2222222222222222222222222222222222222222");
const weth = getAddress("0x1111111111111111111111111111111111111111");

describe("market analytics", () => {
  it("normalizes either pool currency ordering", () => {
    expect(canonicalPrices(1n << 96n, weth, statics)).toEqual({
      staticsPerWethWad: WAD,
      wethPerStaticsWad: WAD,
    });
    expect(canonicalPrices(1n << 96n, statics, statics)).toEqual({
      staticsPerWethWad: WAD,
      wethPerStaticsWad: WAD,
    });
  });

  it("keeps distributed and strict liquid supply definitions distinct", () => {
    expect(publicDistributedSupply(300_000_000n * WAD)).toBe(500_000_000n * WAD);
    expect(
      strictLiquidFloat(
        TOTAL_STATICS_SUPPLY,
        300_000_000n * WAD,
        100_100_000n * WAD,
        99_900_000n * WAD
      )
    ).toBe(500_000_000n * WAD);
    expect(publicDistributedSupply(PUBLIC_DISTRIBUTION_BASE + 1n)).toBe(0n);
  });

  it("excludes the fixed pool fee from price impact", () => {
    const input = 100n * WAD;
    const outputAfterFee = (input * 985_000n) / 1_000_000n;
    expect(feeAdjustedImpactBps(input, outputAfterFee, WAD, 15_000)).toBe(0);
    expect(feeAdjustedImpactBps(input, (outputAfterFee * 99n) / 100n, WAD, 15_000)).toBe(100);
  });

  it("reports signed price changes", () => {
    expect(priceChangeBps(WAD, (WAD * 11n) / 10n)).toBe(1_000);
    expect(priceChangeBps(WAD, (WAD * 9n) / 10n)).toBe(-1_000);
  });
});
