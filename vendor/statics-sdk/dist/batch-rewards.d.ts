import { type Address, type Hex } from "viem";
export declare const BATCH_REWARD_MAX_CLAIMS = 16;
export declare const BATCH_REWARD_MAX_ENTRIES = 64;
export type BatchGlobalRewardClaim = Readonly<{
    positionId: bigint;
    assets: readonly Address[];
    minimumAmounts: readonly bigint[];
}>;
export type BatchPoolRewardClaim = Readonly<{
    positionId: bigint;
    poolId: Hex;
    slots: readonly number[];
    minimumAmounts: readonly bigint[];
}>;
export type BatchRewardClaims = Readonly<{
    globalClaims: readonly BatchGlobalRewardClaim[];
    lpClaims: readonly BatchPoolRewardClaim[];
    allocatorClaims: readonly BatchPoolRewardClaim[];
    receiver: Address;
}>;
export type BatchRewardClaimResult = Readonly<{
    globalReceived: readonly (readonly bigint[])[];
    lpReceived: readonly (readonly bigint[])[];
    allocatorReceived: readonly (readonly bigint[])[];
}>;
export declare const staticsBatchRewardsAbi: readonly [{
    readonly name: "batchClaimLimits";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "maxClaims";
    }, {
        readonly type: "uint256";
        readonly name: "maxRewardEntries";
    }];
}, {
    readonly name: "batchClaimRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "positionId";
        }, {
            readonly type: "address[]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[]";
            readonly name: "minimumAmounts";
        }];
        readonly name: "globalClaims";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "positionId";
        }, {
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "uint8[]";
            readonly name: "slots";
        }, {
            readonly type: "uint256[]";
            readonly name: "minimumAmounts";
        }];
        readonly name: "lpClaims";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "positionId";
        }, {
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "uint8[]";
            readonly name: "slots";
        }, {
            readonly type: "uint256[]";
            readonly name: "minimumAmounts";
        }];
        readonly name: "allocatorClaims";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[][]";
        readonly name: "globalReceived";
    }, {
        readonly type: "uint256[][]";
        readonly name: "lpReceived";
    }, {
        readonly type: "uint256[][]";
        readonly name: "allocatorReceived";
    }];
}, {
    readonly name: "InvalidBatchReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "EmptyRewardBatch";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "EmptyRewardClaim";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "BatchClaimLimitExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "supplied";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "BatchRewardEntryLimitExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "supplied";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "BatchRewardLengthMismatch";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "DuplicateGlobalClaim";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "DuplicatePoolClaim";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "DuplicateBatchRewardAsset";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "DuplicateBatchRewardSlot";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "InvalidBatchRewardSlot";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "BatchClaimRouteUnavailable";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes4";
        readonly name: "selector";
    }];
}, {
    readonly name: "BatchClaimReentrantCall";
    readonly type: "error";
    readonly inputs: readonly [];
}];
export declare function buildBatchClaimRewardsCall(input: BatchRewardClaims, diamond?: Address): Hex;
export declare function decodeBatchClaimRewardsResult(data: Hex): BatchRewardClaimResult;
export declare function buildBatchClaimLimitsCall(): Hex;
export declare function decodeBatchClaimLimitsResult(data: Hex): Readonly<{
    maxClaims: bigint;
    maxRewardEntries: bigint;
}>;
/** Input limits only. Callers must simulate/estimate each complete batch and split further if needed. */
export declare function splitBatchRewardClaims(input: BatchRewardClaims, diamond?: Address): BatchRewardClaims[];
