import { cumulativeGenesisActivationCost } from "@statics-protocol/sdk";

export function oneIndexedGenesisTierCosts(tierCosts: readonly bigint[]): readonly bigint[] {
  if (tierCosts.length !== 4) {
    throw new Error("Genesis activation requires exactly four tier costs.");
  }
  return [0n, ...tierCosts];
}

/** A Tier 4 Genesis is already fully activated and has no next payment. */
export function genesisActivationCost(
  tierCosts: readonly bigint[],
  currentTier: number,
  targetTier: number
): bigint {
  if (currentTier >= 4) return 0n;
  return cumulativeGenesisActivationCost(tierCosts, currentTier, targetTier);
}
