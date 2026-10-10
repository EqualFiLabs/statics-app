import { describe, expect, it } from "vitest";
import {
  getSqrtPriceAtTick,
  maximumLiquidityForAmounts,
  quoteRangeAmounts,
} from "@statics-protocol/sdk/phase-one";
import {
  maximumPairedInput,
  pairedLiquidityAmounts,
  priceFromSqrt,
} from "@/lib/phase-one/liquidity-preview";

describe("local liquidity previews", () => {
  it("preserves the edited amount and computes the other token using the pool price", () => {
    const amounts = pairedLiquidityAmounts({
      sqrtPriceX96: getSqrtPriceAtTick(600),
      tickLower: -887220,
      tickUpper: 887220,
      exactToken: 0,
      amount: 10n ** 18n,
    });
    expect(amounts[0]).toBe(10n ** 18n);
    expect(amounts[1]).toBeGreaterThan(105n * 10n ** 16n);
    expect(amounts[1]).toBeLessThan(107n * 10n ** 16n);
    const liquidity = maximumLiquidityForAmounts(
      getSqrtPriceAtTick(600),
      -887220,
      887220,
      ...amounts
    );
    const quoted = quoteRangeAmounts(getSqrtPriceAtTick(600), -887220, 887220, liquidity);
    expect(quoted.amount0).toBeLessThanOrEqual(amounts[0]);
    expect(quoted.amount1).toBeLessThanOrEqual(amounts[1]);
  });
  it("uses raw integer amounts even when the token decimals differ", () => {
    const amounts = pairedLiquidityAmounts({
      sqrtPriceX96: 1n << 96n,
      tickLower: -887220,
      tickUpper: 887220,
      exactToken: 1,
      amount: 1234567n,
    });
    expect(amounts).toEqual([1234567n, 1234567n]);
    expect(priceFromSqrt(1n << 96n, 18, 6)).toBe(10 ** 12);
  });
  it("supports single-sided deposits and rejects editing an unused asset", () => {
    expect(
      pairedLiquidityAmounts({
        sqrtPriceX96: 1n << 96n,
        tickLower: 60,
        tickUpper: 120,
        exactToken: 0,
        amount: 10n ** 18n,
      })
    ).toEqual([10n ** 18n, 0n]);
    expect(
      pairedLiquidityAmounts({
        sqrtPriceX96: 1n << 96n,
        tickLower: -120,
        tickUpper: -60,
        exactToken: 1,
        amount: 10n ** 18n,
      })
    ).toEqual([0n, 10n ** 18n]);
    expect(() =>
      pairedLiquidityAmounts({
        sqrtPriceX96: 1n << 96n,
        tickLower: 60,
        tickUpper: 120,
        exactToken: 1,
        amount: 10n ** 18n,
      })
    ).toThrow("not used");
  });
  it("does not quote empty amounts and clamps display-only range markers", () => {
    expect(
      pairedLiquidityAmounts({
        sqrtPriceX96: 1n << 96n,
        tickLower: -60,
        tickUpper: 60,
        exactToken: 0,
        amount: 0n,
      })
    ).toEqual([0n, 0n]);
  });
  it("limits Max by both balances when the other token is scarce", () => {
    const settings = {
      sqrtPriceX96: getSqrtPriceAtTick(599),
      tickLower: -887220,
      tickUpper: 887220,
      exactToken: 0 as const,
    };
    const maximum = maximumPairedInput({ ...settings, balance0: 10n ** 24n, balance1: 10n ** 18n });
    const amounts = pairedLiquidityAmounts({ ...settings, amount: maximum });
    expect(amounts[0]).toBeLessThan(10n ** 18n);
    expect(amounts[1]).toBeLessThanOrEqual(10n ** 18n);
  });
});

it("returns zero Max for empty balances and invalid cached ranges", () => {
  const settings = {
    sqrtPriceX96: 1n << 96n,
    tickLower: -60,
    tickUpper: 60,
    exactToken: 0 as const,
  };
  expect(maximumPairedInput({ ...settings, balance0: 0n, balance1: 0n })).toBe(0n);
  expect(maximumPairedInput({ ...settings, tickLower: 120, balance0: 100n, balance1: 100n })).toBe(
    0n
  );
});
