import { maximumLiquidityForAmounts, quoteRangeAmounts } from "@statics-protocol/sdk/phase-one";

const MAX_AMOUNT = (1n << 256n) - 1n;

/** Derive the dependent token entirely from cached pool state, with integer rounding. */
export function pairedLiquidityAmounts(input: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  exactToken: 0 | 1;
  amount: bigint;
}): readonly [bigint, bigint] {
  if (input.amount <= 0n) return [0n, 0n];
  const maximums = [MAX_AMOUNT, MAX_AMOUNT];
  maximums[input.exactToken] = input.amount;
  const liquidity = maximumLiquidityForAmounts(
    input.sqrtPriceX96,
    input.tickLower,
    input.tickUpper,
    maximums[0],
    maximums[1]
  );
  if (liquidity === 0n) throw new Error("The amount is too small for this range.");
  const quote = quoteRangeAmounts(input.sqrtPriceX96, input.tickLower, input.tickUpper, liquidity);
  const amounts: [bigint, bigint] = [quote.amount0, quote.amount1];
  // An out-of-range position may only accept the other asset.
  if (amounts[input.exactToken] === 0n)
    throw new Error("This asset is not used by the selected range.");
  amounts[input.exactToken] = input.amount;
  return amounts;
}

export function priceFromSqrt(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  return (Number(sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** (decimals0 - decimals1);
}

/** Return a display-only range marker; transaction amounts never use floating point. */
export function rangeMarker(current: number, lower: number, upper: number) {
  if (!(current > 0 && lower > 0 && upper > lower)) return 50;
  return Math.max(0, Math.min(100, (Math.log(current / lower) / Math.log(upper / lower)) * 100));
}

/** Leave one base unit for rounding so the dependent amount fits both balances. */
export function maximumPairedInput(input: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  exactToken: 0 | 1;
  balance0: bigint;
  balance1: bigint;
}): bigint {
  if (input.balance0 === 0n && input.balance1 === 0n) return 0n;
  try {
    const liquidity = maximumLiquidityForAmounts(
      input.sqrtPriceX96,
      input.tickLower,
      input.tickUpper,
      input.balance0,
      input.balance1
    );
    if (liquidity === 0n) return 0n;
    const amounts = quoteRangeAmounts(
      input.sqrtPriceX96,
      input.tickLower,
      input.tickUpper,
      liquidity
    );
    const maximum = input.exactToken === 0 ? amounts.amount0 : amounts.amount1;
    return maximum > 0n ? maximum - 1n : 0n;
  } catch {
    // Invalid or unusable cached state cannot produce a spendable maximum.
    return 0n;
  }
}
