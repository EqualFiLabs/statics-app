import { formatUnits, isAddress, isHash, maxUint256, type Address, type Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  portfolioRewardAmounts,
  type PositionRewardPortfolio,
  type RewardAmount,
  type RewardSource,
} from "@/lib/phase-one/reward-portfolio";

export const earnViews = ["staking", "gauge", "bribes", "allocations"] as const;
export type EarnView = "overview" | (typeof earnViews)[number];
export type EarnFilters = Readonly<{
  positionId?: bigint;
  poolId?: Hex;
  asset?: Address;
  share: "lp" | "allocator";
  invalid: boolean;
}>;
export function readEarnFilters(params: URLSearchParams): EarnFilters {
  const position = params.get("positionId"),
    pool = params.get("poolId"),
    asset = params.get("asset"),
    share = params.get("share");
  const positionId =
    position !== null && /^\d+$/.test(position) && BigInt(position) <= maxUint256
      ? BigInt(position)
      : undefined;
  return {
    positionId,
    poolId: pool && isHash(pool) ? pool : undefined,
    asset: asset && isAddress(asset) ? asset : undefined,
    share: share === "allocator" ? "allocator" : "lp",
    invalid:
      ["positionId", "poolId", "asset", "share"].some((key) => params.getAll(key).length > 1) ||
      (position !== null && positionId === undefined) ||
      (pool !== null && !isHash(pool)) ||
      (asset !== null && !isAddress(asset)) ||
      (share !== null && share !== "lp" && share !== "allocator"),
  };
}
export function earnHref(view: EarnView, filters: Partial<EarnFilters> = {}) {
  const params = new URLSearchParams();
  if (view !== "overview") {
    if (filters.positionId !== undefined) params.set("positionId", String(filters.positionId));
    if (view !== "staking" && filters.poolId) params.set("poolId", filters.poolId);
    if (view !== "allocations" && filters.asset) params.set("asset", filters.asset);
    if (view === "bribes" && filters.share) params.set("share", filters.share);
  }
  return `/app/rewards${view === "overview" ? "" : `/${view}`}${params.size ? `?${params}` : ""}`;
}
export function sourceForView(view: EarnView, share: EarnFilters["share"]): RewardSource[] {
  return view === "overview"
    ? ["global", "gauge", "lp-bribe", "allocator"]
    : view === "staking"
      ? ["global"]
      : view === "gauge"
        ? // Liquidity rewards: protocol emissions and LP-share incentives both pay in-range LPs.
          ["gauge", "lp-bribe"]
        : view === "bribes"
          ? [share === "lp" ? "lp-bribe" : "allocator"]
          : [];
}
export function rewardRowKey(positionId: bigint, poolId?: Hex) {
  return `${positionId}:${poolId?.toLowerCase() ?? "global"}`;
}
export type RewardClaimScope = Readonly<{
  sources: readonly RewardSource[];
  positionId?: bigint;
  poolId?: Hex;
  asset?: Address;
  selectedRows?: readonly string[];
}>;
export function scopeIncludes(scope: RewardClaimScope, positionId: bigint, poolId?: Hex) {
  return (
    (scope.positionId === undefined || scope.positionId === positionId) &&
    (!scope.poolId || poolId?.toLowerCase() === scope.poolId.toLowerCase()) &&
    (!scope.selectedRows || scope.selectedRows.includes(rewardRowKey(positionId, poolId)))
  );
}
export function scopeRewardAmounts(
  rows: readonly PositionRewardPortfolio[],
  scope: RewardClaimScope
): RewardAmount[] {
  const totals = new Map<string, RewardAmount>();
  for (const row of rows)
    for (const source of scope.sources) {
      const pools = source === "global" ? [undefined] : row.pools.map((pool) => pool.poolId);
      for (const pool of pools)
        if (scopeIncludes(scope, row.positionId, pool))
          for (const entry of portfolioRewardAmounts(row, source, pool)) {
            if (
              entry.amount <= 0n ||
              (scope.asset && scope.asset.toLowerCase() !== entry.asset.toLowerCase())
            )
              continue;
            const key = entry.asset.toLowerCase();
            totals.set(key, { ...entry, amount: entry.amount + (totals.get(key)?.amount ?? 0n) });
          }
    }
  return [...totals.values()];
}
export function rewardToken(deployment: PhaseOneDeployment, asset: Address) {
  return (
    deployment.supportedPools
      .flatMap((pool) => [pool.token0, pool.token1])
      .find((token) => token.address.toLowerCase() === asset.toLowerCase()) ??
    (asset.toLowerCase() === deployment.contracts.statics.toLowerCase()
      ? { address: asset, symbol: "STATICS", decimals: 18 }
      : null)
  );
}
/** Never round a positive payout to zero; exact units are always available alongside the display. */
export function rewardDisplay(amount: bigint, decimals: number) {
  const exact = formatUnits(amount, decimals);
  if (amount > 0n && amount < 10n ** BigInt(Math.max(0, decimals - 6)))
    return { display: "<0.000001", exact };
  const [whole, fraction] = exact.split(".");
  return {
    display: `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction.slice(0, 6).replace(/0+$/, "")}`.replace(/\.$/, "") : ""}`,
    exact,
  };
}
export function rewardPoolName(deployment: PhaseOneDeployment, poolId: Hex) {
  const pool = deployment.supportedPools.find(
    (pool) => pool.poolId.toLowerCase() === poolId.toLowerCase()
  );
  return pool
    ? `${pool.token0.symbol} / ${pool.token1.symbol}`
    : `${poolId.slice(0, 8)}…${poolId.slice(-6)}`;
}

export function claimScopeIncomplete(
  rows: readonly PositionRewardPortfolio[],
  scope: RewardClaimScope
): boolean {
  return rows.some((row) => {
    if (scope.positionId !== undefined && scope.positionId !== row.positionId) return false;
    if (
      scope.selectedRows &&
      !scope.selectedRows.some((key) => key.startsWith(`${row.positionId}:`))
    )
      return false;
    if (
      scope.sources.includes("global") &&
      scopeIncludes(scope, row.positionId) &&
      row.globalUnavailable
    )
      return true;
    const lp = scope.sources.some((source) => source === "gauge" || source === "lp-bribe"),
      allocator = scope.sources.includes("allocator");
    return (
      ((lp || allocator) && row.discoveryUnavailable) ||
      row.pools.some(
        (pool) =>
          scopeIncludes(scope, row.positionId, pool.poolId) &&
          ((lp && pool.hasLp && (!pool.rewards || pool.lpUnavailable)) ||
            (allocator && pool.hasAllocator && (!pool.rewards || pool.allocatorUnavailable)))
      )
    );
  });
}
