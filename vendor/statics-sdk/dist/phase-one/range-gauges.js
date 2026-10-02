import { decodeFunctionResult, encodeFunctionData, parseAbi, } from "viem";
const MAX_UINT40 = (1n << 40n) - 1n;
const MAX_INT128 = (1n << 127n) - 1n;
const MAX_REWARD_SLOT = 4;
const BPS = 10_000;
const MIN_INT24 = -(1 << 23);
const MAX_INT24 = (1 << 23) - 1;
export const staticsRangeGaugeAbi = parseAbi([
    "function setGaugeRewardAssetAllowed(address asset,bool allowed)",
    "function setGaugeRewardDuration(uint40 duration)",
    "function appendPoolRewardAsset(bytes32 poolId,address asset) returns (uint8 slot)",
    "function setPoolRewardAllocatorShare(bytes32 poolId,uint8 slot,uint16 allocatorShareBps)",
    "function fundPoolReward(bytes32 poolId,uint8 slot,uint256 amount,uint40 minRemainingDuration,uint16 expectedAllocatorShareBps) returns (uint256 received)",
    "function installLiquidityManager(address manager)",
    "function replaceLiquidityManager(address newManager)",
    "function provideLiquidity(uint256 positionId,(bytes32 poolId,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 amount0Maximum,uint256 amount1Maximum,uint256 deadline) params) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function attachLiquidity(uint256 positionId,bytes32 poolId,uint256 posmTokenId) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function increaseLiquidity(uint256 positionId,bytes32 poolId,(uint128 liquidity,uint256 amount0Maximum,uint256 amount1Maximum,uint256 deadline) params) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function decreaseLiquidity(uint256 positionId,bytes32 poolId,(uint128 liquidity,uint256 amount0Minimum,uint256 amount1Minimum,uint256 deadline) params) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function collectNativeFees(uint256 positionId,bytes32 poolId,uint256 amount0Minimum,uint256 amount1Minimum,uint256 deadline) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function rebalanceLiquidity(uint256 positionId,bytes32 poolId,(int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 amount0Maximum,uint256 amount1Maximum,uint256 amount0Minimum,uint256 amount1Minimum,uint256 deadline) params) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function exitLiquidity(uint256 positionId,bytes32 poolId,uint256 amount0Minimum,uint256 amount1Minimum,uint256 deadline) returns ((uint256 posmTokenId,uint128 liquidity,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement)",
    "function claimLpRewards(uint256 positionId,bytes32 poolId,uint8[] slots,uint256[] minimumAmounts,address receiver) returns (uint256[] received)",
    "function forfeitLpReward(uint256 positionId,bytes32 poolId,uint8 slot) returns (uint256 amount)",
    "function recoverUnboundPosm(address manager,uint256 posmTokenId,address receiver)",
    "function reconcilePoolRewardSurplus(bytes32 poolId,uint8 slot) returns (uint256 amount)",
    "function gaugeRewardDuration() view returns (uint40 duration)",
    "function gaugeRewardAssetAllowed(address asset) view returns (bool allowed)",
    "function poolRewardConfig(bytes32 poolId) view returns ((bool initialized,uint8 slotCount,address[5] assets,uint16[5] allocatorShareBps) config)",
    "function gaugePool(bytes32 poolId) view returns ((bool initialized,bool stopped,uint40 stoppedAt,int24 referenceTick,uint128 activeGaugeLiquidity,uint64 managedLegCount,uint64 unresolvedLegCount) pool)",
    "function poolRewardStream(bytes32 poolId,uint8 slot) view returns ((bool assigned,uint8 slot,address asset,uint40 periodStart,uint40 periodFinish,uint40 lastUpdate,uint256 periodBudget,uint256 periodEmitted,uint256 periodRecycled,uint256 globalIndexRay,uint256 indexRemainder,uint256 indexedLiability,uint256 claimLiability,uint256 indexCapacityUsed) stream)",
    "function poolRewardCustodyAccount(bytes32 poolId,uint8 slot) view returns (bytes32 account,bool assigned)",
    "function gaugeBoundary(bytes32 poolId,int24 tick) view returns ((uint128 grossLiquidity,int128 netLiquidity,uint256[5] rewardOutsideRay) boundary)",
    "function lpLeg(uint256 positionId,bytes32 poolId) view returns ((address manager,uint256 posmTokenId,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256[5] checkpointInsideRay,uint256[5] rewardRemainderRay,uint256[5] claimable) leg)",
    "function positionGaugePools(uint256 positionId,uint256 cursor,uint256 size) view returns (bytes32[] poolIds,uint256 nextCursor)",
    "function posmBinding(uint256 posmTokenId) view returns (bytes32 binding)",
    "function liquidityManager() view returns (address manager,bool installed)",
    "function recordedLiquidityManager(uint256 positionId,bytes32 poolId) view returns (address manager)",
    "function previewLpRewards(uint256 positionId,bytes32 poolId) view returns ((uint8 slotCount,address[5] assets,uint256[5] amounts) pending)",
    "event GaugeRewardAssetAllowedSet(address indexed asset,bool allowed)",
    "event GaugeRewardDurationSet(uint40 duration)",
    "event PoolRewardAssetAppended(bytes32 indexed poolId,address indexed asset,uint8 indexed slot)",
    "event PoolRewardAllocatorShareSet(bytes32 indexed poolId,uint8 indexed slot,uint16 allocatorShareBps)",
    "event PoolRewardFunded(bytes32 indexed poolId,address indexed asset,address indexed funder,uint8 slot,uint256 received,uint256 lpAmount,uint40 periodFinish)",
    "event PoolAllocatorRewardFunded(bytes32 indexed poolId,address indexed asset,address indexed funder,uint8 slot,uint256 allocatorAmount,uint40 periodFinish)",
    "event ManagedLiquidityProvided(uint256 indexed positionId,bytes32 indexed poolId,uint256 indexed posmTokenId,address manager,int24 tickLower,int24 tickUpper,uint128 liquidity)",
    "event ManagedLiquidityAttached(uint256 indexed positionId,bytes32 indexed poolId,uint256 indexed posmTokenId,address manager,int24 tickLower,int24 tickUpper,uint128 liquidity)",
    "event ManagedLiquidityChanged(uint256 indexed positionId,bytes32 indexed poolId,uint256 indexed posmTokenId,uint128 liquidity)",
    "event ManagedLiquidityRebalanced(uint256 indexed positionId,bytes32 indexed poolId,uint256 indexed oldPosmTokenId,uint256 newPosmTokenId,address manager,int24 tickLower,int24 tickUpper,uint128 liquidity)",
    "event ManagedLiquidityExited(uint256 indexed positionId,bytes32 indexed poolId,uint256 indexed posmTokenId)",
    "event LpRewardsClaimed(uint256 indexed positionId,bytes32 indexed poolId,address indexed asset,uint8 slot,address receiver,uint256 debited,uint256 received)",
    "event LpRewardForfeited(uint256 indexed positionId,bytes32 indexed poolId,address indexed asset,uint8 slot,uint256 amount)",
    "event UnboundPosmRecovered(address indexed manager,uint256 indexed posmTokenId,address indexed receiver)",
    "event PoolRewardSurplusReconciled(bytes32 indexed poolId,address indexed asset,uint8 indexed slot,uint256 amount)",
    "event PoolGaugeStopped(bytes32 indexed poolId)",
    "error ActionPaused(uint256 action)",
    "error InvalidPublicPool(bytes32 poolId)",
    "error PublicPoolDecommissioned(bytes32 poolId)",
    "error GaugeStopped(bytes32 poolId)",
    "error NotPoolCreator(bytes32 poolId,address caller,address creator)",
    "error GaugeRewardAssetNotAllowed(address asset)",
    "error GaugeRewardAssetRestricted(address asset)",
    "error GaugeRewardAssetNotAssigned(bytes32 poolId,address asset)",
    "error GaugeRewardSlotNotAssigned(bytes32 poolId,uint8 slot)",
    "error ProtocolRewardSlotReserved(bytes32 poolId)",
    "error InvalidAllocatorShareBps(uint256 allocatorShareBps)",
    "error AllocatorShareChanged(uint16 expectedAllocatorShareBps,uint16 actualAllocatorShareBps)",
    "error GaugeAllocatorPoolIneligible(bytes32 poolId)",
    "error MinimumRemainingDurationNotMet(uint40 available,uint40 minimum)",
    "error RewardBudgetExceedsIndexCapacity(uint256 committedBudget,uint256 received,uint256 maximumBudget)",
    "error InvalidReceiver(address receiver)",
    "error ArrayLengthMismatch()",
    "error DuplicateRewardSlot(uint8 slot)",
    "error ManagedLegAlreadyExists(uint256 positionId,bytes32 poolId)",
    "error ManagedLegNotFound(uint256 positionId,bytes32 poolId)",
    "error UnauthorizedPositionActor(uint256 positionId,address caller)",
    "error LiquidityManagerNotInstalled()",
    "error LiquidityManagerBindingMismatch(address manager,address expected,address actual)",
    "error NotPosmOwner(uint256 posmTokenId,address caller,address owner)",
    "error PositionMutationMismatch(uint256 posmTokenId)",
    "error InputDebitExceedsMaximum(address asset,uint256 debit,uint256 maximum)",
    "error ManagerAssetTransferMismatch(address asset,uint256 expected,uint256 actual)",
    "error InvalidPositionState(uint256 positionId,bytes32 poolId)",
    "error RewardAmountBelowMinimum(address asset,uint256 received,uint256 minimum)",
    "error PoolRewardReconciliationUnavailable(bytes32 poolId,uint8 slot)",
    "error ClaimLiabilityUnderflow(bytes32 poolId,uint8 slot,uint256 liability,uint256 amount)",
]);
function validateUint(value, maximum, label) {
    if (value < 0n || value > maximum)
        throw new Error(`${label} is out of range`);
    return value;
}
function validateInt24(value, label) {
    if (!Number.isInteger(value) || value < MIN_INT24 || value > MAX_INT24) {
        throw new Error(`${label} is out of int24 range`);
    }
    return value;
}
function validateRange(lower, upper) {
    validateInt24(lower, "tickLower");
    validateInt24(upper, "tickUpper");
    if (lower >= upper)
        throw new Error("tickLower must be less than tickUpper");
}
function validateManagedLiquidity(liquidity) {
    if (liquidity === 0n)
        throw new Error("liquidity must be greater than zero");
    return validateUint(liquidity, MAX_INT128, "liquidity");
}
function validateRewardSlot(slot, allowProtocolSlot) {
    const minimum = allowProtocolSlot ? 0 : 1;
    if (!Number.isInteger(slot) || slot < minimum || slot > MAX_REWARD_SLOT) {
        throw new Error(`slot must be between ${minimum} and ${MAX_REWARD_SLOT}`);
    }
    return slot;
}
function validateProvideParams(params) {
    validateRange(params.tickLower, params.tickUpper);
    validateManagedLiquidity(params.liquidity);
    return params;
}
function validateIncreaseParams(params) {
    validateManagedLiquidity(params.liquidity);
    return params;
}
function validateDecreaseParams(params) {
    validateManagedLiquidity(params.liquidity);
    return params;
}
function validateRebalanceParams(params) {
    validateRange(params.tickLower, params.tickUpper);
    validateManagedLiquidity(params.liquidity);
    return params;
}
export function buildSetGaugeRewardAssetAllowedCall(asset, allowed) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "setGaugeRewardAssetAllowed",
        args: [asset, allowed],
    });
}
export function buildSetGaugeRewardDurationCall(duration) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "setGaugeRewardDuration",
        args: [Number(validateUint(duration, MAX_UINT40, "duration"))],
    });
}
export function buildAppendPoolRewardAssetCall(poolId, asset) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "appendPoolRewardAsset", args: [poolId, asset] });
}
export function buildSetPoolRewardAllocatorShareCall(poolId, slot, allocatorShareBps) {
    if (!Number.isInteger(allocatorShareBps) || allocatorShareBps < 0 || allocatorShareBps > BPS) {
        throw new Error("allocatorShareBps is out of range");
    }
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "setPoolRewardAllocatorShare",
        args: [poolId, validateRewardSlot(slot, false), allocatorShareBps],
    });
}
export function buildFundPoolRewardCall(poolId, slot, amount, minRemainingDuration, expectedAllocatorShareBps) {
    if (!Number.isInteger(expectedAllocatorShareBps) ||
        expectedAllocatorShareBps < 0 ||
        expectedAllocatorShareBps > BPS) {
        throw new Error("expectedAllocatorShareBps is out of range");
    }
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "fundPoolReward",
        args: [
            poolId,
            validateRewardSlot(slot, false),
            amount,
            Number(validateUint(minRemainingDuration, MAX_UINT40, "minRemainingDuration")),
            expectedAllocatorShareBps,
        ],
    });
}
export function buildInstallRangeGaugeLiquidityManagerCall(manager) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "installLiquidityManager", args: [manager] });
}
export function buildReplaceRangeGaugeLiquidityManagerCall(newManager) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "replaceLiquidityManager", args: [newManager] });
}
export function buildProvideRangeLiquidityCall(positionId, params) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "provideLiquidity",
        args: [positionId, validateProvideParams(params)],
    });
}
export function buildAttachRangeLiquidityCall(positionId, poolId, posmTokenId) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "attachLiquidity",
        args: [positionId, poolId, posmTokenId],
    });
}
export function buildIncreaseRangeLiquidityCall(positionId, poolId, params) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "increaseLiquidity",
        args: [positionId, poolId, validateIncreaseParams(params)],
    });
}
export function buildDecreaseRangeLiquidityCall(positionId, poolId, params) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "decreaseLiquidity",
        args: [positionId, poolId, validateDecreaseParams(params)],
    });
}
export function buildCollectRangeNativeFeesCall(positionId, poolId, amount0Minimum, amount1Minimum, deadline) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "collectNativeFees",
        args: [positionId, poolId, amount0Minimum, amount1Minimum, deadline],
    });
}
export function buildRebalanceRangeLiquidityCall(positionId, poolId, params) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "rebalanceLiquidity",
        args: [positionId, poolId, validateRebalanceParams(params)],
    });
}
export function buildExitRangeLiquidityCall(positionId, poolId, amount0Minimum, amount1Minimum, deadline) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "exitLiquidity",
        args: [positionId, poolId, amount0Minimum, amount1Minimum, deadline],
    });
}
export function buildClaimRangeLpRewardsCall(positionId, poolId, slots, minimumAmounts, receiver) {
    if (slots.length !== minimumAmounts.length)
        throw new Error("slots and minimumAmounts length mismatch");
    const validatedSlots = slots.map((slot) => validateRewardSlot(slot, true));
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "claimLpRewards",
        args: [positionId, poolId, validatedSlots, minimumAmounts, receiver],
    });
}
export function buildForfeitRangeLpRewardCall(positionId, poolId, slot) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "forfeitLpReward",
        args: [positionId, poolId, validateRewardSlot(slot, true)],
    });
}
export function buildRecoverUnboundPosmCall(manager, posmTokenId, receiver) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "recoverUnboundPosm",
        args: [manager, posmTokenId, receiver],
    });
}
export function buildReconcilePoolRewardSurplusCall(poolId, slot) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "reconcilePoolRewardSurplus",
        args: [poolId, validateRewardSlot(slot, true)],
    });
}
export function buildGaugeRewardDurationCall() {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "gaugeRewardDuration" });
}
export function buildGaugeRewardAssetAllowedCall(asset) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "gaugeRewardAssetAllowed", args: [asset] });
}
export function buildPoolRewardConfigCall(poolId) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "poolRewardConfig", args: [poolId] });
}
export function buildGaugePoolCall(poolId) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "gaugePool", args: [poolId] });
}
export function buildPoolRewardStreamCall(poolId, slot) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "poolRewardStream",
        args: [poolId, validateRewardSlot(slot, true)],
    });
}
export function buildPoolRewardCustodyAccountCall(poolId, slot) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "poolRewardCustodyAccount",
        args: [poolId, validateRewardSlot(slot, true)],
    });
}
export function buildGaugeBoundaryCall(poolId, tick) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "gaugeBoundary",
        args: [poolId, validateInt24(tick, "tick")],
    });
}
export function buildPositionGaugePoolsCall(positionId, cursor, size) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "positionGaugePools",
        args: [positionId, cursor, size],
    });
}
export function buildRangeGaugeLpLegCall(positionId, poolId) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "lpLeg", args: [positionId, poolId] });
}
export function buildPosmBindingCall(posmTokenId) {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "posmBinding", args: [posmTokenId] });
}
export function buildRangeGaugeLiquidityManagerCall() {
    return encodeFunctionData({ abi: staticsRangeGaugeAbi, functionName: "liquidityManager" });
}
export function buildRecordedLiquidityManagerCall(positionId, poolId) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "recordedLiquidityManager",
        args: [positionId, poolId],
    });
}
export function buildPreviewRangeLpRewardsCall(positionId, poolId) {
    return encodeFunctionData({
        abi: staticsRangeGaugeAbi,
        functionName: "previewLpRewards",
        args: [positionId, poolId],
    });
}
export function isRangeGaugeClaimOnlyLeg(leg) {
    return (leg.liquidity === 0n &&
        (leg.rewardRemainderRay.some((amount) => amount !== 0n) || leg.claimable.some((amount) => amount !== 0n)));
}
export function decodeRangeGaugeLpLegResult(data) {
    const leg = decodeFunctionResult({ abi: staticsRangeGaugeAbi, functionName: "lpLeg", data });
    return { ...leg, claimOnly: isRangeGaugeClaimOnlyLeg(leg) };
}
export function decodeRangeGaugePoolRewardConfigResult(data) {
    return decodeFunctionResult({ abi: staticsRangeGaugeAbi, functionName: "poolRewardConfig", data });
}
export function decodeRangeGaugePoolResult(data) {
    return decodeFunctionResult({ abi: staticsRangeGaugeAbi, functionName: "gaugePool", data });
}
export function decodeRangeGaugeRewardStreamResult(data) {
    return decodeFunctionResult({ abi: staticsRangeGaugeAbi, functionName: "poolRewardStream", data });
}
export function decodeRangeGaugeBoundaryResult(data) {
    return decodeFunctionResult({ abi: staticsRangeGaugeAbi, functionName: "gaugeBoundary", data });
}
export function decodePositionGaugePoolsResult(data) {
    const [poolIds, nextCursor] = decodeFunctionResult({
        abi: staticsRangeGaugeAbi,
        functionName: "positionGaugePools",
        data,
    });
    return { poolIds, nextCursor };
}
export function decodePreviewRangeLpRewardsResult(data) {
    return decodeFunctionResult({ abi: staticsRangeGaugeAbi, functionName: "previewLpRewards", data });
}
