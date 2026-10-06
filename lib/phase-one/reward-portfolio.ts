import { parseAbi, type Hex, type PublicClient, type Address } from "viem";
import { staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { readPositionGaugeRewards } from "@/lib/phase-one/gauges";
import type { readPositionGlobalRewards } from "@/lib/phase-one/staking";

export type RewardPools = Readonly<{ lp: readonly Hex[]; allocator: readonly Hex[] }>;
export type PoolRewards = Awaited<ReturnType<typeof readPositionGaugeRewards>>;
export type GlobalRewards = Awaited<ReturnType<typeof readPositionGlobalRewards>>;
// Installed GaugeIncentiveViewFacet exposes this view; the vendored SDK ABI omits it.
const allocatorPoolsAbi = parseAbi([
  "function positionGaugeAllocatorPools(uint256 positionId,uint256 cursor,uint256 limit) view returns (bytes32[] poolIds,uint256 nextCursor)",
]);
export type PositionRewardPortfolio = Readonly<{
  positionId: bigint;
  global: GlobalRewards | null;
  globalUnavailable: boolean;
  discoveryUnavailable: boolean;
  pools: readonly Readonly<{
    poolId: Hex;
    hasLp: boolean;
    hasAllocator: boolean;
    rewards: PoolRewards | null;
  }>[];
}>;

// Enumerate position portfolios, including retained rewards after exit/redirect.
// Never probe the position × configured-pool cross product.
export async function discoverPositionRewardPools(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  account: Address;
}): Promise<RewardPools> {
  async function pages(kind: "lp" | "allocator") {
    let cursor = 0n;
    const pools = new Map<string, Hex>();
    for (let page = 0; page < 100; page++) {
      const request = {
        address: input.deployment.contracts.diamond,
        args: [input.positionId, cursor, 100n] as const,
        account: input.account,
      };
      const [entries, next] =
        kind === "lp"
          ? await input.publicClient.readContract({
              ...request,
              abi: staticsRangeGaugeAbi,
              functionName: "positionGaugePools",
            })
          : await input.publicClient.readContract({
              ...request,
              abi: allocatorPoolsAbi,
              functionName: "positionGaugeAllocatorPools",
            });
      for (const poolId of entries) pools.set(poolId.toLowerCase(), poolId);
      if (entries.length < 100) return [...pools.values()];
      if (next <= cursor) throw new Error("Reward pool discovery returned a stalled cursor.");
      cursor = next;
    }
    throw new Error("Reward pool discovery exceeded its page limit.");
  }
  const [lp, allocator] = await Promise.all([pages("lp"), pages("allocator")]);
  return { lp, allocator };
}

export async function mapRewardReads<T, R>(
  items: readonly T[],
  read: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await read(items[index]);
      }
    })
  );
  return results;
}

export async function loadPositionRewardPortfolio(input: {
  positionId: bigint;
  global: () => Promise<GlobalRewards>;
  discovery: () => Promise<RewardPools>;
  pool: (poolId: Hex, hasLp: boolean) => Promise<PoolRewards>;
}): Promise<PositionRewardPortfolio> {
  const [global, discovery] = await Promise.allSettled([input.global(), input.discovery()]);
  const ids = discovery.status === "fulfilled" ? discovery.value : { lp: [], allocator: [] };
  const lp = new Set(ids.lp.map((id) => id.toLowerCase()));
  const allocator = new Set(ids.allocator.map((id) => id.toLowerCase()));
  const all = [
    ...new Map([...ids.lp, ...ids.allocator].map((id) => [id.toLowerCase(), id])).values(),
  ];
  const pools = await mapRewardReads(all, async (poolId) => {
    const hasLp = lp.has(poolId.toLowerCase());
    try {
      return {
        poolId,
        hasLp,
        hasAllocator: allocator.has(poolId.toLowerCase()),
        rewards: await input.pool(poolId, hasLp),
      };
    } catch {
      return { poolId, hasLp, hasAllocator: allocator.has(poolId.toLowerCase()), rewards: null };
    }
  });
  return {
    positionId: input.positionId,
    global: global.status === "fulfilled" ? global.value : null,
    globalUnavailable: global.status === "rejected",
    discoveryUnavailable: discovery.status === "rejected",
    pools,
  };
}

export type RewardAmount = Readonly<{ asset: Address; amount: bigint }>;
export type RewardSource = "global" | "gauge" | "lp-bribe" | "allocator";
export function portfolioRewardAmounts(
  position: PositionRewardPortfolio,
  kind: RewardSource,
  poolId?: Hex
): readonly RewardAmount[] {
  if (kind === "global")
    return (
      position.global?.claimAssets.map((asset, index) => ({
        asset,
        amount: position.global!.pendingRewards[index] ?? 0n,
      })) ?? []
    );
  const pool = position.pools.find((row) => row.poolId.toLowerCase() === poolId?.toLowerCase());
  if (!pool?.rewards) return [];
  if (kind === "allocator") return pool.hasAllocator ? pool.rewards.allocator : [];
  if (!pool.hasLp) return [];
  const { lp } = pool.rewards;
  const start = kind === "gauge" ? 0 : 1;
  const end = kind === "gauge" ? Math.min(1, lp.slotCount) : lp.slotCount;
  return lp.amounts
    .slice(start, end)
    .map((amount, index) => ({ asset: lp.assets[start + index], amount }));
}

export function totalPortfolioRewards(
  positions: readonly PositionRewardPortfolio[],
  kind: RewardSource
) {
  const totals = new Map<string, RewardAmount>();
  for (const position of positions) {
    const rows =
      kind === "global"
        ? [portfolioRewardAmounts(position, kind)]
        : position.pools.map((pool) => portfolioRewardAmounts(position, kind, pool.poolId));
    for (const row of rows)
      for (const entry of row) {
        const key = entry.asset.toLowerCase();
        totals.set(key, {
          asset: entry.asset,
          amount: (totals.get(key)?.amount ?? 0n) + entry.amount,
        });
      }
  }
  return [...totals.values()].filter((entry) => entry.amount > 0n);
}
