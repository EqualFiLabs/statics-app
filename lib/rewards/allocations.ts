import type { Address, Hex } from "viem";
import type { GaugePositionAllocations } from "@statics-protocol/sdk/phase-one";
import type { IndexedAllocationPool } from "@/lib/indexer/phase-one";
import {
  replacePoolAllocation,
  validateGaugeAllocationChange,
  type GaugeAllocationInput,
  type GaugeAllocationValidation,
} from "@/lib/phase-one/gauges";

export const WEEK = 604_800n;
/** "Per 1,000 STATICS" comparisons use a whole 1,000 STATICS of new weight. */
export const THOUSAND_STATICS = 1_000n * 10n ** 18n;

type Stream = IndexedAllocationPool["allocatorStreams"][number];
export type AssetAmount = Readonly<{ asset: Address; amount: bigint }>;

/**
 * What one allocator stream would pay a holder of `yours + delta` weight over the next week.
 * Streams pay pro rata to allocation weight, so new weight dilutes itself: the share is
 * (yours + delta) / (poolWeight + delta). A paused stream (pool weight 0) resumes once weight
 * arrives. The figure comes from the indexer's stored observation and caps at the stream's
 * remaining budget; it is an estimate, never a promise.
 */
export function streamWeeklyEstimate(
  stream: Stream,
  poolWeight: bigint,
  yours: bigint,
  delta = 0n,
  now?: bigint
): bigint {
  if (!stream.funded || stream.rateDenominator === 0n) return 0n;
  if (now !== undefined && now >= stream.periodFinish) return 0n;
  const share = yours + delta,
    total = poolWeight + delta;
  if (share <= 0n || total <= 0n) return 0n;
  const remaining = stream.rateNumerator,
    duration = stream.rateDenominator;
  // A stored rate remains an observation until the next indexer checkpoint. The chain clock
  // still bounds how much of that schedule can run during the coming week.
  const remainingTime =
    now === undefined
      ? duration
      : stream.periodFinish - (now > stream.lastUpdate ? now : stream.lastUpdate);
  if (remainingTime <= 0n) return 0n;
  const weekly = (remaining * (remainingTime < WEEK ? remainingTime : WEEK)) / duration;
  return (weekly * share) / total;
}

/** Weekly estimates for a pool's funded streams, summed per reward asset (never across assets). */
export function poolIncentiveEstimates(
  pool: IndexedAllocationPool,
  yours: bigint,
  delta = 0n,
  now?: bigint
): AssetAmount[] {
  const totals = new Map<string, AssetAmount>();
  for (const stream of pool.allocatorStreams) {
    const amount = streamWeeklyEstimate(stream, pool.weight, yours, delta, now);
    if (amount <= 0n) continue;
    const key = stream.asset.address.toLowerCase();
    totals.set(key, {
      asset: stream.asset.address,
      amount: amount + (totals.get(key)?.amount ?? 0n),
    });
  }
  return [...totals.values()];
}

/** What a new 1,000 STATICS allocation would earn per week, including its own dilution. */
export function perThousandWeekly(pool: IndexedAllocationPool, now?: bigint): AssetAmount[] {
  return poolIncentiveEstimates(pool, 0n, THOUSAND_STATICS, now);
}

export function sumAssetAmounts(lists: readonly (readonly AssetAmount[])[]): AssetAmount[] {
  const totals = new Map<string, AssetAmount>();
  for (const list of lists)
    for (const entry of list) {
      const key = entry.asset.toLowerCase(),
        prior = totals.get(key);
      totals.set(key, {
        asset: prior?.asset ?? entry.asset,
        amount: entry.amount + (prior?.amount ?? 0n),
      });
    }
  return [...totals.values()];
}

export type AllocationChange = Readonly<{ poolId: Hex; before: bigint; after: bigint }>;
/** Why a planned set would be rejected, as codes the UI can translate. */
export type AllocationIssue =
  "negative" | "ineligible-target" | "pool-limit" | "exceeds-stake" | "cooldown-increase";
export type AllocationPlan = Readonly<{
  positionId: bigint;
  next: readonly GaugeAllocationInput[];
  changes: readonly AllocationChange[];
  /** Pools no longer eligible; the contract rejects a set that keeps them, so they are dropped. */
  droppedIneligible: readonly Hex[];
  validation: GaugeAllocationValidation;
  issues: readonly AllocationIssue[];
  /** Any change outside cooldown starts a new one, reductions included. */
  startsCooldown: boolean;
  cooldownUntil: bigint | null;
  lockedBefore: bigint;
  lockedAfter: bigint;
}>;

/**
 * Turn per-pool edits into the full replacement set `setGaugeAllocations` requires, mirroring
 * LibGaugeRouting.setAllocations: every pool must be eligible now, amounts are positive, at most
 * `maximumAllocations` pools, total within stake, and during cooldown nothing may be added or
 * increased. An edit amount of 0 removes the pool.
 */
export function planAllocationChange(input: {
  positionId: bigint;
  current: GaugePositionAllocations;
  stakedBalance: bigint;
  maximumAllocations: bigint;
  /** Seconds. */
  cooldown: bigint;
  now: bigint;
  edits: ReadonlyMap<string, Readonly<{ poolId: Hex; amount: bigint }>>;
  /** false when the pool is known to be ineligible; undefined when unknown. */
  eligible: (poolId: Hex) => boolean | undefined;
}): AllocationPlan {
  const lower = (poolId: Hex) => poolId.toLowerCase();
  const droppedIneligible = input.current.active
    .filter((entry) => input.eligible(entry.poolId) === false)
    .map((entry) => entry.poolId);
  let next: readonly GaugeAllocationInput[] = input.current.active
    .filter((entry) => !droppedIneligible.includes(entry.poolId))
    .map((entry) => ({ poolId: entry.poolId, amount: entry.amount }));
  const extraErrors: string[] = [];
  const issues = new Set<AllocationIssue>();
  for (const edit of input.edits.values()) {
    if (edit.amount < 0n) {
      extraErrors.push("Allocation cannot be negative.");
      issues.add("negative");
      continue;
    }
    if (edit.amount > 0n && input.eligible(edit.poolId) === false) {
      extraErrors.push(`Pool ${edit.poolId} is not eligible for allocations.`);
      issues.add("ineligible-target");
    }
    next = replacePoolAllocation(next, edit.poolId, edit.amount);
  }
  const before = new Map(input.current.active.map((entry) => [lower(entry.poolId), entry]));
  const after = new Map(next.map((entry) => [lower(entry.poolId), entry]));
  const changes: AllocationChange[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const prior = before.get(key)?.amount ?? 0n,
      updated = after.get(key)?.amount ?? 0n;
    if (prior !== updated)
      changes.push({
        poolId: (after.get(key) ?? before.get(key))!.poolId,
        before: prior,
        after: updated,
      });
  }
  const base = validateGaugeAllocationChange({
    current: input.current,
    next,
    stakedBalance: input.stakedBalance,
    maximumAllocations: input.maximumAllocations,
    now: Number(input.now),
  });
  if (BigInt(next.length) > input.maximumAllocations) issues.add("pool-limit");
  if (base.totalAllocated > input.stakedBalance) issues.add("exceeds-stake");
  if (base.coolingDown)
    for (const change of changes) if (change.after > change.before) issues.add("cooldown-increase");
  const errors = [...new Set([...base.errors, ...extraErrors])];
  const validation = { ...base, errors, valid: errors.length === 0 };
  const startsCooldown = changes.length > 0 && !validation.coolingDown && input.cooldown > 0n;
  return {
    positionId: input.positionId,
    next,
    changes,
    droppedIneligible,
    validation,
    issues: [...issues],
    startsCooldown,
    cooldownUntil: startsCooldown ? input.now + input.cooldown : null,
    lockedBefore: input.current.lockedStake,
    lockedAfter: next.reduce((sum, entry) => sum + entry.amount, 0n),
  };
}

export type DestinationReason = "provides-liquidity" | "already-allocated" | "incentives";
export type DestinationSuggestion = Readonly<{ poolId: Hex; reason: DestinationReason }>;

/**
 * Where to move a stale allocation. Rewards in different tokens are not comparable without
 * prices, so this ranks by reasons that hold regardless of token value:
 *   1. a pool where the wallet provides liquidity, so the emissions it directs come back to it;
 *   2. a pool this position already allocates to, which uses no extra pool slot;
 *   3. the pool with the most funded allocator streams, thinner weight (larger share) first.
 */
export function suggestDestination(input: {
  pools: readonly IndexedAllocationPool[];
  exclude: readonly Hex[];
  liquidityPools: readonly Hex[];
  allocatedPools: readonly Hex[];
}): DestinationSuggestion | null {
  const has = (list: readonly Hex[], poolId: Hex) =>
    list.some((entry) => entry.toLowerCase() === poolId.toLowerCase());
  const candidates = input.pools.filter(
    (pool) => pool.eligibility.eligible && !has(input.exclude, pool.poolId)
  );
  const byIncentives = [...candidates].sort((a, b) =>
    a.incentiveStreamCount !== b.incentiveStreamCount
      ? b.incentiveStreamCount - a.incentiveStreamCount
      : a.weight === b.weight
        ? a.poolId.toLowerCase() < b.poolId.toLowerCase()
          ? -1
          : 1
        : a.weight < b.weight
          ? -1
          : 1
  );
  const liquidity = byIncentives.find((pool) => has(input.liquidityPools, pool.poolId));
  if (liquidity) return { poolId: liquidity.poolId, reason: "provides-liquidity" };
  const existing = byIncentives.find((pool) => has(input.allocatedPools, pool.poolId));
  if (existing) return { poolId: existing.poolId, reason: "already-allocated" };
  const incentivised = byIncentives.find((pool) => pool.incentiveStreamCount > 0);
  return incentivised ? { poolId: incentivised.poolId, reason: "incentives" } : null;
}

export type AllocationStatus = "active" | "stale" | "unknown";

/**
 * An allocation earns only while its recorded eligibility version is the pool's current one.
 * A pool that becomes ineligible, or eligible again after a restriction is lifted, leaves the
 * old allocation stale until it is resubmitted.
 */
export function allocationStatus(
  entry: Readonly<{ eligibilityVersion: Hex }>,
  pool: IndexedAllocationPool | undefined
): AllocationStatus {
  if (!pool) return "unknown";
  return pool.eligibility.eligible &&
    entry.eligibilityVersion.toLowerCase() === pool.currentVersion.toLowerCase()
    ? "active"
    : "stale";
}

type DirectoryReserve = Readonly<{
  activated: boolean;
  periodBudget: bigint;
  totalAllocatedWeight: bigint;
  periodExpired: boolean;
}>;

/**
 * Protocol STATICS this allocation routes to its pool's LPs this period:
 * periodBudget × amount / totalAllocatedWeight. Stale weight stays in the contract's denominator,
 * so it is not subtracted. Unknown (undefined) when the stored period has expired.
 */
export function directedEmission(
  activeAmount: bigint,
  reserve: DirectoryReserve | null
): bigint | undefined {
  if (!reserve) return undefined;
  if (!reserve.activated || reserve.totalAllocatedWeight === 0n) return 0n;
  if (reserve.periodExpired) return undefined;
  return (reserve.periodBudget * activeAmount) / reserve.totalAllocatedWeight;
}

/**
 * Reductions that free `amount` of locked stake, taken from the largest allocations first.
 * Each result is the pool's new amount (0 removes it).
 */
export function unlockReductions(
  allocations: readonly Readonly<{ poolId: Hex; amount: bigint }>[],
  amount: bigint
): Readonly<{ poolId: Hex; amount: bigint }>[] {
  let left = amount;
  const reductions: { poolId: Hex; amount: bigint }[] = [];
  for (const entry of [...allocations].sort((a, b) =>
    a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1
  )) {
    if (left <= 0n) break;
    const cut = entry.amount < left ? entry.amount : left;
    reductions.push({ poolId: entry.poolId, amount: entry.amount - cut });
    left -= cut;
  }
  return reductions;
}

/** Split a stake evenly across pools; the remainder goes to the first pool. */
export function evenSplit(
  poolIds: readonly Hex[],
  stake: bigint
): Readonly<{ poolId: Hex; amount: bigint }>[] {
  if (!poolIds.length) return [];
  const share = stake / BigInt(poolIds.length),
    remainder = stake - share * BigInt(poolIds.length);
  return poolIds.map((poolId, index) => ({
    poolId,
    amount: share + (index === 0 ? remainder : 0n),
  }));
}
