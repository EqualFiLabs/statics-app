import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  BasketStatus,
  CanonicalPoolStatus,
  decodePositionInfo,
  staticsAbi,
  staticsLiquidityManagerAbi,
  staticsSwapFeeHookAbi,
  v4PositionManagerReadAbi,
  v4StateViewReadAbi,
  type PoolFeeConfiguration,
  type BasketSnapshot,
  type V4PoolKey,
} from "@statics-protocol/sdk";

import {
  loadBasketCatalog,
  loadTokenMetadata,
  type BasketRecord,
  type TokenMetadata,
} from "@/lib/baskets/baskets";
import {
  verifyDollarDeployment,
  verifyLiquidityDeployment,
  type DollarDeployment,
} from "@/lib/dollar/deployment";
import { loadPositionCatalog, type PositionRecord } from "@/lib/positions/positions";

export type CanonicalPoolRecord = Readonly<{
  basketId: bigint;
  basketName: string;
  basketSymbol: string;
  asset: TokenMetadata;
  basketToken: TokenMetadata;
  poolId: Hex;
  key: V4PoolKey;
  status: number;
  initializedAt: number;
  activatedAt: number;
  referenceTick: number;
  spotTick: number;
  observationCardinality: number;
  decommissioned: boolean;
  managerSynced: boolean;
  sqrtPriceX96: bigint;
  currentTick: number;
  lpFee: number;
  hookFees: PoolFeeConfiguration;
  pending0: bigint;
  pending1: bigint;
  lockedLiquidity: bigint;
}>;

export type LpPositionRecord = Readonly<{
  tokenId: bigint;
  owner: Address;
  key: V4PoolKey;
  poolId: Hex;
  tickLower: number;
  tickUpper: number;
  hasSubscriber: boolean;
  liquidity: bigint;
  positionId: bigint;
  eligibleLiquidity: bigint;
  pendingLiquidity: bigint;
  eligibleAtBlock: bigint;
  claimable0: bigint;
  claimable1: bigint;
  staked: boolean;
}>;

export type LiquidityCatalog = Readonly<{
  pools: readonly CanonicalPoolRecord[];
  positions: readonly LpPositionRecord[];
  baskets: readonly BasketRecord[];
  positionRecords: readonly PositionRecord[];
  positionNftIds: readonly bigint[];
  currentBlock: bigint;
}>;

export function v4PoolId(key: V4PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)"
      ),
      [key]
    )
  );
}

export function basketLiquiditySnapshot(basket: BasketRecord): BasketSnapshot {
  return {
    basketId: basket.basketId,
    basketToken: basket.token.address,
    status: basket.status as BasketStatus,
    totalSupply: basket.totalSupply,
    mintFeeTiers: basket.mintFeeTiers,
    redemptionFeeTiers: basket.redemptionFeeTiers,
    originationFeeBps: BigInt(basket.originationFeeBps),
    extensionFeeBps: BigInt(basket.extensionFeeBps),
    recoveryPenaltyBps: BigInt(basket.recoveryPenaltyBps),
    ltvBps: BigInt(basket.ltvBps),
    constituents: basket.constituents.map((item) => ({
      asset: item.token.address,
      bundleAmount: item.bundleAmount,
      vaultBalance: item.vaultBalance,
    })),
  };
}

async function loadPool(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  basket: Awaited<ReturnType<typeof loadBasketCatalog>>["baskets"][number],
  asset: Address
): Promise<CanonicalPoolRecord | null> {
  const liquidity = deployment.liquidity!;
  const configured = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "canonicalPool",
    args: [basket.basketId, asset],
  });
  if (configured.poolId === zeroHash || configured.hook === zeroAddress) return null;
  const key: V4PoolKey = {
    currency0: getAddress(configured.currency0),
    currency1: getAddress(configured.currency1),
    fee: configured.lpFee,
    tickSpacing: configured.tickSpacing,
    hooks: getAddress(configured.hook),
  };
  if (
    v4PoolId(key) !== configured.poolId ||
    key.hooks !== liquidity.contracts.swapFeeHook ||
    ![key.currency0, key.currency1].includes(basket.token.address) ||
    ![key.currency0, key.currency1].includes(getAddress(asset))
  ) {
    throw new Error("Canonical pool configuration does not match its verified deployment.");
  }
  const [
    assetToken,
    slot0,
    managerHash,
    decommissioned,
    globalFees,
    poolFees,
    pending0,
    pending1,
    locked,
  ] = await Promise.all([
    loadTokenMetadata(publicClient, asset),
    publicClient.readContract({
      address: liquidity.contracts.stateView,
      abi: v4StateViewReadAbi,
      functionName: "getSlot0",
      args: [configured.poolId],
    }),
    publicClient.readContract({
      address: liquidity.contracts.liquidityManager,
      abi: staticsLiquidityManagerAbi,
      functionName: "canonicalPoolHash",
      args: [basket.basketId, asset],
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "poolDecommissioned",
      args: [configured.poolId],
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "feeConfiguration",
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "poolFeeConfiguration",
      args: [configured.poolId],
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "pendingPermanentLiquidity",
      args: [configured.poolId, getAddress(configured.currency0)],
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "pendingPermanentLiquidity",
      args: [configured.poolId, getAddress(configured.currency1)],
    }),
    publicClient.readContract({
      address: liquidity.contracts.swapFeeHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "lockedLiquidity",
      args: [configured.poolId],
    }),
  ]);
  const effective = poolFees.overridden ? poolFees : { ...globalFees, overridden: false };
  return {
    basketId: basket.basketId,
    basketName: basket.name,
    basketSymbol: basket.symbol,
    asset: assetToken,
    basketToken: basket.token,
    poolId: configured.poolId,
    key,
    status: configured.status,
    initializedAt: configured.initializedAt,
    activatedAt: configured.activatedAt,
    referenceTick: configured.referenceTick,
    spotTick: configured.spotTick,
    observationCardinality: configured.observationCardinality,
    decommissioned,
    managerSynced: managerHash === configured.poolId,
    sqrtPriceX96: slot0[0],
    currentTick: slot0[1],
    lpFee: slot0[3],
    hookFees: {
      inputFeeBps: BigInt(effective.inputFeeBps),
      outputFeeBps: BigInt(effective.outputFeeBps),
      polShareBps: BigInt(effective.polShareBps),
      liquidityProviderShareBps: BigInt(effective.liquidityProviderShareBps),
      // The single staker share split into basket and Statics stakers when
      // the hook moved to five-way routing (protocol 4c3fa06).
      basketStakerShareBps: BigInt(effective.basketStakerShareBps),
      staticsStakerShareBps: BigInt(effective.staticsStakerShareBps),
      treasuryShareBps: BigInt(effective.treasuryShareBps),
      overridden: effective.overridden,
    },
    pending0,
    pending1,
    lockedLiquidity: locked,
  };
}

export async function loadLiquidityCatalog(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address
): Promise<LiquidityCatalog> {
  await verifyDollarDeployment(publicClient, deployment);
  const liquidity = await verifyLiquidityDeployment(publicClient, deployment);
  const configuredPoolManager = await publicClient.readContract({
    address: liquidity.contracts.stateView,
    abi: v4StateViewReadAbi,
    functionName: "poolManager",
  });
  if (getAddress(configuredPoolManager) !== liquidity.contracts.poolManager) {
    throw new Error("StateView is not bound to the verified PoolManager.");
  }
  const [basketCatalog, positionCatalog, currentBlock, walletTransfers, stakeEvents] =
    await Promise.all([
      loadBasketCatalog(publicClient, deployment, wallet),
      loadPositionCatalog(publicClient, deployment, wallet),
      publicClient.getBlockNumber(),
      publicClient.getContractEvents({
        address: liquidity.contracts.positionManager,
        abi: v4PositionManagerReadAbi,
        eventName: "Transfer",
        args: { to: wallet },
        fromBlock: deployment.deploymentStartBlock,
        toBlock: "latest",
        strict: true,
      }),
      publicClient.getContractEvents({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        eventName: "LiquidityPositionStaked",
        fromBlock: deployment.deploymentStartBlock,
        toBlock: "latest",
        strict: true,
      }),
    ]);
  const pools = (
    await Promise.all(
      basketCatalog.baskets.flatMap((basket) =>
        basket.constituents.map((constituent) =>
          loadPool(publicClient, deployment, basket, constituent.token.address)
        )
      )
    )
  ).filter((pool): pool is CanonicalPoolRecord => pool !== null);
  const ownedPositionIds = new Set(
    positionCatalog.positions.map((position) => position.positionId.toString())
  );
  const tokenIds = [
    ...new Set([
      ...walletTransfers.map((event) => event.args.tokenId.toString()),
      ...stakeEvents
        .filter((event) => ownedPositionIds.has(event.args.positionId.toString()))
        .map((event) => event.args.tokenId.toString()),
    ]),
  ].map(BigInt);
  const positions = (
    await Promise.all(
      tokenIds.map(async (tokenId): Promise<LpPositionRecord | null> => {
        const [owner, info, liquidityAmount, staked] = await Promise.all([
          publicClient
            .readContract({
              address: liquidity.contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "ownerOf",
              args: [tokenId],
            })
            .catch(() => null),
          publicClient
            .readContract({
              address: liquidity.contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "getPoolAndPositionInfo",
              args: [tokenId],
            })
            .catch(() => null),
          publicClient
            .readContract({
              address: liquidity.contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "getPositionLiquidity",
              args: [tokenId],
            })
            .catch(() => 0n),
          publicClient
            .readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "stakedLiquidityPosition",
              args: [tokenId],
            })
            .catch(() => null),
        ]);
        if (!info) return null;
        const positionInfo = decodePositionInfo(info[1]);
        const key: V4PoolKey = {
          currency0: getAddress(info[0].currency0),
          currency1: getAddress(info[0].currency1),
          fee: info[0].fee,
          tickSpacing: info[0].tickSpacing,
          hooks: getAddress(info[0].hooks),
        };
        const stakedOwned = staked && ownedPositionIds.has(staked.positionId.toString());
        if ((!owner || getAddress(owner) !== wallet) && !stakedOwned) return null;
        return {
          tokenId,
          owner: owner ? getAddress(owner) : deployment.contracts.diamond,
          key,
          poolId: v4PoolId(key),
          tickLower: positionInfo.tickLower,
          tickUpper: positionInfo.tickUpper,
          hasSubscriber: positionInfo.hasSubscriber,
          liquidity: liquidityAmount,
          positionId: staked?.positionId ?? 0n,
          eligibleLiquidity: staked?.eligibleLiquidity ?? 0n,
          pendingLiquidity: staked?.pendingLiquidity ?? 0n,
          eligibleAtBlock: staked?.eligibleAtBlock ?? 0n,
          claimable0: staked?.claimable0 ?? 0n,
          claimable1: staked?.claimable1 ?? 0n,
          staked: staked?.staked ?? false,
        };
      })
    )
  ).filter((position): position is LpPositionRecord => position !== null);
  return {
    pools,
    positions,
    baskets: basketCatalog.baskets,
    positionRecords: positionCatalog.positions,
    positionNftIds: positionCatalog.positions.map((position) => position.positionId),
    currentBlock,
  };
}

export function canonicalStatusLabel(status: number, decommissioned = false): string {
  if (decommissioned) return "exit-only";
  if (status === CanonicalPoolStatus.Active) return "active";
  if (status === CanonicalPoolStatus.Warming) return "warmup";
  return "unconfigured";
}
