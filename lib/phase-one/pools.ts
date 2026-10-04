import { getAddress, parseAbi, type Address, type Hex, type PublicClient } from "viem";

import {
  staticsAbi,
  staticsGaugeIncentivesAbi,
  staticsSwapFeeHookAbi,
  v4PoolId,
  v4StateViewReadAbi,
  type V4PoolKey,
} from "@statics-protocol/sdk/phase-one";

import type {
  PhaseOneDeployment,
  PublicPoolToken,
  SupportedPublicPool,
} from "@/lib/deployments/types";

const WEEK_SECONDS = 7 * 24 * 60 * 60;
const GENERAL_PUBLIC_POOL_KIND = 2;

const phaseOnePoolSafetyAbi = parseAbi([
  "function isProtocolPoolQuarantined(bytes32 poolId) view returns (bool quarantined)",
  "function protocolPoolSwapsBlocked(bytes32 poolId) view returns (bool blocked)",
  "function protocolPolFundingConfig(bytes32 poolId) view returns (bool activated,bool overridden,uint16 shareBps)",
]);

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

export type PublicPoolPreflight = Readonly<{
  pool: PublicPoolSelection;
  creator: Address;
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  nativeLpFee: number;
  liquidity: bigint;
  feeRate: Readonly<{ inputFeeBps: number; outputFeeBps: number; overridden: boolean }>;
  allocation: Readonly<{
    managedPolShareBps: number;
    staticsStakerShareBps: number;
    creatorShareBps: 500;
    treasuryShareBps: number;
    managedPolActivated: boolean;
    managedPolOverridden: boolean;
  }>;
  rewardRestrictions: Readonly<{ token0: boolean; token1: boolean }>;
  gauge: Readonly<{
    freshness: GaugeScheduleFreshness;
    poolWeight: bigint;
    pendingReward: bigint;
    staleAllocation: boolean;
  }>;
  quarantined: boolean;
  decommissioned: boolean;
  swapsBlocked: boolean;
  initialized: boolean;
  swappable: boolean;
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

export function importedPublicPool(input: {
  deployment: PhaseOneDeployment;
  poolKey: V4PoolKey;
  token0: PublicPoolToken;
  token1: PublicPoolToken;
}): PublicPoolSelection {
  const poolId = requireCanonicalPublicPoolKey(
    input.poolKey,
    input.deployment.contracts.publicHook
  );
  requireTokenOrder(input.poolKey, input.token0, input.token1);
  return {
    poolId,
    poolKey: input.poolKey,
    token0: input.token0,
    token1: input.token1,
    source: "explicit-import",
    directOnly: true,
    warning:
      "Unlisted pool. Verify both token addresses and the complete PoolKey. This pool can only be used for a direct swap and is never a routing intermediary.",
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

export async function readPublicPoolPreflight(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment,
  pool: PublicPoolSelection,
  now?: number
): Promise<PublicPoolPreflight> {
  if (publicClient.chain && publicClient.chain.id !== deployment.descriptor.chainId) {
    throw new Error("The RPC chain does not match the selected Phase 1 deployment.");
  }
  const derivedPoolId = requireCanonicalPublicPoolKey(
    pool.poolKey,
    deployment.contracts.publicHook
  );
  if (derivedPoolId.toLowerCase() !== pool.poolId.toLowerCase()) {
    throw new Error("The selected PoolId does not match its exact PoolKey.");
  }

  const contracts = deployment.contracts;
  const [
    registration,
    feeRate,
    hookAllocation,
    hookDecommissioned,
    registeredByDiamond,
    protocolPool,
    quarantined,
    swapsBlocked,
    polFunding,
    token0Restricted,
    token1Restricted,
    slot0,
    liquidity,
    reserve,
    poolWeight,
    maxCatchupPeriods,
    block,
  ] = await Promise.all([
    publicClient.readContract({
      address: contracts.publicHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "poolRegistration",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.publicHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "poolFeeRate",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.publicHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "generalFeeAllocation",
    }),
    publicClient.readContract({
      address: contracts.publicHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "poolDecommissioned",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsAbi,
      functionName: "isProtocolPool",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsAbi,
      functionName: "protocolPool",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: phaseOnePoolSafetyAbi,
      functionName: "isProtocolPoolQuarantined",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: phaseOnePoolSafetyAbi,
      functionName: "protocolPoolSwapsBlocked",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: phaseOnePoolSafetyAbi,
      functionName: "protocolPolFundingConfig",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsAbi,
      functionName: "rewardRestricted",
      args: [pool.poolKey.currency0],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsAbi,
      functionName: "rewardRestricted",
      args: [pool.poolKey.currency1],
    }),
    publicClient.readContract({
      address: contracts.stateView,
      abi: v4StateViewReadAbi,
      functionName: "getSlot0",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.stateView,
      abi: v4StateViewReadAbi,
      functionName: "getLiquidity",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugeReserve",
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugePoolWeight",
      args: [pool.poolId],
    }),
    publicClient.readContract({
      address: contracts.diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "maxGaugeCatchupPeriods",
    }),
    now === undefined ? publicClient.getBlock() : Promise.resolve(null),
  ]);

  if (!registration.registered || !registeredByDiamond) {
    throw new Error("The selected pool is not registered as a Statics protocol pool.");
  }
  if (
    registration.kind !== GENERAL_PUBLIC_POOL_KIND ||
    protocolPool.kind !== GENERAL_PUBLIC_POOL_KIND
  ) {
    throw new Error("The selected pool is not a general public Statics pool.");
  }
  if (
    !sameAddress(registration.currency0, pool.poolKey.currency0) ||
    !sameAddress(registration.currency1, pool.poolKey.currency1) ||
    !samePoolKey(protocolPool.key, pool.poolKey) ||
    protocolPool.poolId.toLowerCase() !== pool.poolId.toLowerCase()
  ) {
    throw new Error("Live protocol pool state does not match the exact selected PoolKey.");
  }
  if (!sameAddress(registration.creator, protocolPool.creator)) {
    throw new Error("Live hook and Diamond pool creators do not match.");
  }

  const currentTimestamp = now ?? Number(block!.timestamp);
  const freshness = gaugeScheduleFreshness(reserve, currentTimestamp, maxCatchupPeriods);
  const initialized = slot0[0] !== 0n;
  const decommissioned = hookDecommissioned || protocolPool.decommissioned;
  const effectivePolShare = polFunding[0]
    ? Math.min(
        polFunding[1] ? polFunding[2] : hookAllocation.polShareBps,
        hookAllocation.polShareBps + hookAllocation.treasuryShareBps
      )
    : 0;
  const treasuryShareBps = 10_000 - 500 - effectivePolShare - hookAllocation.staticsStakerShareBps;

  return {
    pool,
    creator: registration.creator,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
    protocolFee: slot0[2],
    nativeLpFee: slot0[3],
    liquidity,
    feeRate,
    allocation: {
      managedPolShareBps: effectivePolShare,
      staticsStakerShareBps: hookAllocation.staticsStakerShareBps,
      creatorShareBps: 500,
      treasuryShareBps,
      managedPolActivated: polFunding[0],
      managedPolOverridden: polFunding[1],
    },
    rewardRestrictions: { token0: token0Restricted, token1: token1Restricted },
    gauge: {
      freshness,
      poolWeight: poolWeight.weight,
      pendingReward: poolWeight.pendingReward,
      staleAllocation: poolWeight.stale,
    },
    quarantined,
    decommissioned,
    swapsBlocked,
    initialized,
    swappable: initialized && liquidity > 0n && !decommissioned && !swapsBlocked,
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
