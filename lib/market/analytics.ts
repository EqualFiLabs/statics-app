import type { Address } from "viem";

export const WAD = 10n ** 18n;
export const Q192 = 1n << 192n;
export const TOTAL_STATICS_SUPPLY = 1_000_000_000n * WAD;
export const PUBLIC_DISTRIBUTION_BASE = 800_000_000n * WAD;

export type CanonicalPrices = Readonly<{
  staticsPerWethWad: bigint;
  wethPerStaticsWad: bigint;
}>;

export function canonicalPrices(
  sqrtPriceX96: bigint,
  currency0: Address,
  statics: Address
): CanonicalPrices {
  if (sqrtPriceX96 <= 0n) throw new Error("Canonical pool price must be positive.");
  const currency1PerCurrency0Wad = (sqrtPriceX96 * sqrtPriceX96 * WAD) / Q192;
  if (currency1PerCurrency0Wad === 0n) throw new Error("Canonical pool price underflowed.");
  const staticsIsCurrency0 = currency0.toLowerCase() === statics.toLowerCase();
  const staticsPerWethWad = staticsIsCurrency0
    ? (WAD * WAD) / currency1PerCurrency0Wad
    : currency1PerCurrency0Wad;
  return {
    staticsPerWethWad,
    wethPerStaticsWad: (WAD * WAD) / staticsPerWethWad,
  };
}

export function usdValueWad(amount: bigint, tokenUsdWad: bigint): bigint {
  return (amount * tokenUsdWad) / WAD;
}

export function decimalToWad(value: string): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Decimal value is invalid.");
  const [whole, fraction = ""] = value.split(".");
  const padded = `${fraction}000000000000000000`.slice(0, 18);
  return BigInt(whole!) * WAD + BigInt(padded);
}

export function staticsUsdPriceWad(wethPerStaticsWad: bigint, ethUsdWad: bigint): bigint {
  return (wethPerStaticsWad * ethUsdWad) / WAD;
}

export function publicDistributedSupply(poolStatics: bigint): bigint {
  return poolStatics >= PUBLIC_DISTRIBUTION_BASE ? 0n : PUBLIC_DISTRIBUTION_BASE - poolStatics;
}

export function strictLiquidFloat(
  totalSupply: bigint,
  poolStatics: bigint,
  unreleasedTreasury: bigint,
  vaultBacking: bigint
): bigint {
  const locked = poolStatics + unreleasedTreasury + vaultBacking;
  return locked >= totalSupply ? 0n : totalSupply - locked;
}

export function feeAdjustedImpactBps(
  amountIn: bigint,
  amountOut: bigint,
  outputPerInputWad: bigint,
  fee: number
): number {
  if (amountIn <= 0n || outputPerInputWad <= 0n || fee < 0 || fee >= 1_000_000) return 10_000;
  const expectedBeforeFee = (amountIn * outputPerInputWad) / WAD;
  const expectedAfterFee = (expectedBeforeFee * BigInt(1_000_000 - fee)) / 1_000_000n;
  if (expectedAfterFee <= 0n || amountOut >= expectedAfterFee) return 0;
  return Number(((expectedAfterFee - amountOut) * 10_000n) / expectedAfterFee);
}

export function priceChangeBps(
  openWethPerStaticsWad: bigint,
  closeWethPerStaticsWad: bigint
): number {
  if (openWethPerStaticsWad <= 0n) return 0;
  return Number(
    ((closeWethPerStaticsWad - openWethPerStaticsWad) * 10_000n) / openWethPerStaticsWad
  );
}
