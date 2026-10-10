import type { Hex } from "viem";

/**
 * What still keeps an account open. `closePosition` requires no active legs and no unresolved
 * obligations. Legs stay attached while anything remains in them: staked STATICS, opted-in
 * reward assets or unclaimed staking rewards (staking leg), liquidity or unclaimed LP rewards
 * (liquidity legs), and allocations or unclaimed allocator rewards (allocator legs). Items are
 * listed in the order they can be cleared: allocations lock stake, and withdrawing or
 * unstaking can settle more rewards to collect.
 */
export type CloseItem =
  | Readonly<{ kind: "withdraw-liquidity"; poolId: Hex }>
  | Readonly<{ kind: "resolve-liquidity"; poolId: Hex }>
  | Readonly<{ kind: "remove-allocations"; amount: bigint }>
  | Readonly<{ kind: "unstake"; amount: bigint }>
  | Readonly<{ kind: "collect-rewards" }>
  | Readonly<{ kind: "stop-earning"; count: number }>
  | Readonly<{ kind: "obligations"; count: bigint }>
  | Readonly<{ kind: "other"; count: bigint }>;

export function closeChecklist(input: {
  activeLegCount: bigint;
  unresolvedObligationCount: bigint;
  stakedBalance: bigint;
  totalAllocated: bigint;
  selectedAssets: number;
  liquidityPools: readonly Hex[];
  unresolvedLiquidityPools?: readonly Hex[];
  rewardsClaimable: boolean;
  /** False while any of the reads above are still loading. */
  loaded: boolean;
}): Readonly<{ items: readonly CloseItem[]; ready: boolean }> {
  const items: CloseItem[] = input.liquidityPools.map((poolId) => ({
    kind: "withdraw-liquidity" as const,
    poolId,
  }));
  for (const poolId of input.unresolvedLiquidityPools ?? [])
    items.push({ kind: "resolve-liquidity", poolId });
  if (input.totalAllocated > 0n)
    items.push({ kind: "remove-allocations", amount: input.totalAllocated });
  if (input.stakedBalance > 0n) items.push({ kind: "unstake", amount: input.stakedBalance });
  if (input.rewardsClaimable) items.push({ kind: "collect-rewards" });
  if (input.selectedAssets > 0) items.push({ kind: "stop-earning", count: input.selectedAssets });
  if (input.unresolvedObligationCount > 0n)
    items.push({ kind: "obligations", count: input.unresolvedObligationCount });
  // Something else is attached (for example a linked Operator NFT, or reward dust the reads
  // above cannot see). The contract's own counts decide whether closing is allowed.
  const legItems = items.filter((item) => item.kind !== "obligations").length;
  if (input.loaded && input.activeLegCount > 0n && legItems === 0)
    items.push({ kind: "other", count: input.activeLegCount });
  return {
    items,
    ready: input.activeLegCount === 0n && input.unresolvedObligationCount === 0n,
  };
}
