import { describe, expect, it } from "vitest";

import { calculateBasketLaunchQuote } from "@/lib/baskets/creation";

const unit = 10n ** 18n;

describe("basket launch quote", () => {
  it("derives pool, backing, fee, maximum, and shortfall amounts", () => {
    const quote = calculateBasketLaunchQuote(
      [
        {
          address: "0x0000000000000000000000000000000000000001",
          symbol: "TST",
          decimals: 18,
          bundleAmount: 2n * unit,
          assetPerBasket: 4n * unit,
          seedAssetAmount: 100n * unit,
          walletBalance: 1_000n * unit,
        },
      ],
      unit / 1_000n,
      50n
    );

    expect(quote).not.toBeNull();
    expect(quote!.basketShares).toBeGreaterThan(0n);
    expect(quote!.assets[0]!.poolAssetAmount).toBeLessThanOrEqual(100n * unit);
    expect(quote!.assets[0]!.requiredAmount).toBe(
      quote!.assets[0]!.poolAssetAmount +
        quote!.assets[0]!.backingAmount +
        quote!.assets[0]!.mintFeeAmount
    );
    expect(quote!.assets[0]!.maximumAmount).toBeGreaterThan(quote!.assets[0]!.requiredAmount);
    expect(quote!.assets[0]!.shortfall).toBe(0n);
  });

  it("rejects incomplete or non-positive launch inputs", () => {
    expect(calculateBasketLaunchQuote([], 0n, 50n)).toBeNull();
    expect(
      calculateBasketLaunchQuote(
        [
          {
            address: "0x0000000000000000000000000000000000000001",
            symbol: "TST",
            decimals: 18,
            bundleAmount: unit,
            assetPerBasket: unit,
            seedAssetAmount: 0n,
            walletBalance: 0n,
          },
        ],
        0n,
        50n
      )
    ).toBeNull();
  });
});
