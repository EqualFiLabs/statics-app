import { decodeFunctionResult, encodeFunctionData, isAddress, parseAbi, } from "viem";
export const BATCH_REWARD_MAX_CLAIMS = 16;
export const BATCH_REWARD_MAX_ENTRIES = 64;
const UINT256_MAX = (1n << 256n) - 1n;
export const staticsBatchRewardsAbi = parseAbi([
    "function batchClaimLimits() pure returns (uint256 maxClaims,uint256 maxRewardEntries)",
    "function batchClaimRewards((uint256 positionId,address[] assets,uint256[] minimumAmounts)[] globalClaims,(uint256 positionId,bytes32 poolId,uint8[] slots,uint256[] minimumAmounts)[] lpClaims,(uint256 positionId,bytes32 poolId,uint8[] slots,uint256[] minimumAmounts)[] allocatorClaims,address receiver) returns (uint256[][] globalReceived,uint256[][] lpReceived,uint256[][] allocatorReceived)",
    "error InvalidBatchReceiver(address receiver)",
    "error EmptyRewardBatch()",
    "error EmptyRewardClaim()",
    "error BatchClaimLimitExceeded(uint256 supplied,uint256 maximum)",
    "error BatchRewardEntryLimitExceeded(uint256 supplied,uint256 maximum)",
    "error BatchRewardLengthMismatch()",
    "error DuplicateGlobalClaim(uint256 positionId)",
    "error DuplicatePoolClaim(uint256 positionId,bytes32 poolId)",
    "error DuplicateBatchRewardAsset(address asset)",
    "error DuplicateBatchRewardSlot(uint8 slot)",
    "error InvalidBatchRewardSlot(uint8 slot)",
    "error BatchClaimRouteUnavailable(bytes4 selector)",
    "error BatchClaimReentrantCall()",
]);
function uint256(value, label) {
    if (typeof value !== "bigint" || value < 0n || value > UINT256_MAX)
        throw new Error(`${label} is out of uint256 range`);
}
function unique(values, label) {
    if (new Set(values).size !== values.length)
        throw new Error(`duplicate ${label}`);
}
function validate(input, bounded, diamond) {
    if (!isAddress(input.receiver, { strict: false }) ||
        /^0x0{40}$/i.test(input.receiver) ||
        (diamond !== undefined &&
            input.receiver.toLowerCase() === diamond.toLowerCase()))
        throw new Error("invalid batch receiver");
    const count = input.globalClaims.length +
        input.lpClaims.length +
        input.allocatorClaims.length;
    if (!count)
        throw new Error("empty reward batch");
    if (bounded && count > BATCH_REWARD_MAX_CLAIMS)
        throw new Error("batch claim limit exceeded");
    unique(input.globalClaims.map((c) => String(c.positionId)), "global claim");
    let entries = 0;
    for (const claim of input.globalClaims) {
        uint256(claim.positionId, "positionId");
        if (!claim.assets.length)
            throw new Error("empty reward claim");
        if (claim.assets.length !== claim.minimumAmounts.length)
            throw new Error("reward length mismatch");
        for (const asset of claim.assets)
            if (!isAddress(asset, { strict: false }))
                throw new Error("invalid reward asset");
        unique(claim.assets.map((a) => a.toLowerCase()), "reward asset");
        claim.minimumAmounts.forEach((a) => uint256(a, "minimumAmount"));
        entries += claim.assets.length;
    }
    for (const [claims, allocator] of [
        [input.lpClaims, false],
        [input.allocatorClaims, true],
    ]) {
        unique(claims.map((c) => `${c.positionId}:${c.poolId.toLowerCase()}`), "pool claim");
        for (const claim of claims) {
            uint256(claim.positionId, "positionId");
            if (!/^0x[\da-f]{64}$/i.test(claim.poolId))
                throw new Error("poolId must be bytes32");
            if (!claim.slots.length)
                throw new Error("empty reward claim");
            if (claim.slots.length !== claim.minimumAmounts.length)
                throw new Error("reward length mismatch");
            for (const slot of claim.slots)
                if (!Number.isInteger(slot) || slot < (allocator ? 1 : 0) || slot > 4)
                    throw new Error("invalid reward slot");
            unique(claim.slots.map(String), "reward slot");
            claim.minimumAmounts.forEach((a) => uint256(a, "minimumAmount"));
            entries += claim.slots.length;
        }
    }
    if (bounded && entries > BATCH_REWARD_MAX_ENTRIES)
        throw new Error("batch reward entry limit exceeded");
}
export function buildBatchClaimRewardsCall(input, diamond) {
    validate(input, true, diamond);
    return encodeFunctionData({
        abi: staticsBatchRewardsAbi,
        functionName: "batchClaimRewards",
        args: [
            input.globalClaims,
            input.lpClaims,
            input.allocatorClaims,
            input.receiver,
        ],
    });
}
export function decodeBatchClaimRewardsResult(data) {
    const [globalReceived, lpReceived, allocatorReceived] = decodeFunctionResult({
        abi: staticsBatchRewardsAbi,
        functionName: "batchClaimRewards",
        data,
    });
    return { globalReceived, lpReceived, allocatorReceived };
}
export function buildBatchClaimLimitsCall() {
    return encodeFunctionData({
        abi: staticsBatchRewardsAbi,
        functionName: "batchClaimLimits",
    });
}
export function decodeBatchClaimLimitsResult(data) {
    const [maxClaims, maxRewardEntries] = decodeFunctionResult({
        abi: staticsBatchRewardsAbi,
        functionName: "batchClaimLimits",
        data,
    });
    return { maxClaims, maxRewardEntries };
}
/** Input limits only. Callers must simulate/estimate each complete batch and split further if needed. */
export function splitBatchRewardClaims(input, diamond) {
    validate(input, false, diamond);
    const fresh = () => ({
        globalClaims: [],
        lpClaims: [],
        allocatorClaims: [],
        receiver: input.receiver,
    });
    const output = [];
    let current = fresh();
    let entries = 0;
    let groups = 0;
    const flush = () => {
        if (groups)
            output.push(current);
        current = fresh();
        entries = 0;
        groups = 0;
    };
    for (const claim of input.globalClaims) {
        for (let offset = 0; offset < claim.assets.length; offset += BATCH_REWARD_MAX_ENTRIES) {
            const next = {
                positionId: claim.positionId,
                assets: claim.assets.slice(offset, offset + BATCH_REWARD_MAX_ENTRIES),
                minimumAmounts: claim.minimumAmounts.slice(offset, offset + BATCH_REWARD_MAX_ENTRIES),
            };
            if (groups === BATCH_REWARD_MAX_CLAIMS ||
                entries + next.assets.length > BATCH_REWARD_MAX_ENTRIES ||
                current.globalClaims.some((c) => c.positionId === claim.positionId))
                flush();
            current.globalClaims.push(next);
            entries += next.assets.length;
            groups++;
        }
    }
    for (const category of ["lpClaims", "allocatorClaims"]) {
        for (const claim of input[category]) {
            if (groups === BATCH_REWARD_MAX_CLAIMS ||
                entries + claim.slots.length > BATCH_REWARD_MAX_ENTRIES)
                flush();
            current[category].push({
                ...claim,
                slots: [...claim.slots],
                minimumAmounts: [...claim.minimumAmounts],
            });
            entries += claim.slots.length;
            groups++;
        }
    }
    flush();
    return output;
}
