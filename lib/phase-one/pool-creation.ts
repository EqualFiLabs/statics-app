import { getAddress, zeroAddress, type Address, type Hex } from "viem";
import { v4PoolId, type V4PoolKey } from "@statics-protocol/sdk/phase-one";

/**
 * Pure rules for creating a Statics public pool, mirroring `ProtocolPoolCreationFacet`:
 * LP fees and Statics hook fees are pips (millionths), tick spacing is 1–32,767, and a creator's
 * Statics fee is at least 10 pips per side and at most 20,000 pips combined.
 */
export const MAX_LP_FEE_PIPS = 999_999;
export const MIN_TICK_SPACING = 1;
export const MAX_TICK_SPACING = 32_767;
export const MIN_CREATOR_FEE_PIPS = 10;
export const MAX_COMBINED_FEE_PIPS = 20_000;

export type FeeTier = Readonly<{ lpFee: number; tickSpacing: number }>;

/** The tiers offered by default; anything else is an Advanced custom tier. */
export const FEE_TIERS: readonly FeeTier[] = [
  { lpFee: 500, tickSpacing: 10 },
  { lpFee: 3_000, tickSpacing: 60 },
  { lpFee: 10_000, tickSpacing: 200 },
];

/** A conventional tick spacing for a custom LP fee: finer prices for cheaper pools. */
export function tickSpacingForFee(lpFee: number): number {
  if (lpFee <= 100) return 1;
  if (lpFee <= 500) return 10;
  if (lpFee <= 3_000) return 60;
  return 200;
}

/** Percent text (up to 4 decimals) to pips, or null when it is not a valid pip amount. */
export function percentToPips(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{0,4})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const pips = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  return Number.isSafeInteger(pips) ? pips : null;
}

export function pipsToPercent(pips: number): string {
  return (pips / 10_000).toFixed(4).replace(/\.?0+$/, "");
}

export type FeeProblem = "lp-fee" | "tick-spacing" | "statics-fee-minimum" | "statics-fee-maximum";

export function validateTier(tier: FeeTier): FeeProblem | null {
  if (!Number.isInteger(tier.lpFee) || tier.lpFee < 0 || tier.lpFee > MAX_LP_FEE_PIPS)
    return "lp-fee";
  if (
    !Number.isInteger(tier.tickSpacing) ||
    tier.tickSpacing < MIN_TICK_SPACING ||
    tier.tickSpacing > MAX_TICK_SPACING
  )
    return "tick-spacing";
  return null;
}

export function validateStaticsFee(inputPips: number, outputPips: number): FeeProblem | null {
  if (
    !Number.isInteger(inputPips) ||
    !Number.isInteger(outputPips) ||
    inputPips < MIN_CREATOR_FEE_PIPS ||
    outputPips < MIN_CREATOR_FEE_PIPS
  )
    return "statics-fee-minimum";
  if (inputPips + outputPips > MAX_COMBINED_FEE_PIPS) return "statics-fee-maximum";
  return null;
}

/** The PoolKey a pair and tier would use with the Statics hook, currencies sorted. */
export function candidatePoolKey(
  tokenA: Address,
  tokenB: Address,
  tier: FeeTier,
  hook: Address
): V4PoolKey {
  const [currency0, currency1] =
    tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  return {
    currency0: getAddress(currency0),
    currency1: getAddress(currency1),
    fee: tier.lpFee,
    tickSpacing: tier.tickSpacing,
    hooks: getAddress(hook),
  };
}

export function candidatePoolId(
  tokenA: Address,
  tokenB: Address,
  tier: FeeTier,
  hook: Address
): Hex {
  return v4PoolId(candidatePoolKey(tokenA, tokenB, tier, hook));
}

function isqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("Square root of a negative number.");
  if (value < 2n) return value;
  let x = value;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (x + value / x) >> 1n;
  }
  return x;
}

const PRICE_SCALE = 36;

/**
 * `sqrtPriceBPerAX96` for `createPool`: the square root of raw token B per raw token A, as Q64.96.
 * `price` is human units, "1 A = price B". Returns null for an unreadable or non-positive price.
 */
export function startingSqrtPrice(
  price: string,
  decimalsA: number,
  decimalsB: number
): bigint | null {
  if (
    ![decimalsA, decimalsB].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  )
    return null;
  const trimmed = price.trim();
  if (trimmed.length > 256) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > PRICE_SCALE) return null;
  const scaled = BigInt(whole + fraction.padEnd(PRICE_SCALE, "0"));
  if (scaled === 0n) return null;
  // raw B per raw A = price × 10^decimalsB / 10^decimalsA, kept exact before the square root.
  const numerator = scaled * 10n ** BigInt(decimalsB) * (1n << 192n);
  const denominator = 10n ** BigInt(PRICE_SCALE + decimalsA);
  const sqrt = isqrt(numerator / denominator);
  return sqrt > 0n && sqrt < 1n << 160n ? sqrt : null;
}

export const NATIVE_CURRENCY = zeroAddress;
