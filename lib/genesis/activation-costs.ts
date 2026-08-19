export function oneIndexedGenesisTierCosts(tierCosts: readonly bigint[]): readonly bigint[] {
  if (tierCosts.length !== 4) {
    throw new Error("Genesis activation requires exactly four tier costs.");
  }
  return [0n, ...tierCosts];
}
