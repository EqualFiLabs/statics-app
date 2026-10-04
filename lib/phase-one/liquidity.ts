import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  maxUint256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  buildApproveV4PositionCall,
  buildAttachRangeLiquidityCall,
  buildCollectRangeNativeFeesCall,
  buildCreatePositionCall,
  buildDecreaseRangeLiquidityCall,
  buildExitRangeLiquidityCall,
  buildIncreaseRangeLiquidityCall,
  buildProvideRangeLiquidityCall,
  buildRebalanceRangeLiquidityCall,
  decodePositionInfo,
  maximumLiquidityForAmounts,
  quoteRangeAmounts,
  staticsAbi,
  staticsRangeGaugeAbi,
  v4PositionManagerReadAbi,
  type RangeGaugeLpLegState,
  type RangeGaugePendingRewards,
} from "@statics-protocol/sdk/phase-one";

import { swapDeadlineBase } from "@/lib/trade/canonical-market";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { samePoolKey, type PublicPoolSelection } from "@/lib/phase-one/pools";

const MIN_TICK = -887_272;
const MAX_TICK = 887_272;
const MAX_UINT128 = (1n << 128n) - 1n;
const BPS = 10_000n;

export type PublicLiquidityRange = Readonly<{
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  inRange: boolean;
}>;

export type PublicLiquidityQuote = Readonly<{
  liquidity: bigint;
  estimatedAmount0: bigint;
  estimatedAmount1: bigint;
  maximumAmount0: bigint;
  maximumAmount1: bigint;
  range: PublicLiquidityRange;
}>;

export type PublicLiquidityApproval = Readonly<{
  token: Address;
  spender: Address;
  required: bigint;
  allowance: bigint;
  needed: boolean;
  target: Address;
  calldata: Hex;
}>;

export type AttachableV4Position = Readonly<{
  tokenId: bigint;
  owner: Address;
  poolId: Hex;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  hasSubscriber: boolean;
  compatible: boolean;
  blockers: readonly string[];
}>;

export type PublicManagedLiquidityPosition = Readonly<{
  positionId: bigint;
  poolId: Hex;
  leg: RangeGaugeLpLegState;
  rewards: RangeGaugePendingRewards;
  claimOnly: boolean;
  canExitLiquidity: boolean;
  closeBlockers: readonly string[];
}>;

export function usableTickBounds(tickSpacing: number): readonly [number, number] {
  if (!Number.isInteger(tickSpacing) || tickSpacing <= 0 || tickSpacing > 32_767) {
    throw new Error("Tick spacing must be between 1 and 32767.");
  }
  return [
    Math.ceil(MIN_TICK / tickSpacing) * tickSpacing,
    Math.floor(MAX_TICK / tickSpacing) * tickSpacing,
  ];
}

export function validatePublicLiquidityRange(
  tickLower: number,
  tickUpper: number,
  tickSpacing: number,
  currentTick: number
): PublicLiquidityRange {
  const [minimum, maximum] = usableTickBounds(tickSpacing);
  if (!Number.isInteger(tickLower) || !Number.isInteger(tickUpper)) {
    throw new Error("Liquidity ticks must be integers.");
  }
  if (tickLower < minimum || tickUpper > maximum || tickLower >= tickUpper) {
    throw new Error("Liquidity range is outside the usable pool ticks.");
  }
  if (tickLower % tickSpacing !== 0 || tickUpper % tickSpacing !== 0) {
    throw new Error("Liquidity range must align to the pool tick spacing.");
  }
  return {
    tickLower,
    tickUpper,
    currentTick,
    inRange: currentTick >= tickLower && currentTick < tickUpper,
  };
}

export function quotePublicLiquidity(input: {
  sqrtPriceX96: bigint;
  currentTick: number;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  amount0Maximum: bigint;
  amount1Maximum: bigint;
  toleranceBps?: number;
}): PublicLiquidityQuote {
  const range = validatePublicLiquidityRange(
    input.tickLower,
    input.tickUpper,
    input.tickSpacing,
    input.currentTick
  );
  const toleranceBps = input.toleranceBps ?? 50;
  if (!Number.isInteger(toleranceBps) || toleranceBps < 0 || toleranceBps > 5_000) {
    throw new Error("Liquidity tolerance must be between 0 and 5000 bps.");
  }
  if (
    input.amount0Maximum < 0n ||
    input.amount1Maximum < 0n ||
    (input.amount0Maximum === 0n && input.amount1Maximum === 0n)
  ) {
    throw new Error("At least one positive token maximum is required.");
  }
  const maximumLiquidity = maximumLiquidityForAmounts(
    input.sqrtPriceX96,
    input.tickLower,
    input.tickUpper,
    input.amount0Maximum,
    input.amount1Maximum
  );
  const liquidity = (maximumLiquidity * BigInt(10_000 - toleranceBps)) / BPS;
  if (liquidity <= 0n || liquidity > MAX_UINT128) {
    throw new Error("The selected amounts cannot create positive uint128 liquidity.");
  }
  const amounts = quoteRangeAmounts(
    input.sqrtPriceX96,
    input.tickLower,
    input.tickUpper,
    liquidity
  );
  return {
    liquidity,
    estimatedAmount0: amounts.amount0,
    estimatedAmount1: amounts.amount1,
    maximumAmount0: input.amount0Maximum,
    maximumAmount1: input.amount1Maximum,
    range,
  };
}

export function planPublicLiquidityApprovals(input: {
  deployment: PhaseOneDeployment;
  pool: PublicPoolSelection;
  amount0Maximum: bigint;
  amount1Maximum: bigint;
  allowance0: bigint;
  allowance1: bigint;
}): readonly PublicLiquidityApproval[] {
  return [
    [input.pool.poolKey.currency0, input.amount0Maximum, input.allowance0],
    [input.pool.poolKey.currency1, input.amount1Maximum, input.allowance1],
  ].map(([token, required, allowance]) => ({
    token: token as Address,
    spender: input.deployment.contracts.diamond,
    required: required as bigint,
    allowance: allowance as bigint,
    needed: (allowance as bigint) < (required as bigint),
    target: token as Address,
    calldata: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [input.deployment.contracts.diamond, maxUint256],
    }),
  }));
}

export async function buildCreatePositionNftTransaction(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  receiver: Address;
}): Promise<Readonly<{ target: Address; calldata: Hex; value: bigint }>> {
  const value = await input.publicClient.readContract({
    address: input.deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "positionCreationFee",
  });
  return {
    target: input.deployment.contracts.diamond,
    calldata: buildCreatePositionCall(input.receiver),
    value,
  };
}

export function buildProvidePublicLiquidityTransaction(input: {
  deployment: PhaseOneDeployment;
  pool: PublicPoolSelection;
  positionId: bigint;
  quote: PublicLiquidityQuote;
  deadline: bigint;
}): Readonly<{ target: Address; calldata: Hex; value: 0n }> {
  return {
    target: input.deployment.contracts.diamond,
    calldata: buildProvideRangeLiquidityCall(input.positionId, {
      poolId: input.pool.poolId,
      tickLower: input.quote.range.tickLower,
      tickUpper: input.quote.range.tickUpper,
      liquidity: input.quote.liquidity,
      amount0Maximum: input.quote.maximumAmount0,
      amount1Maximum: input.quote.maximumAmount1,
      deadline: input.deadline,
    }),
    value: 0n,
  };
}

export async function inspectAttachableV4Position(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  pool: PublicPoolSelection;
  owner: Address;
  tokenId: bigint;
}): Promise<AttachableV4Position> {
  const [owner, position] = await Promise.all([
    input.publicClient.readContract({
      address: input.deployment.contracts.positionManager,
      abi: v4PositionManagerReadAbi,
      functionName: "ownerOf",
      args: [input.tokenId],
    }),
    input.publicClient.readContract({
      address: input.deployment.contracts.positionManager,
      abi: v4PositionManagerReadAbi,
      functionName: "getPoolAndPositionInfo",
      args: [input.tokenId],
    }),
  ]);
  const liquidity = await input.publicClient.readContract({
    address: input.deployment.contracts.positionManager,
    abi: v4PositionManagerReadAbi,
    functionName: "getPositionLiquidity",
    args: [input.tokenId],
  });
  const decoded = decodePositionInfo(position[1]);
  const blockers: string[] = [];
  if (getAddress(owner) !== getAddress(input.owner))
    blockers.push("Wallet does not own this PositionManager NFT.");
  if (!samePoolKey(position[0], input.pool.poolKey))
    blockers.push("Position PoolKey does not match the selected pool.");
  if (decoded.hasSubscriber) blockers.push("Position already has a subscriber.");
  if (liquidity === 0n) blockers.push("Position has no liquidity.");
  return {
    tokenId: input.tokenId,
    owner: getAddress(owner),
    poolId: input.pool.poolId,
    tickLower: decoded.tickLower,
    tickUpper: decoded.tickUpper,
    liquidity,
    hasSubscriber: decoded.hasSubscriber,
    compatible: blockers.length === 0,
    blockers,
  };
}

export function buildAttachPublicLiquidityTransactions(input: {
  deployment: PhaseOneDeployment;
  pool: PublicPoolSelection;
  positionId: bigint;
  position: AttachableV4Position;
}): readonly Readonly<{ kind: "approve" | "attach"; target: Address; calldata: Hex; value: 0n }>[] {
  if (
    !input.position.compatible ||
    input.position.poolId.toLowerCase() !== input.pool.poolId.toLowerCase()
  ) {
    throw new Error("The PositionManager NFT is not compatible with the selected public pool.");
  }
  return [
    {
      kind: "approve",
      target: input.deployment.contracts.positionManager,
      calldata: buildApproveV4PositionCall(
        input.deployment.contracts.liquidityManager,
        input.position.tokenId
      ),
      value: 0n,
    },
    {
      kind: "attach",
      target: input.deployment.contracts.diamond,
      calldata: buildAttachRangeLiquidityCall(
        input.positionId,
        input.pool.poolId,
        input.position.tokenId
      ),
      value: 0n,
    },
  ];
}

export type PublicLiquidityChange =
  | Readonly<{
      kind: "increase";
      liquidity: bigint;
      amount0Maximum: bigint;
      amount1Maximum: bigint;
    }>
  | Readonly<{
      kind: "decrease";
      liquidity: bigint;
      amount0Minimum: bigint;
      amount1Minimum: bigint;
    }>
  | Readonly<{ kind: "collect"; amount0Minimum: bigint; amount1Minimum: bigint }>
  | Readonly<{
      kind: "rebalance";
      tickLower: number;
      tickUpper: number;
      liquidity: bigint;
      amount0Maximum: bigint;
      amount1Maximum: bigint;
      amount0Minimum: bigint;
      amount1Minimum: bigint;
    }>
  | Readonly<{ kind: "exit"; amount0Minimum: bigint; amount1Minimum: bigint }>;

export function buildPublicLiquidityChangeTransaction(input: {
  deployment: PhaseOneDeployment;
  pool: PublicPoolSelection;
  positionId: bigint;
  deadline: bigint;
  change: PublicLiquidityChange;
}): Readonly<{ target: Address; calldata: Hex; value: 0n }> {
  let calldata: Hex;
  switch (input.change.kind) {
    case "increase":
      calldata = buildIncreaseRangeLiquidityCall(input.positionId, input.pool.poolId, {
        liquidity: input.change.liquidity,
        amount0Maximum: input.change.amount0Maximum,
        amount1Maximum: input.change.amount1Maximum,
        deadline: input.deadline,
      });
      break;
    case "decrease":
      calldata = buildDecreaseRangeLiquidityCall(input.positionId, input.pool.poolId, {
        liquidity: input.change.liquidity,
        amount0Minimum: input.change.amount0Minimum,
        amount1Minimum: input.change.amount1Minimum,
        deadline: input.deadline,
      });
      break;
    case "collect":
      calldata = buildCollectRangeNativeFeesCall(
        input.positionId,
        input.pool.poolId,
        input.change.amount0Minimum,
        input.change.amount1Minimum,
        input.deadline
      );
      break;
    case "rebalance":
      validatePublicLiquidityRange(
        input.change.tickLower,
        input.change.tickUpper,
        input.pool.poolKey.tickSpacing,
        input.change.tickLower
      );
      calldata = buildRebalanceRangeLiquidityCall(input.positionId, input.pool.poolId, {
        ...input.change,
        deadline: input.deadline,
      });
      break;
    case "exit":
      calldata = buildExitRangeLiquidityCall(
        input.positionId,
        input.pool.poolId,
        input.change.amount0Minimum,
        input.change.amount1Minimum,
        input.deadline
      );
      break;
  }
  return { target: input.deployment.contracts.diamond, calldata, value: 0n };
}

export async function readPublicManagedLiquidityPosition(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: Hex;
}): Promise<PublicManagedLiquidityPosition> {
  const [leg, rewards] = await Promise.all([
    input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsRangeGaugeAbi,
      functionName: "lpLeg",
      args: [input.positionId, input.poolId],
    }),
    input.publicClient.readContract({
      address: input.deployment.contracts.diamond,
      abi: staticsRangeGaugeAbi,
      functionName: "previewLpRewards",
      args: [input.positionId, input.poolId],
    }),
  ]);
  const claimOnly =
    leg.liquidity === 0n &&
    (leg.rewardRemainderRay.some((amount) => amount !== 0n) ||
      leg.claimable.some((amount) => amount !== 0n));
  const pendingReward = rewards.amounts.some((amount) => amount !== 0n);
  const fractionalRemainder = leg.rewardRemainderRay.some((amount) => amount !== 0n);
  const closeBlockers = [
    ...(leg.liquidity !== 0n ? ["Exit the managed liquidity position."] : []),
    ...(pendingReward ? ["Claim or forfeit every pending LP reward."] : []),
    ...(fractionalRemainder ? ["Resolve every fractional LP reward remainder."] : []),
  ];
  return {
    positionId: input.positionId,
    poolId: input.poolId,
    leg: { ...leg, claimOnly },
    rewards,
    claimOnly,
    canExitLiquidity: leg.liquidity > 0n,
    closeBlockers,
  };
}

export async function publicLiquidityDeadline(publicClient: PublicClient): Promise<bigint> {
  const [latest, pending] = await Promise.all([
    publicClient.getBlock(),
    publicClient.getBlock({ blockTag: "pending" }),
  ]);
  return (
    swapDeadlineBase(latest.timestamp, pending.timestamp, BigInt(Math.floor(Date.now() / 1000))) +
    1200n
  );
}
