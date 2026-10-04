import { getAddress, type Address, type Hex, type PublicClient } from "viem";

import { v4PoolId, v4StateViewReadAbi, type V4PoolKey } from "@statics-protocol/sdk/phase-one";

import type {
  PhaseOneDeployment,
  PublicPoolToken,
  SupportedPublicPool,
} from "@/lib/deployments/types";

const WEEK_SECONDS = 7 * 24 * 60 * 60;
export type PublicPoolSource = "reviewed-registry" | "explicit-import";

export type PublicPoolSelection = Readonly<{
  poolId: Hex;
  poolKey: V4PoolKey;
  token0: PublicPoolToken;
  token1: PublicPoolToken;
  source: PublicPoolSource;
  directOnly: true;
  warning: string | null;
}>;

export type GaugeScheduleFreshness = Readonly<{
  activated: boolean;
  stale: boolean;
  periodFinish: number;
  lastCheckpoint: number;
  periodsBehind: number;
  maximumPeriodsPerCall: number;
  catchupCallsRequired: number;
}>;

function sameAddress(left: Address, right: Address): boolean {
  return getAddress(left) === getAddress(right);
}

export function samePoolKey(left: V4PoolKey, right: V4PoolKey): boolean {
  return (
    sameAddress(left.currency0, right.currency0) &&
    sameAddress(left.currency1, right.currency1) &&
    left.fee === right.fee &&
    left.tickSpacing === right.tickSpacing &&
    sameAddress(left.hooks, right.hooks)
  );
}

export function requireCanonicalPublicPoolKey(poolKey: V4PoolKey, publicHook: Address): Hex {
  if (poolKey.currency0.toLowerCase() >= poolKey.currency1.toLowerCase()) {
    throw new Error("Public pool currencies must use canonical address order.");
  }
  if (!Number.isInteger(poolKey.fee) || poolKey.fee < 0 || poolKey.fee > 999_999) {
    throw new Error("Public pool fee must be a supported static Uniswap v4 fee.");
  }
  if (
    !Number.isInteger(poolKey.tickSpacing) ||
    poolKey.tickSpacing < 1 ||
    poolKey.tickSpacing > 32_767
  ) {
    throw new Error("Public pool tick spacing must be between 1 and 32767.");
  }
  if (!sameAddress(poolKey.hooks, publicHook)) {
    throw new Error("Public pool must use the reviewed Statics hook.");
  }
  return v4PoolId(poolKey);
}

function requireTokenOrder(
  poolKey: V4PoolKey,
  token0: PublicPoolToken,
  token1: PublicPoolToken
): void {
  if (
    !sameAddress(poolKey.currency0, token0.address) ||
    !sameAddress(poolKey.currency1, token1.address)
  ) {
    throw new Error("Token metadata must match the exact PoolKey currency order.");
  }
}

export function listedPublicPool(pool: SupportedPublicPool): PublicPoolSelection {
  if (!pool.enabled) throw new Error("This reviewed public pool is disabled.");
  requireTokenOrder(pool.poolKey, pool.token0, pool.token1);
  if (v4PoolId(pool.poolKey).toLowerCase() !== pool.poolId.toLowerCase()) {
    throw new Error("The reviewed public PoolId does not match its PoolKey.");
  }
  return {
    poolId: pool.poolId,
    poolKey: pool.poolKey,
    token0: pool.token0,
    token1: pool.token1,
    source: "reviewed-registry",
    directOnly: true,
    warning: null,
  };
}

export function gaugeScheduleFreshness(
  reserve: Readonly<{
    activated: boolean;
    periodFinish: number;
    lastCheckpoint: number;
  }>,
  now: number,
  maximumPeriodsPerCall: number
): GaugeScheduleFreshness {
  if (!Number.isInteger(now) || now < 0) throw new Error("Current time must be a timestamp.");
  if (!Number.isInteger(maximumPeriodsPerCall) || maximumPeriodsPerCall <= 0) {
    throw new Error("Gauge catch-up limit must be positive.");
  }
  const periodsBehind =
    reserve.activated && now >= reserve.periodFinish
      ? Math.floor((now - reserve.periodFinish) / WEEK_SECONDS) + 1
      : 0;
  return {
    activated: reserve.activated,
    stale: periodsBehind > 0,
    periodFinish: reserve.periodFinish,
    lastCheckpoint: reserve.lastCheckpoint,
    periodsBehind,
    maximumPeriodsPerCall,
    catchupCallsRequired:
      periodsBehind === 0 ? 0 : Math.ceil(periodsBehind / maximumPeriodsPerCall),
  };
}

/** Liquidity forms need the current price only; rewards and deployment state are unrelated. */
export async function readPublicPoolState(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment,
  pool: PublicPoolSelection
) {
  if (publicClient.chain && publicClient.chain.id !== deployment.descriptor.chainId)
    throw new Error("Select the configured Statics network.");
  const [sqrtPriceX96, tick] = await publicClient.readContract({
    address: deployment.contracts.stateView,
    abi: v4StateViewReadAbi,
    functionName: "getSlot0",
    args: [pool.poolId],
  });
  return { sqrtPriceX96, tick };
}
