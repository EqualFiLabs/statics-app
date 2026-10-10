import { decodeFunctionResult, encodeFunctionData, parseAbi, } from "viem";
export const MARKET_FLAG_ZERO_FOR_ONE = 1 << 0;
export const MARKET_FLAG_EXACT_OUTPUT = 1 << 1;
export const MARKET_FLAG_PERMISSIONED = 1 << 2;
export const MARKET_FLAG_INTERNAL = 1 << 3;
export const MARKET_FLAG_PARTIAL = 1 << 4;
export const MARKET_SAT_EXTERNAL_VOLUME0 = 1 << 0;
export const MARKET_SAT_EXTERNAL_VOLUME1 = 1 << 1;
export const MARKET_SAT_INTERNAL_VOLUME0 = 1 << 2;
export const MARKET_SAT_INTERNAL_VOLUME1 = 1 << 3;
export const MARKET_SAT_STATICS_FEES0 = 1 << 4;
export const MARKET_SAT_STATICS_FEES1 = 1 << 5;
export const MARKET_SAT_EXTERNAL_SWAP_COUNT = 1 << 6;
export const MARKET_SAT_INTERNAL_SWAP_COUNT = 1 << 7;
export const DEFAULT_MARKET_OBSERVATION_CADENCE = 15 * 60;
export const DEFAULT_MARKET_OBSERVATION_CARDINALITY = 96;
export const MIN_MARKET_OBSERVATION_CADENCE = 60;
export const MAX_MARKET_OBSERVATION_CADENCE = 24 * 60 * 60;
export const MAX_MARKET_OBSERVATION_CARDINALITY = 672;
export const MAX_MARKET_OBSERVE_QUERIES = 64;
const MAX_UINT32 = 2 ** 32 - 1;
const MAX_UINT16 = 2 ** 16 - 1;
const MAX_UINT64 = (1n << 64n) - 1n;
export const staticsSwapCallbackAbi = parseAbi([
    "function afterStaticsPoolSwap(bytes32 poolId,int256 poolDelta,uint256 staticsFeesPacked,uint8 flags)",
]);
export const staticsMarketTapeAbi = parseAbi([
    "function canonicalMarketState(bytes32 poolId) view returns ((uint256 externalVolume0,uint256 externalVolume1,uint256 internalVolume0,uint256 internalVolume1,uint256 staticsFees0,uint256 staticsFees1,uint256 externalSwapCount,uint256 internalSwapCount,uint256 sequence,int256 tickCumulative,uint40 lastTimestamp,int24 lastTick,uint24 lastNativeLpFee,uint8 lastFlags,uint8 saturatedFields) state)",
    "function setMarketObservationConfig(bytes32 poolId,bool enabled,uint32 cadence,uint16 cardinalityNext)",
    "function recordMarketObservation(bytes32 poolId,uint256 expectedSequence)",
    "function marketObservationConfig(bytes32 poolId) view returns ((bool initialized,bool enabled,uint32 cadence,uint16 cardinality,uint16 cardinalityNext,uint64 stored,uint64 latestId,uint40 lastObservationTimestamp,uint256 failedWriteCount,uint256 lastFailedSequence) config)",
    "function marketObservation(bytes32 poolId,uint64 observationId) view returns ((uint40 timestamp,int24 tick,uint24 nativeLpFee,uint8 flags,uint256 sequence,int256 tickCumulative,uint256 externalVolume0,uint256 externalVolume1,uint256 internalVolume0,uint256 internalVolume1,uint256 staticsFees0,uint256 staticsFees1,uint256 externalSwapCount,uint256 internalSwapCount) observation)",
    "function observeMarket(bytes32 poolId,uint32[] secondsAgo) view returns ((uint40 timestamp,int24 tick,uint24 nativeLpFee,uint8 flags,uint256 sequence,int256 tickCumulative,uint256 externalVolume0,uint256 externalVolume1,uint256 internalVolume0,uint256 internalVolume1,uint256 staticsFees0,uint256 staticsFees1,uint256 externalSwapCount,uint256 internalSwapCount)[] observations)",
    "event MarketSwapRecorded(bytes32 indexed poolId,uint256 indexed sequence,int256 poolDelta,uint256 staticsFeesPacked,int24 finalTick,uint24 nativeLpFee,uint8 flags)",
    "event MarketObservationConfigSet(bytes32 indexed poolId,bool enabled,uint32 cadence,uint16 cardinalityNext)",
    "event MarketObservationCommitted(bytes32 indexed poolId,uint64 indexed observationId,uint256 sequence)",
    "event MarketObservationWriteFailed(bytes32 indexed poolId,uint256 indexed sequence)",
    "error OnlyDiamondSelf(address caller)",
    "error CanonicalSequenceMismatch(bytes32 poolId,uint256 expected,uint256 actual)",
    "error NoMarketObservations(bytes32 poolId)",
    "error MarketObservationNotFound(bytes32 poolId,uint64 observationId)",
    "error ObservationQueryInFuture(uint256 secondsAgo,uint256 timestamp)",
    "error ObservationTooOld(bytes32 poolId,uint256 target,uint256 oldest)",
    "error TooManyObservationQueries(uint256 requested,uint256 maximum)",
    "error InvalidMarketFlags(uint8 flags)",
    "error InvalidInternalMarketFlags(uint8 flags)",
    "error MarketTimestampOverflow(uint256 timestamp)",
    "error InvalidObservationCadence(uint256 cadence)",
    "error InvalidObservationCardinality(uint256 cardinality)",
]);
function validateUnsignedNumber(value, maximum, name) {
    if (!Number.isInteger(value) || value < 0 || value > maximum)
        throw new Error(`${name} is out of range`);
    return value;
}
export function buildCanonicalMarketStateCall(poolId) {
    return encodeFunctionData({ abi: staticsMarketTapeAbi, functionName: "canonicalMarketState", args: [poolId] });
}
export function buildSetMarketObservationConfigCall(poolId, enabled, cadence, cardinalityNext) {
    validateUnsignedNumber(cadence, MAX_UINT32, "cadence");
    validateUnsignedNumber(cardinalityNext, MAX_UINT16, "cardinalityNext");
    if (enabled) {
        if (cadence < MIN_MARKET_OBSERVATION_CADENCE || cadence > MAX_MARKET_OBSERVATION_CADENCE) {
            throw new Error("cadence is out of range");
        }
        if (cardinalityNext < 1 || cardinalityNext > MAX_MARKET_OBSERVATION_CARDINALITY) {
            throw new Error("cardinalityNext is out of range");
        }
    }
    return encodeFunctionData({
        abi: staticsMarketTapeAbi,
        functionName: "setMarketObservationConfig",
        args: [poolId, enabled, cadence, cardinalityNext],
    });
}
export function buildMarketObservationConfigCall(poolId) {
    return encodeFunctionData({ abi: staticsMarketTapeAbi, functionName: "marketObservationConfig", args: [poolId] });
}
export function buildMarketObservationCall(poolId, observationId) {
    if (observationId <= 0n || observationId > MAX_UINT64)
        throw new Error("observationId is out of range");
    return encodeFunctionData({
        abi: staticsMarketTapeAbi,
        functionName: "marketObservation",
        args: [poolId, observationId],
    });
}
export function buildObserveMarketCall(poolId, secondsAgo) {
    if (secondsAgo.length > MAX_MARKET_OBSERVE_QUERIES)
        throw new Error("too many observation queries");
    const boundedLookbacks = secondsAgo.map((lookback) => validateUnsignedNumber(lookback, MAX_UINT32, "secondsAgo"));
    return encodeFunctionData({
        abi: staticsMarketTapeAbi,
        functionName: "observeMarket",
        args: [poolId, boundedLookbacks],
    });
}
export function decodeCanonicalMarketStateResult(data) {
    return decodeFunctionResult({ abi: staticsMarketTapeAbi, functionName: "canonicalMarketState", data });
}
export function decodeMarketObservationConfigResult(data) {
    return decodeFunctionResult({ abi: staticsMarketTapeAbi, functionName: "marketObservationConfig", data });
}
export function decodeMarketObservationResult(data) {
    return decodeFunctionResult({ abi: staticsMarketTapeAbi, functionName: "marketObservation", data });
}
export function decodeObserveMarketResult(data) {
    return decodeFunctionResult({ abi: staticsMarketTapeAbi, functionName: "observeMarket", data });
}
export function hasMarketFlag(flags, flag) {
    return (flags & flag) !== 0;
}
export function hasMarketSaturation(saturatedFields, field) {
    return (saturatedFields & field) !== 0;
}
