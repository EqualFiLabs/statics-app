/**
 * Staking eligibility: which part of a stake is earning, and when the rest will.
 *
 * The protocol used to lock stake for 24 hours after any interaction. It no
 * longer does: stake is always withdrawable, and the delay now decides when new
 * stake starts *earning*. That inverts the story from a penalty into a warm-up,
 * and this module exists to let the UI tell it that way.
 *
 * Consequences that shape everything here:
 *
 *   - A stake splits into eligible (earning) and pending (not yet). Showing only
 *     the total hides why rewards look wrong; showing only the eligible part
 *     reads as if funds went missing.
 *   - Maturity is per reward asset, so opting into assets at different times
 *     produces several different `eligibleAt` values for one position.
 *   - `eligibleAt` is the next hourly boundary at least 24 hours out, so the
 *     real wait is 24-25 hours. Always render the timestamp; never say "24
 *     hours", which is wrong by up to an hour.
 *   - Withdrawals consume pending stake before eligible stake, so changing your
 *     mind shortly after staking costs nothing that was already earning.
 */

import { getAddress, type Address, type PublicClient } from "viem";

import { staticsAbi } from "@statics-protocol/sdk";

import type { TokenMetadata } from "@/lib/baskets/baskets";
import type { DollarDeployment } from "@/lib/dollar/deployment";

export type RewardSelection = Readonly<{
  token: TokenMetadata;
  selected: boolean;
  /** Stake already earning this asset. */
  eligibleStake: bigint;
  /** Stake waiting to start earning this asset. */
  pendingStake: bigint;
  /** When the pending stake starts earning. Zero when nothing is pending. */
  eligibleAt: bigint;
}>;

export type StakingSnapshot = Readonly<{
  /** Everything staked, whether earning or not. Always withdrawable. */
  stakedBalance: bigint;
  selections: readonly RewardSelection[];
  /** Selections already earning. */
  earning: readonly RewardSelection[];
  /** Selections with stake still maturing. */
  maturing: readonly RewardSelection[];
}>;

/** Reward assets whose pending stake matures at the same moment. */
export type MaturityGroup = Readonly<{
  eligibleAt: bigint;
  tokens: readonly TokenMetadata[];
  pendingStake: bigint;
}>;

export async function loadStakingSnapshot(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address,
  positionId: bigint,
  rewardAssets: readonly { token: TokenMetadata }[]
): Promise<StakingSnapshot> {
  const [stake, selections] = await Promise.all([
    publicClient.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "stakePosition",
      args: [positionId],
    }),
    Promise.all(
      rewardAssets.map(async ({ token }) => {
        const selection = await publicClient.readContract({
          account: wallet,
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "rewardSelection",
          args: [positionId, getAddress(token.address)],
        });
        return {
          token,
          selected: selection.selected,
          eligibleStake: selection.eligibleStake,
          pendingStake: selection.pendingStake,
          eligibleAt: BigInt(selection.eligibleAt),
        } satisfies RewardSelection;
      })
    ),
  ]);

  const selected = selections.filter((entry) => entry.selected);

  return {
    stakedBalance: stake.stakedBalance,
    selections,
    earning: selected.filter((entry) => entry.eligibleStake > 0n),
    maturing: selected.filter((entry) => entry.pendingStake > 0n),
  };
}

/**
 * Groups maturing selections by the moment they start earning.
 *
 * Someone who opts into assets over time accumulates several distinct
 * `eligibleAt` values. Listing one row per asset turns that into a wall of
 * near-identical timestamps, so the UI shows one line per moment instead.
 */
export function groupByMaturity(selections: readonly RewardSelection[]): readonly MaturityGroup[] {
  const groups = new Map<bigint, { tokens: TokenMetadata[]; pendingStake: bigint }>();

  for (const entry of selections) {
    if (entry.pendingStake <= 0n) continue;
    const group = groups.get(entry.eligibleAt);
    if (group) {
      group.tokens.push(entry.token);
      // Pending stake is per asset, so the same stake appears against each
      // asset maturing at this moment. The larger figure is the stake itself,
      // not a sum of them.
      group.pendingStake =
        entry.pendingStake > group.pendingStake ? entry.pendingStake : group.pendingStake;
    } else {
      groups.set(entry.eligibleAt, { tokens: [entry.token], pendingStake: entry.pendingStake });
    }
  }

  return [...groups.entries()]
    .map(([eligibleAt, group]) => ({ eligibleAt, ...group }))
    .sort((left, right) => (left.eligibleAt < right.eligibleAt ? -1 : 1));
}

/**
 * Renders a maturity moment as a time a person can act on.
 *
 * Same day gets a clock time; anything further gets a date, because "3:00 PM"
 * is misleading when it is tomorrow.
 */
export function formatMaturity(eligibleAt: bigint, now: bigint): string {
  const date = new Date(Number(eligibleAt) * 1_000);
  const sameDay = new Date(Number(now) * 1_000).toDateString() === date.toDateString();
  return new Intl.DateTimeFormat("en", {
    timeStyle: "short",
    ...(sameDay ? {} : { dateStyle: "medium" }),
  }).format(date);
}

/**
 * Orders reward assets so a short list is worth showing.
 *
 * A deployment can offer up to 64 reward assets. Presenting all of them as
 * equal checkboxes is the fastest way to stall someone who just wants to earn
 * more bitcoin, so the picker shows a few and hides the rest -- which is only
 * defensible if the few are chosen for a reason.
 *
 * The reason is the candidate's own provenance, which the catalog already
 * records:
 *
 *   1. "Fee history" -- this asset has actually paid rewards before. The
 *      strongest available evidence that selecting it will earn anything.
 *   2. "Statics deployment" -- the Dollar and WETH, which the protocol itself
 *      routes fees through.
 *   3. everything else, alphabetically, as the catalog already sorts it.
 *
 * No volume or liquidity signal is available client-side, so this deliberately
 * ranks on evidence rather than inventing a popularity order.
 */
export function rankRewardCandidates<T extends { sources: readonly string[] }>(
  candidates: readonly T[]
): readonly T[] {
  const rank = (candidate: T): number => {
    if (candidate.sources.some((source) => source === "Fee history")) return 0;
    if (candidate.sources.some((source) => source === "Statics deployment")) return 1;
    return 2;
  };
  // Stable sort keeps the catalog's alphabetical order inside each tier.
  return [...candidates].sort((left, right) => rank(left) - rank(right));
}

/** How many reward assets the picker shows before collapsing the rest. */
export const VISIBLE_REWARD_CANDIDATES = 6;
