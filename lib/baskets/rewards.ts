/**
 * Basket rewards: what a deposited basket has earned, in its underlying assets.
 *
 * This is the reason to hold a basket rather than the assets themselves.
 * Canonical swap fees route five ways, and 20% of them goes to deposited
 * BasketTokens, paid in both the BasketToken and its constituents. So a
 * deposited basket accumulates more of exactly what it represents.
 *
 * Two things shape this module:
 *
 *   - BasketTokens sitting in a wallet earn nothing. Rewards accrue against a
 *     PositionNFT, so a balance only earns once deposited. Shares locked as
 *     loan collateral keep earning.
 *   - `getBasketRewards` and `claimBasketRewards` are both per (position,
 *     basket) pair. Claiming everything is therefore N calls for N baskets,
 *     not one, which is why the aggregate below keeps each pair addressable
 *     rather than only summing.
 */

import { getAddress, type Address, type PublicClient } from "viem";

import { staticsAbi } from "@statics-protocol/sdk";

import { loadTokenMetadata, type TokenMetadata } from "@/lib/baskets/baskets";
import type { DollarDeployment } from "@/lib/dollar/deployment";
import type { PositionRecord } from "@/lib/positions/positions";

export type BasketRewardAmount = Readonly<{
  token: TokenMetadata;
  amount: bigint;
}>;

/** Claimable rewards for one (position, basket) pair -- one claim call. */
export type BasketRewardEntry = Readonly<{
  positionId: bigint;
  basketId: bigint;
  basketName: string;
  basketSymbol: string;
  depositedShares: bigint;
  amounts: readonly BasketRewardAmount[];
  /** True when at least one asset has a nonzero amount. */
  claimable: boolean;
}>;

export type BasketRewardSummary = Readonly<{
  entries: readonly BasketRewardEntry[];
  /** Entries with something to claim, which is what a claim-all would send. */
  claimableEntries: readonly BasketRewardEntry[];
  /** Total deposited shares across every basket, for "you have N earning". */
  depositedBaskets: number;
}>;

/**
 * Reads claimable rewards for a single deposited basket.
 *
 * Returns every reward asset the basket routes, including zero amounts, so the
 * UI can name what a basket earns before it has earned any of it.
 */
export async function loadBasketRewardEntry(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  position: PositionRecord,
  collateralIndex: number
): Promise<BasketRewardEntry> {
  const collateral = position.collateral[collateralIndex];
  const [assets, amounts] = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "getBasketRewards",
    args: [position.positionId, collateral.basket.basketId],
  });

  if (assets.length !== amounts.length) {
    throw new Error("The basket reward read returned mismatched assets and amounts.");
  }

  const tokens = await Promise.all(
    assets.map((asset) => loadTokenMetadata(publicClient, getAddress(asset)))
  );

  const rewardAmounts = tokens.map((token, index) => ({
    token,
    amount: amounts[index] ?? 0n,
  }));

  return {
    positionId: position.positionId,
    basketId: collateral.basket.basketId,
    basketName: collateral.basket.name,
    basketSymbol: collateral.basket.symbol,
    depositedShares: collateral.depositedShares,
    amounts: rewardAmounts,
    claimable: rewardAmounts.some((entry) => entry.amount > 0n),
  };
}

/**
 * Reads every deposited basket across every position the wallet owns.
 *
 * Reads run in parallel because a wallet may hold several positions, each with
 * several deposited baskets, and this feeds the overview.
 */
export async function loadBasketRewardSummary(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  positions: readonly PositionRecord[]
): Promise<BasketRewardSummary> {
  const pairs = positions.flatMap((position) =>
    position.collateral.map((_, index) => ({ position, index }))
  );

  const entries = await Promise.all(
    pairs.map(({ position, index }) =>
      loadBasketRewardEntry(publicClient, deployment, position, index)
    )
  );

  return {
    entries,
    claimableEntries: entries.filter((entry) => entry.claimable),
    depositedBaskets: entries.length,
  };
}

/** Sums one asset across entries, for a headline figure per reward asset. */
export function totalRewardsByAsset(
  entries: readonly BasketRewardEntry[]
): readonly BasketRewardAmount[] {
  const totals = new Map<Address, BasketRewardAmount>();

  for (const entry of entries) {
    for (const { token, amount } of entry.amounts) {
      const existing = totals.get(token.address);
      totals.set(
        token.address,
        existing ? { token, amount: existing.amount + amount } : { token, amount }
      );
    }
  }

  return [...totals.values()].filter((entry) => entry.amount > 0n);
}
