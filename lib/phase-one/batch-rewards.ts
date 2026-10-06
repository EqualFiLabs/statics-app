import {
  splitBatchRewardClaims,
  type BatchRewardClaims,
  type BatchRewardClaimResult,
} from "@statics-protocol/sdk";
import type { Address, Hex } from "viem";
import type { PositionRewardPortfolio, RewardAmount } from "./reward-portfolio";

/** Select positive balances only; global claims retain the protocol's NoRewards behavior. */
export function planBatchRewardClaims(
  rows: readonly PositionRewardPortfolio[],
  receiver: Address,
  diamond: Address
): readonly BatchRewardClaims[] {
  if (
    rows.some(
      (row) =>
        row.globalUnavailable || row.discoveryUnavailable || row.pools.some((pool) => !pool.rewards)
    )
  )
    throw new Error("Load all position rewards before reviewing Claim all.");
  const globalClaims: BatchRewardClaims["globalClaims"][number][] = [];
  const lpClaims: BatchRewardClaims["lpClaims"][number][] = [];
  const allocatorClaims: BatchRewardClaims["allocatorClaims"][number][] = [];
  for (const row of rows) {
    const assets =
      row.global?.claimAssets.filter(
        (_, index) => (row.global?.pendingRewards[index] ?? 0n) > 0n
      ) ?? [];
    if (assets.length)
      globalClaims.push({
        positionId: row.positionId,
        assets,
        minimumAmounts: assets.map(() => 0n),
      });
    for (const pool of row.pools) {
      const rewards = pool.rewards!;
      const slots = Array.from({ length: rewards.lp.slotCount }, (_, slot) => slot).filter(
        (slot) => pool.hasLp && rewards.lp.amounts[slot] > 0n
      );
      if (slots.length)
        lpClaims.push({
          positionId: row.positionId,
          poolId: pool.poolId,
          slots,
          minimumAmounts: slots.map(() => 0n),
        });
      const allocatorSlots = pool.hasAllocator
        ? rewards.allocator.filter((reward) => reward.amount > 0n).map((reward) => reward.slot)
        : [];
      if (allocatorSlots.length)
        allocatorClaims.push({
          positionId: row.positionId,
          poolId: pool.poolId,
          slots: allocatorSlots,
          minimumAmounts: allocatorSlots.map(() => 0n),
        });
    }
  }
  if (!globalClaims.length && !lpClaims.length && !allocatorClaims.length) return [];
  return splitBatchRewardClaims({ globalClaims, lpClaims, allocatorClaims, receiver }, diamond);
}

/** Freeze the complete batch simulation as minimum payouts; signing cannot weaken the review. */
export function freezeBatchRewardClaims(
  batch: BatchRewardClaims,
  result: BatchRewardClaimResult
): BatchRewardClaims {
  function amounts(
    groups: readonly { minimumAmounts: readonly bigint[] }[],
    received: readonly (readonly bigint[])[]
  ) {
    if (
      received.length !== groups.length ||
      received.some(
        (values, index) =>
          values.length !== groups[index].minimumAmounts.length ||
          values.some((value) => value < 0n)
      )
    )
      throw new Error("Invalid batch reward preview.");
    return received.map((values) => [...values]);
  }
  const global = amounts(batch.globalClaims, result.globalReceived);
  const lp = amounts(batch.lpClaims, result.lpReceived);
  const allocator = amounts(batch.allocatorClaims, result.allocatorReceived);
  return {
    receiver: batch.receiver,
    globalClaims: batch.globalClaims.map((group, index) => ({
      ...group,
      assets: [...group.assets],
      minimumAmounts: global[index],
    })),
    lpClaims: batch.lpClaims.map((group, index) => ({
      ...group,
      slots: [...group.slots],
      minimumAmounts: lp[index],
    })),
    allocatorClaims: batch.allocatorClaims.map((group, index) => ({
      ...group,
      slots: [...group.slots],
      minimumAmounts: allocator[index],
    })),
  };
}

export function reviewedBatchRewardAmounts(
  batches: readonly BatchRewardClaims[],
  rows: readonly PositionRewardPortfolio[]
): readonly RewardAmount[] {
  const totals = new Map<string, RewardAmount>();
  const add = (asset: Address, amount: bigint) => {
    if (amount <= 0n) return;
    const key = asset.toLowerCase();
    totals.set(key, { asset, amount: (totals.get(key)?.amount ?? 0n) + amount });
  };
  for (const batch of batches) {
    for (const group of batch.globalClaims)
      group.assets.forEach((asset, index) => add(asset, group.minimumAmounts[index]));
    for (const [kind, groups] of [
      ["lp", batch.lpClaims],
      ["allocator", batch.allocatorClaims],
    ] as const) {
      for (const group of groups) {
        const pool = rows
          .find((row) => row.positionId === group.positionId)
          ?.pools.find((pool) => pool.poolId.toLowerCase() === group.poolId.toLowerCase());
        group.slots.forEach((slot, index) => {
          const asset =
            kind === "lp"
              ? pool?.rewards?.lp.assets[slot]
              : pool?.rewards?.allocator.find((reward) => reward.slot === slot)?.asset;
          if (!asset) throw new Error("Reward asset metadata changed. Review rewards again.");
          add(asset, group.minimumAmounts[index]);
        });
      }
    }
  }
  return [...totals.values()];
}

// send resolves only after a successful receipt. A failed batch stops the loop;
// confirmed transactions are never automatically submitted again.
export async function executeBatchRewardClaims(input: {
  batches: readonly BatchRewardClaims[];
  assertCurrent: () => void;
  send: (batch: BatchRewardClaims, index: number) => Promise<Hex>;
  onConfirmed: (hash: Hex, completed: number) => void;
}): Promise<void> {
  for (const [index, batch] of input.batches.entries()) {
    input.assertCurrent();
    const hash = await input.send(batch, index);
    input.onConfirmed(hash, index + 1);
  }
}
