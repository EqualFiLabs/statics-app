import type { Address } from "viem";

/** One Position NFT as the Earn table shows it. Every on-chain field is optional until read. */
export type EarnPositionRow = Readonly<{
  positionId: bigint;
  stakedBalance: bigint;
  liquidityLegs: bigint;
  /** Reward assets the position has opted into; undefined while unread. */
  selectedAssets?: readonly Address[];
  maximumRewardAssets?: bigint;
  /** Selected assets whose stake is still inside the eligibility delay. */
  maturingAssets?: readonly Address[];
  /** Earliest time a maturing asset starts earning, in seconds. */
  maturesAt?: bigint;
  allocation?: Readonly<{
    totalAllocated: bigint;
    /** Allocations whose pool is still eligible; stale allocations are excluded. */
    lockedStake: bigint;
    nextAllocationAt: bigint;
    poolCount: number;
  }>;
  unavailable: boolean;
}>;

export type EarnPositionStatus =
  | "loading"
  | "unavailable"
  | "empty"
  | "earning-nothing"
  | "stale-allocation"
  | "cooldown"
  | "maturing"
  | "earning";

export const earnStatusFilters = [
  "all",
  "attention",
  "earning",
  "maturing",
  "cooldown",
  "liquidity",
] as const;
export type EarnStatusFilter = (typeof earnStatusFilters)[number];

export type EarnSortField = "staked" | "allocated" | "id";
export type EarnSort = Readonly<{ field: EarnSortField; direction: "asc" | "desc" }>;

export function staleAllocation(row: EarnPositionRow): bigint {
  const allocation = row.allocation;
  return allocation && allocation.totalAllocated > allocation.lockedStake
    ? allocation.totalAllocated - allocation.lockedStake
    : 0n;
}

export function freeStake(row: EarnPositionRow): bigint {
  const allocated = row.allocation?.totalAllocated ?? 0n;
  return row.stakedBalance > allocated ? row.stakedBalance - allocated : 0n;
}

export function coolingDown(row: EarnPositionRow, now: bigint | undefined): boolean {
  return Boolean(now !== undefined && row.allocation && row.allocation.nextAllocationAt > now);
}

/** The single most important thing to know about a position, most urgent first. */
export function earnPositionStatus(
  row: EarnPositionRow,
  now: bigint | undefined
): EarnPositionStatus {
  if (row.unavailable) return "unavailable";
  if (row.stakedBalance === 0n) return "empty";
  if (!row.selectedAssets || !row.allocation) return "loading";
  if (row.selectedAssets.length === 0) return "earning-nothing";
  if (staleAllocation(row) > 0n) return "stale-allocation";
  if (now === undefined) return "loading";
  if (coolingDown(row, now)) return "cooldown";
  if ((row.maturingAssets?.length ?? 0) > 0) return "maturing";
  return "earning";
}

export function needsAttention(status: EarnPositionStatus): boolean {
  return status === "earning-nothing" || status === "stale-allocation";
}

export function matchesStatusFilter(
  row: EarnPositionRow,
  filter: EarnStatusFilter,
  now: bigint | undefined
): boolean {
  const status = earnPositionStatus(row, now);
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return needsAttention(status);
    case "earning":
      return (row.selectedAssets?.length ?? 0) > 0 && row.stakedBalance > 0n;
    case "maturing":
      return (row.maturingAssets?.length ?? 0) > 0;
    case "cooldown":
      return coolingDown(row, now);
    case "liquidity":
      return row.liquidityLegs > 0n;
  }
}

/** Matches "#12", "12", or an asset symbol/address the position earns in. */
export function matchesSearch(
  row: EarnPositionRow,
  query: string,
  symbolOf: (asset: Address) => string | undefined
): boolean {
  const text = query.trim().toLowerCase().replace(/^#/, "");
  if (!text) return true;
  if (String(row.positionId) === text || String(row.positionId).startsWith(text)) return true;
  return (row.selectedAssets ?? []).some(
    (asset) =>
      asset.toLowerCase() === text || (symbolOf(asset)?.toLowerCase().includes(text) ?? false)
  );
}

export function sortEarnRows(rows: readonly EarnPositionRow[], sort: EarnSort): EarnPositionRow[] {
  const key = (row: EarnPositionRow) =>
    sort.field === "staked"
      ? row.stakedBalance
      : sort.field === "allocated"
        ? (row.allocation?.totalAllocated ?? -1n)
        : row.positionId;
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = key(a),
      y = key(b);
    if (x !== y) return (x < y ? -1 : 1) * sign;
    return a.positionId < b.positionId ? -1 : a.positionId > b.positionId ? 1 : 0;
  });
}
