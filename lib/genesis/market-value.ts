import type { Address } from "viem";

const Q192 = 1n << 192n;

/**
 * What a Operator NFT's STATICS backing is worth at the current market price,
 * denominated in the pool's numeraire (WETH), in wei.
 *
 * This is the figure the Overview was missing: a raw `WETH per STATICS` ratio
 * does not tell anyone whether the Vault's fixed 180,000 STATICS price is cheap.
 * Multiplying it out does.
 *
 * Kept in bigint end to end. Converting through a float first loses precision
 * exactly where it matters, because `sqrtPriceX96` squared is a 192-bit number
 * and the ratio it encodes is frequently far from 1.
 *
 * Returns null when the pool has no price yet, rather than a misleading zero.
 */
export function genesisBackingInNumeraire(
  sqrtPriceX96: bigint,
  currency0: Address,
  statics: Address,
  vaultPrice: bigint
): bigint | null {
  if (sqrtPriceX96 <= 0n || vaultPrice <= 0n) return null;

  const numerator = sqrtPriceX96 * sqrtPriceX96;
  const staticsIsCurrency0 = currency0.toLowerCase() === statics.toLowerCase();

  // sqrtPriceX96^2 / Q192 is token1 per token0. STATICS and the numeraire are
  // both 18-decimal, so the raw ratio is also the human one.
  return staticsIsCurrency0 ? (vaultPrice * numerator) / Q192 : (vaultPrice * Q192) / numerator;
}

/**
 * Total cost of acquiring one Genesis right now, in the numeraire: its STATICS
 * backing valued at market, plus the native ETH the Vault requires.
 *
 * `requiredNative` already folds the reserve buy-in together with the
 * acquisition fee, and is zero-buy-in during the Epoch, so this stays correct
 * across the Epoch boundary without branching on it.
 */
export function genesisAcquisitionCost(
  backingInNumeraire: bigint | null,
  requiredNative: bigint
): bigint | null {
  if (backingInNumeraire === null) return null;
  return backingInNumeraire + requiredNative;
}
