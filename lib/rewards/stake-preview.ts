import type { Address } from "viem";
import type { EarnPositionRow } from "./position-table";

export type RewardEarningWindow = Readonly<{
  asset: Address;
  earliest: bigint;
  latest: bigint;
  pendingStake: bigint;
}>;

export type StakePreview =
  | Readonly<{
      kind: "stake";
      positionId: bigint;
      total: bigint;
      assetCount: number;
      earning: readonly RewardEarningWindow[];
      cooldownUntil: bigint | null;
    }>
  | Readonly<{
      kind: "create";
      assetCount: number;
      earningFrom: bigint;
      cooldownUntil: bigint | null;
    }>
  | Readonly<{
      kind: "unstake";
      positionId: bigint;
      available: bigint;
      locked: bigint;
      exceedsAvailable: boolean;
      /** How much more stake must be freed from allocations for this amount. */
      shortfall: bigint;
      assets: readonly Readonly<{ asset: Address; fromMaturing: bigint; fromEarning: bigint }>[];
      remaining: bigint;
    }>;

export type StakeRules = Readonly<{
  now: bigint;
  eligibilityDelay: bigint;
  eligibilityBucketSize: bigint;
  allocationCooldown: bigint;
}>;

export function unstakeAvailable(row: EarnPositionRow): bigint {
  const locked = row.allocation?.lockedStake ?? 0n;
  return row.stakedBalance > locked ? row.stakedBalance - locked : 0n;
}

export function roundedEligibility(start: bigint, rules: StakeRules): bigint {
  if (rules.eligibilityBucketSize <= 0n) throw new Error("Invalid reward eligibility bucket.");
  const raw = start + rules.eligibilityDelay;
  return (
    ((raw + rules.eligibilityBucketSize - 1n) / rules.eligibilityBucketSize) *
    rules.eligibilityBucketSize
  );
}

function cooldownAfterStake(current: bigint, rules: StakeRules): bigint | null {
  const extended = rules.now + rules.allocationCooldown;
  const deadline = current > extended ? current : extended;
  return deadline > rules.now ? deadline : null;
}

/**
 * Apply the contract's capped, weighted age credit to the stored pending start.
 * Older deployments expose only rounded eligibleAt; retain an honest interval for those.
 */
export function earningWindow(
  selection: NonNullable<EarnPositionRow["rewardSelections"]>[number],
  amount: bigint,
  rules: StakeRules
): RewardEarningWindow {
  const pending = selection.eligibleAt > rules.now ? selection.pendingStake : 0n;
  if (pending === 0n) {
    const at = roundedEligibility(rules.now, rules);
    return { asset: selection.asset, earliest: at, latest: at, pendingStake: 0n };
  }
  if (selection.pendingStartTime !== undefined) {
    const age =
      rules.now > selection.pendingStartTime ? rules.now - selection.pendingStartTime : 0n;
    const credit = age > rules.eligibilityDelay ? rules.eligibilityDelay : age;
    const at = roundedEligibility(rules.now - (pending * credit) / (pending + amount), rules);
    return { asset: selection.asset, earliest: at, latest: at, pendingStake: pending };
  }
  const upper = selection.eligibleAt - rules.eligibilityDelay;
  const lower = upper - rules.eligibilityBucketSize + 1n;
  const maxStart = upper < rules.now ? upper : rules.now;
  const minStart = lower > 0n ? lower : 0n;
  const credit = (start: bigint) => {
    const age = rules.now > start ? rules.now - start : 0n;
    return age > rules.eligibilityDelay ? rules.eligibilityDelay : age;
  };
  const at = (age: bigint) =>
    roundedEligibility(rules.now - (pending * age) / (pending + amount), rules);
  return {
    asset: selection.asset,
    earliest: at(credit(minStart)),
    latest: at(credit(maxStart)),
    pendingStake: pending,
  };
}

export function previewStake(
  input: Readonly<{ amount: bigint; target: EarnPositionRow | null; newAssetCount: number }>,
  rules: StakeRules
): StakePreview {
  if (!input.target)
    return {
      kind: "create",
      assetCount: input.newAssetCount,
      earningFrom: roundedEligibility(rules.now, rules),
      cooldownUntil: cooldownAfterStake(0n, rules),
    };
  return {
    kind: "stake",
    positionId: input.target.positionId,
    total: input.target.stakedBalance + input.amount,
    assetCount: input.target.selectedAssets?.length ?? 0,
    earning: (input.target.rewardSelections ?? []).map((selection) =>
      earningWindow(selection, input.amount, rules)
    ),
    cooldownUntil: cooldownAfterStake(input.target.allocation?.nextAllocationAt ?? 0n, rules),
  };
}

export function previewUnstake(
  input: Readonly<{ amount: bigint; target: EarnPositionRow }>
): StakePreview {
  const available = unstakeAvailable(input.target);
  return {
    kind: "unstake",
    positionId: input.target.positionId,
    available,
    locked: input.target.allocation?.lockedStake ?? 0n,
    exceedsAvailable: input.amount > available,
    shortfall: input.amount > available ? input.amount - available : 0n,
    assets: (input.target.rewardSelections ?? []).map((selection) => {
      const fromMaturing =
        input.amount < selection.pendingStake ? input.amount : selection.pendingStake;
      return { asset: selection.asset, fromMaturing, fromEarning: input.amount - fromMaturing };
    }),
    remaining:
      input.target.stakedBalance > input.amount ? input.target.stakedBalance - input.amount : 0n,
  };
}

/** Prefer the requested position, then the largest stake with the lowest-ID tie break. */
export function defaultStakeTarget(
  rows: readonly Pick<EarnPositionRow, "positionId" | "stakedBalance">[],
  requested: bigint | undefined
): string {
  if (requested !== undefined && rows.some((row) => row.positionId === requested))
    return String(requested);
  const largest = rows.reduce<Pick<EarnPositionRow, "positionId" | "stakedBalance"> | null>(
    (best, row) =>
      !best ||
      row.stakedBalance > best.stakedBalance ||
      (row.stakedBalance === best.stakedBalance && row.positionId < best.positionId)
        ? row
        : best,
    null
  );
  return largest ? String(largest.positionId) : "new";
}
