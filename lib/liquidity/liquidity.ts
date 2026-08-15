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
  decodePositionInfo,
  maximumLiquidityForAmounts,
  quoteBorrow,
  quoteBorrowAndProvideLiquidity,
  quoteRangeAmounts,
  staticsAbi,
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
import { loadWalletV4PositionIds } from "@/lib/indexer/statics";

const BPS = 10_000n;
const MAX_POSITION_AMOUNT = (1n << 128n) - 1n;
export const LIQUIDITY_TOLERANCE_BPS = 50n;

export type CanonicalPoolRecord = Readonly<{
  basketId: bigint;
  basketName: string;
  basketSymbol: string;
  asset: TokenMetadata;
  basketToken: TokenMetadata;
  poolId: Hex;
  key: V4PoolKey;
  decommissioned: boolean;
  /** The installed manager validates the protocol pool registry dynamically. */
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

export type LiquidityManageAction = "stake" | "activate" | "increase" | "claim" | "unstake";

export type LiquidityTokenIndex = 0 | 1;

export type WalletLiquidityQuote = Readonly<{
  selectedIndex: LiquidityTokenIndex;
  liquidity: bigint;
  estimatedAmounts: readonly [bigint, bigint];
  maximumAmounts: readonly [bigint, bigint];
}>;

export type MaximumWalletLiquidity = Readonly<{
  inputAmount: bigint;
  limitingIndex: LiquidityTokenIndex;
}>;

export type BorrowLiquidityAllocation = Readonly<{
  poolId: Hex;
  asset: TokenMetadata;
  weightPercent: number;
  liquidity: bigint;
  basketAmount: bigint;
  assetAmount: bigint;
  principal: bigint;
  refund: bigint;
}>;

export type BorrowLiquidityPlan = Readonly<{
  utilizationPercent: number;
  allocations: readonly BorrowLiquidityAllocation[];
  quote: ReturnType<typeof quoteBorrowAndProvideLiquidity>;
}>;

export type LiquidityCatalog = Readonly<{
  pools: readonly CanonicalPoolRecord[];
  positions: readonly LpPositionRecord[];
  baskets: readonly BasketRecord[];
  positionRecords: readonly PositionRecord[];
  positionNftIds: readonly bigint[];
  currentBlock: bigint;
  warnings: readonly string[];
}>;

export function canonicalFullRange(spacing: number): readonly [number, number] {
  return [Math.ceil(-887_272 / spacing) * spacing, Math.floor(887_272 / spacing) * spacing];
}

function orderedPoolTokens(pool: CanonicalPoolRecord): readonly [TokenMetadata, TokenMetadata] {
  return [
    pool.key.currency0 === pool.basketToken.address ? pool.basketToken : pool.asset,
    pool.key.currency1 === pool.basketToken.address ? pool.basketToken : pool.asset,
  ];
}

export function liquidityWalletBalances(
  pool: CanonicalPoolRecord,
  baskets: readonly BasketRecord[]
): readonly [bigint, bigint] | null {
  const basket = baskets.find((candidate) => candidate.basketId === pool.basketId);
  const constituent = basket?.constituents.find(
    (candidate) => candidate.token.address === pool.asset.address
  );
  if (!basket || !constituent) return null;
  const balancesByAddress = new Map<Address, bigint>([
    [basket.token.address, basket.walletBalance],
    [constituent.token.address, constituent.walletBalance],
  ]);
  const tokens = orderedPoolTokens(pool);
  const balance0 = balancesByAddress.get(tokens[0].address);
  const balance1 = balancesByAddress.get(tokens[1].address);
  return balance0 === undefined || balance1 === undefined ? null : [balance0, balance1];
}

export function quoteWalletLiquidity(
  pool: CanonicalPoolRecord,
  selectedIndex: LiquidityTokenIndex,
  selectedMaximum: bigint
): WalletLiquidityQuote | null {
  if (selectedMaximum <= 0n || selectedMaximum > MAX_POSITION_AMOUNT) return null;
  const [tickLower, tickUpper] = canonicalFullRange(pool.key.tickSpacing);
  const capacity = [MAX_POSITION_AMOUNT, MAX_POSITION_AMOUNT] as [bigint, bigint];
  capacity[selectedIndex] = selectedMaximum;
  const maximumLiquidity = maximumLiquidityForAmounts(
    pool.sqrtPriceX96,
    tickLower,
    tickUpper,
    capacity[0],
    capacity[1]
  );
  const liquidity = (maximumLiquidity * (BPS - LIQUIDITY_TOLERANCE_BPS)) / BPS;
  if (maximumLiquidity === 0n || liquidity === 0n) return null;
  const maximumQuote = quoteRangeAmounts(pool.sqrtPriceX96, tickLower, tickUpper, maximumLiquidity);
  const estimatedQuote = quoteRangeAmounts(pool.sqrtPriceX96, tickLower, tickUpper, liquidity);
  const maximumAmounts = [maximumQuote.amount0, maximumQuote.amount1] as [bigint, bigint];
  maximumAmounts[selectedIndex] = selectedMaximum;
  return {
    selectedIndex,
    liquidity,
    estimatedAmounts: [estimatedQuote.amount0, estimatedQuote.amount1],
    maximumAmounts,
  };
}

export function maximumWalletLiquidityInput(
  pool: CanonicalPoolRecord,
  balances: readonly [bigint, bigint],
  selectedIndex: LiquidityTokenIndex
): MaximumWalletLiquidity | null {
  const [tickLower, tickUpper] = canonicalFullRange(pool.key.tickSpacing);
  const limits = balances.map((balance) =>
    balance > MAX_POSITION_AMOUNT ? MAX_POSITION_AMOUNT : balance
  ) as [bigint, bigint];
  if (limits[0] === 0n || limits[1] === 0n) return null;
  const liquidity = maximumLiquidityForAmounts(
    pool.sqrtPriceX96,
    tickLower,
    tickUpper,
    limits[0],
    limits[1]
  );
  if (liquidity === 0n) return null;
  const amounts = quoteRangeAmounts(pool.sqrtPriceX96, tickLower, tickUpper, liquidity);
  const nextAmounts =
    liquidity < MAX_POSITION_AMOUNT
      ? quoteRangeAmounts(pool.sqrtPriceX96, tickLower, tickUpper, liquidity + 1n)
      : amounts;
  const limitingIndex: LiquidityTokenIndex =
    nextAmounts.amount0 > limits[0] ? 0 : nextAmounts.amount1 > limits[1] ? 1 : selectedIndex;
  let inputAmount = selectedIndex === 0 ? amounts.amount0 : amounts.amount1;

  // Integer rounding can let the selected amount represent a slightly larger
  // liquidity plateau than the balance-constrained quote. Step down one token
  // unit when needed so Max always remains executable by both wallet balances.
  const selectedQuote = quoteWalletLiquidity(pool, selectedIndex, inputAmount);
  const otherIndex: LiquidityTokenIndex = selectedIndex === 0 ? 1 : 0;
  if (selectedQuote && selectedQuote.maximumAmounts[otherIndex] > limits[otherIndex]) {
    inputAmount -= 1n;
  }
  return inputAmount > 0n ? { inputAmount, limitingIndex } : null;
}

export function borrowedLiquidityDeadline(blockTimestamp: bigint): bigint {
  return blockTimestamp + 1_200n;
}

export function borrowedLiquidityReadiness(
  basket: Pick<BasketRecord, "constituents"> | undefined,
  pools: readonly CanonicalPoolRecord[],
  plan: BorrowLiquidityPlan | null
): string | null {
  if (!basket || pools.length !== basket.constituents.length) {
    return "Every basket underlying needs a canonical pool.";
  }
  const unavailable = pools.some((pool) => pool.decommissioned || !pool.managerSynced);
  if (unavailable) {
    return "Every canonical pool must be live and synced to the liquidity manager.";
  }
  return plan ? null : "Enter collateral shares to calculate an executable liquidity plan.";
}

/**
 * Converts a borrow quote into an executable, proportional full-range LP plan.
 *
 * Each pool first gets its own principal-constrained upper bound. Advanced
 * weights shape those bounds; a common binary-searched scale then preserves
 * that strategy while accounting for the extra constituent backing required
 * to mint the basket side of every pool. Utilization is applied last.
 */
export function calculateBorrowLiquidityPlan({
  basket,
  sharesIn,
  pools,
  weights = {},
  utilizationPercent = 100,
  deadline,
  slippageBps = 50n,
}: {
  basket: BasketRecord;
  sharesIn: bigint;
  pools: readonly CanonicalPoolRecord[];
  weights?: Readonly<Record<string, number>>;
  utilizationPercent?: number;
  deadline: bigint;
  slippageBps?: bigint;
}): BorrowLiquidityPlan | null {
  if (
    sharesIn <= 0n ||
    pools.length !== basket.constituents.length ||
    !Number.isInteger(utilizationPercent) ||
    utilizationPercent < 1 ||
    utilizationPercent > 100
  ) {
    return null;
  }
  const snapshot = basketLiquiditySnapshot(basket);
  let borrow: ReturnType<typeof quoteBorrow>;
  try {
    borrow = quoteBorrow(snapshot, sharesIn);
  } catch {
    return null;
  }
  const bases = pools.map((pool) => {
    const principal =
      borrow.principals.find(
        (item) => item.asset.toLowerCase() === pool.asset.address.toLowerCase()
      )?.amount ?? 0n;
    const weightPercent = weights[pool.poolId] ?? 100;
    if (!Number.isInteger(weightPercent) || weightPercent < 1 || weightPercent > 100) return null;
    const [tickLower, tickUpper] = canonicalFullRange(pool.key.tickSpacing);
    const assetIsCurrency0 = pool.key.currency0 === pool.asset.address;
    const maximum = maximumLiquidityForAmounts(
      pool.sqrtPriceX96,
      tickLower,
      tickUpper,
      assetIsCurrency0 ? principal : MAX_POSITION_AMOUNT,
      assetIsCurrency0 ? MAX_POSITION_AMOUNT : principal
    );
    const weighted = (maximum * BigInt(weightPercent)) / 100n;
    if (weighted <= 0n) return null;
    return { pool, principal, weightPercent, tickLower, tickUpper, weighted };
  });
  if (bases.some((item) => item === null)) return null;
  const validBases = bases as readonly NonNullable<(typeof bases)[number]>[];
  const SCALE = 1_000_000n;
  const inputsAt = (scale: bigint) =>
    validBases.map(({ pool, tickLower, tickUpper, weighted }) => ({
      asset: pool.asset.address,
      currency0: pool.key.currency0,
      currency1: pool.key.currency1,
      sqrtPriceX96: pool.sqrtPriceX96,
      tickLower,
      tickUpper,
      liquidity: (weighted * scale) / SCALE,
      deadline,
    }));
  const executable = (scale: bigint) => {
    const inputs = inputsAt(scale);
    if (inputs.some((input) => input.liquidity <= 0n)) return false;
    try {
      quoteBorrowAndProvideLiquidity(snapshot, sharesIn, inputs, slippageBps);
      return true;
    } catch {
      return false;
    }
  };
  let low = 0n;
  let high = SCALE;
  while (low < high) {
    const midpoint = (low + high + 1n) >> 1n;
    if (executable(midpoint)) low = midpoint;
    else high = midpoint - 1n;
  }
  if (low === 0n) return null;
  const utilizedScale = (low * BigInt(utilizationPercent)) / 100n;
  const inputs = inputsAt(utilizedScale);
  if (inputs.some((input) => input.liquidity <= 0n)) return null;
  let quote: ReturnType<typeof quoteBorrowAndProvideLiquidity>;
  try {
    quote = quoteBorrowAndProvideLiquidity(snapshot, sharesIn, inputs, slippageBps);
  } catch {
    return null;
  }
  return {
    utilizationPercent,
    quote,
    allocations: validBases.map(({ pool, principal, weightPercent }, index) => {
      const quotedPool = quote.pools[index]!;
      const amounts = quoteRangeAmounts(
        pool.sqrtPriceX96,
        quotedPool.tickLower,
        quotedPool.tickUpper,
        quotedPool.liquidity
      );
      const assetAmount =
        pool.key.currency0.toLowerCase() === pool.asset.address.toLowerCase()
          ? amounts.amount0
          : amounts.amount1;
      const basketAmount =
        pool.key.currency0.toLowerCase() === pool.asset.address.toLowerCase()
          ? amounts.amount1
          : amounts.amount0;
      const total = quote.totalPrincipalRequirements.find(
        (item) => item.asset.toLowerCase() === pool.asset.address.toLowerCase()
      );
      return {
        poolId: pool.poolId,
        asset: pool.asset,
        weightPercent,
        liquidity: quotedPool.liquidity,
        basketAmount,
        assetAmount,
        principal,
        refund: total?.refund ?? 0n,
      };
    }),
  };
}

export function liquidityPositionActions(
  position: LpPositionRecord | undefined,
  currentBlock: bigint
): readonly LiquidityManageAction[] {
  if (!position) return [];
  if (!position.staked) return ["stake"];
  const actions: LiquidityManageAction[] = [];
  if (position.pendingLiquidity > 0n && currentBlock >= position.eligibleAtBlock) {
    actions.push("activate");
  }
  actions.push("increase", "claim", "unstake");
  return actions;
}

export function recommendedLiquidityAction(
  position: LpPositionRecord,
  currentBlock: bigint
): LiquidityManageAction {
  return liquidityPositionActions(position, currentBlock)[0] ?? "unstake";
}

export function liquidityActivationWait(
  position: LpPositionRecord | undefined,
  currentBlock: bigint
): bigint | null {
  if (
    !position?.staked ||
    position.pendingLiquidity === 0n ||
    currentBlock >= position.eligibleAtBlock
  ) {
    return null;
  }
  return position.eligibleAtBlock - currentBlock;
}

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
  asset: Address,
  blockNumber: bigint
): Promise<CanonicalPoolRecord | null> {
  const liquidity = deployment.liquidity!;
  const configured = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "canonicalPool",
    args: [basket.basketId, asset],
    blockNumber,
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
  const [assetToken, slot0, decommissioned, globalFees, poolFees, pending0, pending1, locked] =
    await Promise.all([
      loadTokenMetadata(publicClient, asset, undefined, blockNumber),
      publicClient.readContract({
        address: liquidity.contracts.stateView,
        abi: v4StateViewReadAbi,
        functionName: "getSlot0",
        args: [configured.poolId],
        blockNumber,
      }),
      publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "poolDecommissioned",
        args: [configured.poolId],
        blockNumber,
      }),
      publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "feeConfiguration",
        blockNumber,
      }),
      publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "poolFeeConfiguration",
        args: [configured.poolId],
        blockNumber,
      }),
      publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "pendingPermanentLiquidity",
        args: [configured.poolId, getAddress(configured.currency0)],
        blockNumber,
      }),
      publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "pendingPermanentLiquidity",
        args: [configured.poolId, getAddress(configured.currency1)],
        blockNumber,
      }),
      publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "lockedLiquidity",
        args: [configured.poolId],
        blockNumber,
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
    decommissioned,
    managerSynced: true,
    sqrtPriceX96: slot0[0],
    currentTick: slot0[1],
    lpFee: slot0[3],
    hookFees: {
      inputFeeBps: BigInt(effective.inputFeeBps),
      outputFeeBps: BigInt(effective.outputFeeBps),
      lockedLiquidityShareBps: BigInt(effective.lockedLiquidityShareBps),
      liquidityProviderShareBps: BigInt(effective.liquidityProviderShareBps),
      basketStakerShareBps: BigInt(effective.basketStakerShareBps),
      staticsStakerShareBps: BigInt(effective.staticsStakerShareBps),
      stonkBrokersShareBps: BigInt(effective.stonkBrokersShareBps),
      indexCreatorShareBps: BigInt(effective.indexCreatorShareBps),
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
  const currentBlock = await publicClient.getBlockNumber({ cacheTime: 0 });
  const configuredPoolManager = await publicClient.readContract({
    address: liquidity.contracts.stateView,
    abi: v4StateViewReadAbi,
    functionName: "poolManager",
    blockNumber: currentBlock,
  });
  if (getAddress(configuredPoolManager) !== liquidity.contracts.poolManager) {
    throw new Error("StateView is not bound to the verified PoolManager.");
  }
  const [basketCatalog, positionCatalog] = await Promise.all([
    loadBasketCatalog(publicClient, deployment, wallet, currentBlock),
    loadPositionCatalog(publicClient, deployment, wallet, currentBlock),
  ]);
  const warnings: string[] = [];
  let walletTokenIds: bigint[] = [];
  try {
    walletTokenIds = await loadWalletV4PositionIds(wallet);
  } catch {
    warnings.push(
      "External wallet liquidity-position discovery is temporarily unavailable; protocol-staked positions are still shown."
    );
  }
  const pools = (
    await Promise.all(
      basketCatalog.baskets.flatMap((basket) =>
        basket.constituents.map((constituent) =>
          loadPool(publicClient, deployment, basket, constituent.token.address, currentBlock)
        )
      )
    )
  ).filter((pool): pool is CanonicalPoolRecord => pool !== null);
  const ownedPositionIds = new Set(
    positionCatalog.positions.map((position) => position.positionId.toString())
  );
  const stakedTokenIds = positionCatalog.positions.flatMap(
    (position) => position.liquidityPositionIds
  );
  const tokenIds = [...new Set([...walletTokenIds, ...stakedTokenIds].map(String))].map(BigInt);
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
              blockNumber: currentBlock,
            })
            .catch(() => null),
          publicClient
            .readContract({
              address: liquidity.contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "getPoolAndPositionInfo",
              args: [tokenId],
              blockNumber: currentBlock,
            })
            .catch(() => null),
          publicClient
            .readContract({
              address: liquidity.contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "getPositionLiquidity",
              args: [tokenId],
              blockNumber: currentBlock,
            })
            .catch(() => 0n),
          publicClient
            .readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "stakedLiquidityPosition",
              args: [tokenId],
              blockNumber: currentBlock,
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
        const pendingRewards = stakedOwned
          ? await publicClient.readContract({
              account: wallet,
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "pendingLiquidityRewards",
              args: [staked.positionId, tokenId],
              blockNumber: currentBlock,
            })
          : null;
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
          claimable0: pendingRewards?.[1] ?? 0n,
          claimable1: pendingRewards?.[3] ?? 0n,
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
    warnings,
  };
}

export function canonicalPoolLabel(decommissioned: boolean): "active" | "exit-only" {
  return decommissioned ? "exit-only" : "active";
}
