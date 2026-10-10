import { getAddress, type Address, type Hex } from "viem";
import { v4PoolId, type V4PoolKey } from "@statics-protocol/sdk/phase-one";
import type { PublicPoolToken, SupportedPublicPool } from "@/lib/deployments/types";
import type { IndexedAllocationPool, IndexedPublicPool } from "@/lib/indexer/phase-one";

/**
 * Phase 1 pools are either reviewed (in the checked-in manifest, with curated metadata) or
 * discovered (registered on the diamond after the manifest was built). The manifest exists to
 * keep scam tokens from looking legitimate, so a discovered pool is usable only after it is
 * checked against indexed registration data, and its tokens are labelled unreviewed.
 */
export type PhaseOnePool = Readonly<{
  poolId: Hex;
  poolKey: V4PoolKey;
  token0: PublicPoolToken;
  token1: PublicPoolToken;
  reviewed: boolean;
  /** Trading is open: not decommissioned and not quarantined. */
  swappable: boolean;
}>;

/** Registered pool and cached currency metadata supplied by the typed indexer loader. */
export type IndexedSwapPool = Pick<
  IndexedAllocationPool,
  | "poolId"
  | "poolKey"
  | "token0"
  | "token1"
  | "decommissioned"
  | "decommissionStarted"
  | "decommissionFinalized"
  | "quarantined"
>;

export type DiscoveryRejection = "pool-id" | "token-order" | "hook" | "key-mismatch" | "decimals";

const same = (a: Address, b: Address) => getAddress(a) === getAddress(b);
/** Check the indexed identity locally; discovery does not audit the deployment. */
export function precheckDiscoveredPool(
  pool: Pick<IndexedPublicPool, "poolId" | "poolKey">,
  publicHook: Address
): DiscoveryRejection | null {
  if (v4PoolId(pool.poolKey).toLowerCase() !== pool.poolId.toLowerCase()) return "pool-id";
  if (pool.poolKey.currency0.toLowerCase() >= pool.poolKey.currency1.toLowerCase())
    return "token-order";
  if (!same(pool.poolKey.hooks, publicHook)) return "hook";
  return null;
}

/** Validate local identity and require known decimals; never infer token units. */
export function discoverPhaseOnePool(
  pool: IndexedSwapPool,
  publicHook: Address
): PhaseOnePool | DiscoveryRejection {
  const precheck = precheckDiscoveredPool(pool, publicHook);
  if (precheck) return precheck;
  if (
    !same(pool.token0.address, pool.poolKey.currency0) ||
    !same(pool.token1.address, pool.poolKey.currency1)
  )
    return "key-mismatch";
  if (
    [pool.token0, pool.token1].some(
      (token) =>
        token.decimals === null ||
        !Number.isInteger(token.decimals) ||
        token.decimals < 0 ||
        token.decimals > 255
    )
  )
    return "decimals";
  const token = (meta: IndexedSwapPool["token0"]): PublicPoolToken => ({
    address: getAddress(meta.address),
    symbol:
      meta.symbol?.trim().slice(0, 16) || `${meta.address.slice(0, 6)}…${meta.address.slice(-4)}`,
    name: meta.name?.trim().slice(0, 64) || "Unreviewed token",
    decimals: meta.decimals!,
    metadataSource: "onchain-import",
  });
  return {
    poolId: pool.poolId,
    poolKey: pool.poolKey,
    token0: token(pool.token0),
    token1: token(pool.token1),
    reviewed: false,
    swappable:
      !pool.decommissioned &&
      !pool.decommissionStarted &&
      !pool.decommissionFinalized &&
      !pool.quarantined,
  };
}

/**
 * Reviewed pools first, then locally checked discovered pools the manifest does not already list.
 * A discovered token that is also a reviewed token takes the reviewed metadata.
 */
export function mergePhaseOnePools(
  reviewed: readonly SupportedPublicPool[],
  discovered: readonly PhaseOnePool[],
  statuses: readonly IndexedSwapPool[] = []
): PhaseOnePool[] {
  const listed: PhaseOnePool[] = reviewed
    .filter((pool) => pool.enabled)
    .map((pool) => ({
      poolId: pool.poolId,
      poolKey: pool.poolKey,
      token0: pool.token0,
      token1: pool.token1,
      reviewed: true,
      swappable: (() => {
        const status = statuses.find(
          (candidate) => candidate.poolId.toLowerCase() === pool.poolId.toLowerCase()
        );
        return status
          ? !status.quarantined &&
              !status.decommissioned &&
              !status.decommissionStarted &&
              !status.decommissionFinalized
          : (discovered.find(
              (candidate) => candidate.poolId.toLowerCase() === pool.poolId.toLowerCase()
            )?.swappable ?? true);
      })(),
    }));
  const known = new Set(reviewed.map((pool) => pool.poolId.toLowerCase()));
  const reviewedTokens = new Map(
    listed.flatMap((pool) => [pool.token0, pool.token1]).map((t) => [t.address.toLowerCase(), t])
  );
  const adopt = (t: PublicPoolToken) => reviewedTokens.get(t.address.toLowerCase()) ?? t;
  return [
    ...listed,
    ...discovered
      .filter((pool) => !known.has(pool.poolId.toLowerCase()))
      .map((pool) => ({ ...pool, token0: adopt(pool.token0), token1: adopt(pool.token1) })),
  ];
}

/** True when a token's identity comes from the reviewed manifest. */
export function isReviewedToken(token: Pick<PublicPoolToken, "metadataSource">) {
  return token.metadataSource === "reviewed-manifest";
}
