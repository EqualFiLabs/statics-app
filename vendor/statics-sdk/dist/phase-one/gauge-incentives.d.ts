import { type Address, type ContractEventArgs, type Hex } from "viem";
export declare const MAX_GAUGE_ALLOCATIONS_PER_POSITION = 16;
export declare const MAX_WEEKLY_GAUGE_RELEASE_BPS = 1000;
export declare const MAX_GAUGE_CATCHUP_PERIODS = 52;
export declare const DEFAULT_GAUGE_ALLOCATION_COOLDOWN: bigint;
export type GaugeAllocation = {
    poolId: Hex;
    amount: bigint;
    eligibilityVersion: Hex;
};
export type GaugeReserve = {
    activated: boolean;
    releaseBps: number;
    pendingReleaseBps: number;
    pendingReleaseAt: number;
    deferredMaturityAt: number;
    scheduleStart: number;
    lastCheckpoint: number;
    periodStart: number;
    periodFinish: number;
    currentPeriod: bigint;
    allocationCooldown: number;
    available: bigint;
    deferred: bigint;
    committed: bigint;
    periodBudget: bigint;
    periodAccounted: bigint;
    totalAllocatedWeight: bigint;
    globalIndexX160: bigint;
    unsettledRoutingLiability: bigint;
};
export type GaugePoolWeight = {
    weight: bigint;
    storedVersion: Hex;
    currentVersion: Hex;
    restrictionSequence: bigint;
    indexCursorX160: bigint;
    pendingReward: bigint;
    stale: boolean;
};
export type GaugePositionAllocations = {
    nextAllocationAt: number;
    totalAllocated: bigint;
    active: readonly GaugeAllocation[];
    lockedStake: bigint;
};
export type GaugePoolRewardPreview = {
    amount: bigint;
    eligible: boolean;
};
export type GaugeAllocatorReward = {
    asset: Address;
    eligibilityVersion: Hex;
    fundingRestrictionSequence: bigint;
    periodStart: number;
    periodFinish: number;
    lastUpdate: number;
    periodBudget: bigint;
    periodEmitted: bigint;
    globalIndexX160: bigint;
    indexedLiability: bigint;
    claimLiability: bigint;
    terminated: boolean;
};
export type GaugeAllocatorClaimPreview = {
    slot: number;
    asset: Address;
    allocation: bigint;
    amount: bigint;
};
export declare const staticsGaugeIncentivesAbi: readonly [{
    readonly name: "fundGaugeReserve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "activateGaugeSchedule";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "budget";
    }];
}, {
    readonly name: "setGaugeAllocations";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32[]";
        readonly name: "poolIds";
    }, {
        readonly type: "uint256[]";
        readonly name: "amounts";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "checkpointGaugeSchedule";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "maxPeriods";
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "period";
    }, {
        readonly type: "uint16";
        readonly name: "periodsProcessed";
    }, {
        readonly type: "uint256";
        readonly name: "newlyAccounted";
    }];
}, {
    readonly name: "checkpointGaugePool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "credited";
    }, {
        readonly type: "uint256";
        readonly name: "recycled";
    }];
}, {
    readonly name: "scheduleGaugeReleaseBps";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "releaseBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setGaugeAllocationCooldown";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "cooldown";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "syncGaugeAllocationsAfterStakeLoss";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "remainingStake";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimGaugeAllocatorRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "received";
    }];
}, {
    readonly name: "forfeitGaugeAllocatorReward";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "currentGaugePeriod";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "period";
    }];
}, {
    readonly name: "gaugePeriodAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "timestamp";
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "period";
    }, {
        readonly type: "bool";
        readonly name: "active";
    }];
}, {
    readonly name: "gaugeReserve";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "activated";
        }, {
            readonly type: "uint16";
            readonly name: "releaseBps";
        }, {
            readonly type: "uint16";
            readonly name: "pendingReleaseBps";
        }, {
            readonly type: "uint40";
            readonly name: "pendingReleaseAt";
        }, {
            readonly type: "uint40";
            readonly name: "deferredMaturityAt";
        }, {
            readonly type: "uint40";
            readonly name: "scheduleStart";
        }, {
            readonly type: "uint40";
            readonly name: "lastCheckpoint";
        }, {
            readonly type: "uint40";
            readonly name: "periodStart";
        }, {
            readonly type: "uint40";
            readonly name: "periodFinish";
        }, {
            readonly type: "uint64";
            readonly name: "currentPeriod";
        }, {
            readonly type: "uint40";
            readonly name: "allocationCooldown";
        }, {
            readonly type: "uint256";
            readonly name: "available";
        }, {
            readonly type: "uint256";
            readonly name: "deferred";
        }, {
            readonly type: "uint256";
            readonly name: "committed";
        }, {
            readonly type: "uint256";
            readonly name: "periodBudget";
        }, {
            readonly type: "uint256";
            readonly name: "periodAccounted";
        }, {
            readonly type: "uint256";
            readonly name: "totalAllocatedWeight";
        }, {
            readonly type: "uint256";
            readonly name: "globalIndexX160";
        }, {
            readonly type: "uint256";
            readonly name: "unsettledRoutingLiability";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "gaugePoolWeight";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "weight";
        }, {
            readonly type: "bytes32";
            readonly name: "storedVersion";
        }, {
            readonly type: "bytes32";
            readonly name: "currentVersion";
        }, {
            readonly type: "uint64";
            readonly name: "restrictionSequence";
        }, {
            readonly type: "uint256";
            readonly name: "indexCursorX160";
        }, {
            readonly type: "uint256";
            readonly name: "pendingReward";
        }, {
            readonly type: "bool";
            readonly name: "stale";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "gaugePositionAllocations";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint40";
        readonly name: "nextAllocationAt";
    }, {
        readonly type: "uint256";
        readonly name: "totalAllocated";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "uint256";
            readonly name: "amount";
        }, {
            readonly type: "bytes32";
            readonly name: "eligibilityVersion";
        }];
        readonly name: "active";
    }, {
        readonly type: "uint256";
        readonly name: "lockedStake";
    }];
}, {
    readonly name: "previewGaugePoolReward";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "bool";
        readonly name: "eligible";
    }];
}, {
    readonly name: "maxGaugeAllocationsPerPosition";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "maxWeeklyGaugeReleaseBps";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "maxGaugeCatchupPeriods";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "gaugeAllocationCooldown";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint40";
        readonly name: "cooldown";
    }];
}, {
    readonly name: "gaugeAllocatorReward";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "asset";
        }, {
            readonly type: "bytes32";
            readonly name: "eligibilityVersion";
        }, {
            readonly type: "uint64";
            readonly name: "fundingRestrictionSequence";
        }, {
            readonly type: "uint40";
            readonly name: "periodStart";
        }, {
            readonly type: "uint40";
            readonly name: "periodFinish";
        }, {
            readonly type: "uint40";
            readonly name: "lastUpdate";
        }, {
            readonly type: "uint256";
            readonly name: "periodBudget";
        }, {
            readonly type: "uint256";
            readonly name: "periodEmitted";
        }, {
            readonly type: "uint256";
            readonly name: "globalIndexX160";
        }, {
            readonly type: "uint256";
            readonly name: "indexedLiability";
        }, {
            readonly type: "uint256";
            readonly name: "claimLiability";
        }, {
            readonly type: "bool";
            readonly name: "terminated";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "previewGaugeAllocatorRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8[]";
        readonly name: "slots";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint8";
            readonly name: "slot";
        }, {
            readonly type: "address";
            readonly name: "asset";
        }, {
            readonly type: "uint256";
            readonly name: "allocation";
        }, {
            readonly type: "uint256";
            readonly name: "amount";
        }];
        readonly name: "rewards";
    }];
}, {
    readonly name: "GaugeReserveFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "funder";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint40";
        readonly name: "maturityAt";
        readonly indexed: true;
    }];
}, {
    readonly name: "GaugeScheduleActivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "scheduleStart";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "firstPeriodFinish";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "budget";
    }];
}, {
    readonly name: "GaugeReleaseBpsScheduled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "releaseBps";
    }, {
        readonly type: "uint40";
        readonly name: "effectiveAt";
        readonly indexed: true;
    }];
}, {
    readonly name: "GaugeAllocationCooldownSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "cooldown";
    }];
}, {
    readonly name: "PositionGaugeAllocationsSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "nextAllocationAt";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "totalAllocated";
    }];
}, {
    readonly name: "PositionGaugeAllocationCooldownExtended";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "nextAllocationAt";
        readonly indexed: true;
    }];
}, {
    readonly name: "PositionGaugeAllocationsClearedByStakeLoss";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "remainingStake";
    }];
}, {
    readonly name: "GaugePeriodStarted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint64";
        readonly name: "period";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "start";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "finish";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "releaseBps";
    }, {
        readonly type: "uint256";
        readonly name: "budget";
    }, {
        readonly type: "uint256";
        readonly name: "totalAllocatedWeight";
    }];
}, {
    readonly name: "ProtocolGaugeRewardCredited";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "ProtocolGaugeRewardRecycled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "GaugeAllocatorRewardClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "debited";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "GaugeAllocatorRewardForfeited";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "InvalidGaugeFundingAmount";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "IncompatibleGaugeTokenTransfer";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "GaugeAllocationLengthMismatch";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "GaugeAllocationLimitExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "count";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "InvalidGaugeAllocation";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "DuplicateGaugeAllocation";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "GaugeAllocationExceedsStake";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "allocated";
    }, {
        readonly type: "uint256";
        readonly name: "staked";
    }];
}, {
    readonly name: "GaugeSelfCallOnly";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "InvalidGaugeAllocatorSlot";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "GaugeAllocatorClaimLengthMismatch";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "DuplicateGaugeAllocatorSlot";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "InvalidGaugeAllocatorReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "GaugeAllocatorAmountBelowMinimum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "GaugeAllocatorLiabilityUnderflow";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }, {
        readonly type: "uint256";
        readonly name: "liability";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "InvalidGaugeTimestamp";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "timestamp";
    }];
}, {
    readonly name: "GaugeScheduleAlreadyActivated";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "GaugeScheduleCatchupRequired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "checkpointedAt";
    }, {
        readonly type: "uint40";
        readonly name: "requestedAt";
    }];
}, {
    readonly name: "GaugeCatchupLimitInvalid";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "GaugeAllocationIncreaseDuringCooldown";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "priorAmount";
    }, {
        readonly type: "uint256";
        readonly name: "nextAmount";
    }];
}, {
    readonly name: "GaugeReserveAlreadyInitialized";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidGaugeReleaseBps";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "releaseBps";
    }];
}, {
    readonly name: "GaugeReserveUnderflow";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "GaugeCommitmentUnderflow";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "committed";
    }];
}, {
    readonly name: "DeferredMaturityMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "storedMaturity";
    }, {
        readonly type: "uint40";
        readonly name: "requestedMaturity";
    }];
}];
export type GaugeIncentiveEventName = "GaugeReserveFunded" | "GaugeScheduleActivated" | "GaugeReleaseBpsScheduled" | "GaugeAllocationCooldownSet" | "PositionGaugeAllocationsSet" | "PositionGaugeAllocationCooldownExtended" | "PositionGaugeAllocationsClearedByStakeLoss" | "GaugePeriodStarted" | "ProtocolGaugeRewardCredited" | "ProtocolGaugeRewardRecycled" | "GaugeAllocatorRewardClaimed" | "GaugeAllocatorRewardForfeited";
export type GaugeIncentiveEventArgs<Name extends GaugeIncentiveEventName> = ContractEventArgs<typeof staticsGaugeIncentivesAbi, Name>;
export declare function buildFundGaugeReserveCall(amount: bigint): Hex;
export declare function buildActivateGaugeScheduleCall(): Hex;
export declare function buildSetGaugeAllocationsCall(positionId: bigint, poolIds: readonly Hex[], amounts: readonly bigint[]): Hex;
export declare function buildCheckpointGaugeScheduleCall(maxPeriods: number): Hex;
export declare function buildCheckpointGaugePoolCall(poolId: Hex): Hex;
export declare function buildScheduleGaugeReleaseBpsCall(releaseBps: number): Hex;
export declare function buildSetGaugeAllocationCooldownCall(cooldown: bigint): Hex;
export declare function buildClaimGaugeAllocatorRewardsCall(positionId: bigint, poolId: Hex, slots: readonly number[], minimumAmounts: readonly bigint[], receiver: Address): Hex;
export declare function buildForfeitGaugeAllocatorRewardCall(positionId: bigint, poolId: Hex, slot: number): Hex;
export declare function buildCurrentGaugePeriodCall(): Hex;
export declare function buildGaugePeriodAtCall(timestamp: bigint): Hex;
export declare function buildGaugeReserveCall(): Hex;
export declare function buildGaugePoolWeightCall(poolId: Hex): Hex;
export declare function buildGaugePositionAllocationsCall(positionId: bigint): Hex;
export declare function buildPreviewGaugePoolRewardCall(poolId: Hex): Hex;
export declare function buildMaxGaugeAllocationsPerPositionCall(): Hex;
export declare function buildMaxWeeklyGaugeReleaseBpsCall(): Hex;
export declare function buildMaxGaugeCatchupPeriodsCall(): Hex;
export declare function buildGaugeAllocationCooldownCall(): Hex;
export declare function buildGaugeAllocatorRewardCall(poolId: Hex, slot: number): Hex;
export declare function buildPreviewGaugeAllocatorRewardsCall(positionId: bigint, poolId: Hex, slots: readonly number[]): Hex;
export declare function decodeGaugeReserveResult(data: Hex): GaugeReserve;
export declare function decodeGaugePoolWeightResult(data: Hex): GaugePoolWeight;
export declare function decodeGaugePositionAllocationsResult(data: Hex): GaugePositionAllocations;
export declare function decodeGaugePoolRewardResult(data: Hex): GaugePoolRewardPreview;
export declare function decodeGaugeAllocatorRewardResult(data: Hex): GaugeAllocatorReward;
export declare function decodeGaugeAllocatorRewardsPreviewResult(data: Hex): readonly GaugeAllocatorClaimPreview[];
