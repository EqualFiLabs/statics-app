import { decodeFunctionResult, encodeFunctionData, parseAbi, } from "viem";
export const MAX_GAUGE_ALLOCATIONS_PER_POSITION = 16;
export const MAX_WEEKLY_GAUGE_RELEASE_BPS = 1_000;
export const MAX_GAUGE_CATCHUP_PERIODS = 52;
export const DEFAULT_GAUGE_ALLOCATION_COOLDOWN = 4n * 60n * 60n;
const MAX_UINT40 = (1n << 40n) - 1n;
export const staticsGaugeIncentivesAbi = parseAbi([
    "function fundGaugeReserve(uint256 amount) returns (uint256 received)",
    "function activateGaugeSchedule() returns (uint256 budget)",
    "function setGaugeAllocations(uint256 positionId,bytes32[] poolIds,uint256[] amounts)",
    "function checkpointGaugeSchedule(uint16 maxPeriods) returns (uint64 period,uint16 periodsProcessed,uint256 newlyAccounted)",
    "function checkpointGaugePool(bytes32 poolId) returns (uint256 credited,uint256 recycled)",
    "function scheduleGaugeReleaseBps(uint16 releaseBps)",
    "function setGaugeAllocationCooldown(uint40 cooldown)",
    "function syncGaugeAllocationsAfterStakeLoss(uint256 positionId,uint256 remainingStake)",
    "function claimGaugeAllocatorRewards(uint256 positionId,bytes32 poolId,uint8[] slots,uint256[] minimumAmounts,address receiver) returns (uint256[] received)",
    "function forfeitGaugeAllocatorReward(uint256 positionId,bytes32 poolId,uint8 slot) returns (uint256 amount)",
    "function currentGaugePeriod() view returns (uint64 period)",
    "function gaugePeriodAt(uint256 timestamp) view returns (uint64 period,bool active)",
    "function gaugeReserve() view returns ((bool activated,uint16 releaseBps,uint16 pendingReleaseBps,uint40 pendingReleaseAt,uint40 deferredMaturityAt,uint40 scheduleStart,uint40 lastCheckpoint,uint40 periodStart,uint40 periodFinish,uint64 currentPeriod,uint40 allocationCooldown,uint256 available,uint256 deferred,uint256 committed,uint256 periodBudget,uint256 periodAccounted,uint256 totalAllocatedWeight,uint256 globalIndexX160,uint256 unsettledRoutingLiability) state)",
    "function gaugePoolWeight(bytes32 poolId) view returns ((uint256 weight,bytes32 storedVersion,bytes32 currentVersion,uint64 restrictionSequence,uint256 indexCursorX160,uint256 pendingReward,bool stale) state)",
    "function gaugePositionAllocations(uint256 positionId) view returns (uint40 nextAllocationAt,uint256 totalAllocated,(bytes32 poolId,uint256 amount,bytes32 eligibilityVersion)[] active,uint256 lockedStake)",
    "function previewGaugePoolReward(bytes32 poolId) view returns (uint256 amount,bool eligible)",
    "function maxGaugeAllocationsPerPosition() pure returns (uint256)",
    "function maxWeeklyGaugeReleaseBps() pure returns (uint16)",
    "function maxGaugeCatchupPeriods() pure returns (uint16)",
    "function gaugeAllocationCooldown() view returns (uint40 cooldown)",
    "function gaugeAllocatorReward(bytes32 poolId,uint8 slot) view returns ((address asset,bytes32 eligibilityVersion,uint64 fundingRestrictionSequence,uint40 periodStart,uint40 periodFinish,uint40 lastUpdate,uint256 periodBudget,uint256 periodEmitted,uint256 globalIndexX160,uint256 indexedLiability,uint256 claimLiability,bool terminated) state)",
    "function previewGaugeAllocatorRewards(uint256 positionId,bytes32 poolId,uint8[] slots) view returns ((uint8 slot,address asset,uint256 allocation,uint256 amount)[] rewards)",
    "event GaugeReserveFunded(address indexed funder,uint256 amount,uint40 indexed maturityAt)",
    "event GaugeScheduleActivated(uint40 indexed scheduleStart,uint40 indexed firstPeriodFinish,uint256 budget)",
    "event GaugeReleaseBpsScheduled(uint16 releaseBps,uint40 indexed effectiveAt)",
    "event GaugeAllocationCooldownSet(uint40 cooldown)",
    "event PositionGaugeAllocationsSet(uint256 indexed positionId,uint40 indexed nextAllocationAt,uint256 totalAllocated)",
    "event PositionGaugeAllocationCooldownExtended(uint256 indexed positionId,uint40 indexed nextAllocationAt)",
    "event PositionGaugeAllocationsClearedByStakeLoss(uint256 indexed positionId,uint256 remainingStake)",
    "event GaugePeriodStarted(uint64 indexed period,uint40 indexed start,uint40 indexed finish,uint16 releaseBps,uint256 budget,uint256 totalAllocatedWeight)",
    "event ProtocolGaugeRewardCredited(bytes32 indexed poolId,uint256 amount)",
    "event ProtocolGaugeRewardRecycled(bytes32 indexed poolId,uint256 amount)",
    "event GaugeAllocatorRewardClaimed(uint256 indexed positionId,bytes32 indexed poolId,uint8 indexed slot,address asset,address receiver,uint256 debited,uint256 received)",
    "event GaugeAllocatorRewardForfeited(uint256 indexed positionId,bytes32 indexed poolId,uint8 indexed slot,address asset,uint256 amount)",
    "error InvalidGaugeFundingAmount()",
    "error IncompatibleGaugeTokenTransfer(uint256 requested,uint256 received)",
    "error GaugeAllocationLengthMismatch()",
    "error GaugeAllocationLimitExceeded(uint256 count,uint256 maximum)",
    "error InvalidGaugeAllocation(bytes32 poolId,uint256 amount)",
    "error DuplicateGaugeAllocation(bytes32 poolId)",
    "error GaugeAllocationExceedsStake(uint256 allocated,uint256 staked)",
    "error GaugeSelfCallOnly(address caller)",
    "error InvalidGaugeAllocatorSlot(bytes32 poolId,uint8 slot)",
    "error GaugeAllocatorClaimLengthMismatch()",
    "error DuplicateGaugeAllocatorSlot(uint8 slot)",
    "error InvalidGaugeAllocatorReceiver(address receiver)",
    "error GaugeAllocatorAmountBelowMinimum(address asset,uint256 received,uint256 minimum)",
    "error GaugeAllocatorLiabilityUnderflow(bytes32 poolId,uint8 slot,uint256 liability,uint256 amount)",
    "error InvalidGaugeTimestamp(uint256 timestamp)",
    "error GaugeScheduleAlreadyActivated()",
    "error GaugeScheduleCatchupRequired(uint40 checkpointedAt,uint40 requestedAt)",
    "error GaugeCatchupLimitInvalid(uint256 requested,uint256 maximum)",
    "error GaugeAllocationIncreaseDuringCooldown(bytes32 poolId,uint256 priorAmount,uint256 nextAmount)",
    "error GaugeReserveAlreadyInitialized()",
    "error InvalidGaugeReleaseBps(uint256 releaseBps)",
    "error GaugeReserveUnderflow(uint256 requested,uint256 available)",
    "error GaugeCommitmentUnderflow(uint256 requested,uint256 committed)",
    "error DeferredMaturityMismatch(uint40 storedMaturity,uint40 requestedMaturity)",
]);
function validateUint40(value, label) {
    if (value < 0n || value > MAX_UINT40)
        throw new Error(`${label} is out of range`);
    return Number(value);
}
function validateAllocatorSlot(slot) {
    if (!Number.isInteger(slot) || slot < 1 || slot > 4)
        throw new Error("allocator slot must be between 1 and 4");
    return slot;
}
export function buildFundGaugeReserveCall(amount) {
    if (amount <= 0n)
        throw new Error("amount must be greater than zero");
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "fundGaugeReserve", args: [amount] });
}
export function buildActivateGaugeScheduleCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "activateGaugeSchedule" });
}
export function buildSetGaugeAllocationsCall(positionId, poolIds, amounts) {
    if (poolIds.length !== amounts.length)
        throw new Error("poolIds and amounts length mismatch");
    if (poolIds.length > MAX_GAUGE_ALLOCATIONS_PER_POSITION)
        throw new Error("too many gauge allocations");
    const seen = new Set();
    for (let index = 0; index < poolIds.length; index += 1) {
        const poolId = poolIds[index];
        if (seen.has(poolId))
            throw new Error("duplicate gauge allocation");
        seen.add(poolId);
        if (amounts[index] === 0n)
            throw new Error("allocation amount must be greater than zero");
    }
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "setGaugeAllocations",
        args: [positionId, poolIds, amounts],
    });
}
export function buildCheckpointGaugeScheduleCall(maxPeriods) {
    if (!Number.isInteger(maxPeriods) || maxPeriods < 1 || maxPeriods > MAX_GAUGE_CATCHUP_PERIODS) {
        throw new Error("maxPeriods is out of range");
    }
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "checkpointGaugeSchedule",
        args: [maxPeriods],
    });
}
export function buildCheckpointGaugePoolCall(poolId) {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "checkpointGaugePool", args: [poolId] });
}
export function buildScheduleGaugeReleaseBpsCall(releaseBps) {
    if (!Number.isInteger(releaseBps) || releaseBps < 0 || releaseBps > MAX_WEEKLY_GAUGE_RELEASE_BPS) {
        throw new Error("releaseBps is out of range");
    }
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "scheduleGaugeReleaseBps",
        args: [releaseBps],
    });
}
export function buildSetGaugeAllocationCooldownCall(cooldown) {
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "setGaugeAllocationCooldown",
        args: [validateUint40(cooldown, "cooldown")],
    });
}
export function buildClaimGaugeAllocatorRewardsCall(positionId, poolId, slots, minimumAmounts, receiver) {
    if (slots.length !== minimumAmounts.length)
        throw new Error("slots and minimumAmounts length mismatch");
    const validatedSlots = slots.map(validateAllocatorSlot);
    if (new Set(validatedSlots).size !== validatedSlots.length)
        throw new Error("duplicate allocator slot");
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "claimGaugeAllocatorRewards",
        args: [positionId, poolId, validatedSlots, minimumAmounts, receiver],
    });
}
export function buildForfeitGaugeAllocatorRewardCall(positionId, poolId, slot) {
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "forfeitGaugeAllocatorReward",
        args: [positionId, poolId, validateAllocatorSlot(slot)],
    });
}
export function buildCurrentGaugePeriodCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "currentGaugePeriod" });
}
export function buildGaugePeriodAtCall(timestamp) {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "gaugePeriodAt", args: [timestamp] });
}
export function buildGaugeReserveCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "gaugeReserve" });
}
export function buildGaugePoolWeightCall(poolId) {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "gaugePoolWeight", args: [poolId] });
}
export function buildGaugePositionAllocationsCall(positionId) {
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "gaugePositionAllocations",
        args: [positionId],
    });
}
export function buildPreviewGaugePoolRewardCall(poolId) {
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "previewGaugePoolReward",
        args: [poolId],
    });
}
export function buildMaxGaugeAllocationsPerPositionCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "maxGaugeAllocationsPerPosition" });
}
export function buildMaxWeeklyGaugeReleaseBpsCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "maxWeeklyGaugeReleaseBps" });
}
export function buildMaxGaugeCatchupPeriodsCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "maxGaugeCatchupPeriods" });
}
export function buildGaugeAllocationCooldownCall() {
    return encodeFunctionData({ abi: staticsGaugeIncentivesAbi, functionName: "gaugeAllocationCooldown" });
}
export function buildGaugeAllocatorRewardCall(poolId, slot) {
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "gaugeAllocatorReward",
        args: [poolId, validateAllocatorSlot(slot)],
    });
}
export function buildPreviewGaugeAllocatorRewardsCall(positionId, poolId, slots) {
    const validatedSlots = slots.map(validateAllocatorSlot);
    return encodeFunctionData({
        abi: staticsGaugeIncentivesAbi,
        functionName: "previewGaugeAllocatorRewards",
        args: [positionId, poolId, validatedSlots],
    });
}
export function decodeGaugeReserveResult(data) {
    return decodeFunctionResult({ abi: staticsGaugeIncentivesAbi, functionName: "gaugeReserve", data });
}
export function decodeGaugePoolWeightResult(data) {
    return decodeFunctionResult({ abi: staticsGaugeIncentivesAbi, functionName: "gaugePoolWeight", data });
}
export function decodeGaugePositionAllocationsResult(data) {
    const [nextAllocationAt, totalAllocated, active, lockedStake] = decodeFunctionResult({
        abi: staticsGaugeIncentivesAbi,
        functionName: "gaugePositionAllocations",
        data,
    });
    return { nextAllocationAt, totalAllocated, active, lockedStake };
}
export function decodeGaugePoolRewardResult(data) {
    const [amount, eligible] = decodeFunctionResult({
        abi: staticsGaugeIncentivesAbi,
        functionName: "previewGaugePoolReward",
        data,
    });
    return { amount, eligible };
}
export function decodeGaugeAllocatorRewardResult(data) {
    return decodeFunctionResult({ abi: staticsGaugeIncentivesAbi, functionName: "gaugeAllocatorReward", data });
}
export function decodeGaugeAllocatorRewardsPreviewResult(data) {
    return decodeFunctionResult({
        abi: staticsGaugeIncentivesAbi,
        functionName: "previewGaugeAllocatorRewards",
        data,
    });
}
