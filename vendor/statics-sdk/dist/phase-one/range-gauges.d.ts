import { type Address, type ContractEventArgs, type Hex } from "viem";
export type RangeGaugeProvideLiquidityParams = {
    poolId: Hex;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    amount0Maximum: bigint;
    amount1Maximum: bigint;
    deadline: bigint;
};
export type RangeGaugeIncreaseLiquidityParams = {
    liquidity: bigint;
    amount0Maximum: bigint;
    amount1Maximum: bigint;
    deadline: bigint;
};
export type RangeGaugeDecreaseLiquidityParams = {
    liquidity: bigint;
    amount0Minimum: bigint;
    amount1Minimum: bigint;
    deadline: bigint;
};
export type RangeGaugeRebalanceLiquidityParams = {
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    amount0Maximum: bigint;
    amount1Maximum: bigint;
    amount0Minimum: bigint;
    amount1Minimum: bigint;
    deadline: bigint;
};
export type RangeGaugeLiquidityMovement = {
    posmTokenId: bigint;
    liquidity: bigint;
    spent0: bigint;
    received0: bigint;
    spent1: bigint;
    received1: bigint;
};
export type RangeGaugePoolRewardConfig = {
    initialized: boolean;
    slotCount: number;
    assets: readonly [Address, Address, Address, Address, Address];
    allocatorShareBps: readonly [number, number, number, number, number];
};
export type RangeGaugePool = {
    initialized: boolean;
    stopped: boolean;
    stoppedAt: number;
    referenceTick: number;
    activeGaugeLiquidity: bigint;
    managedLegCount: bigint;
    unresolvedLegCount: bigint;
};
export type RangeGaugeRewardStream = {
    assigned: boolean;
    slot: number;
    asset: Address;
    periodStart: number;
    periodFinish: number;
    lastUpdate: number;
    periodBudget: bigint;
    periodEmitted: bigint;
    periodRecycled: bigint;
    globalIndexRay: bigint;
    indexRemainder: bigint;
    indexedLiability: bigint;
    claimLiability: bigint;
    indexCapacityUsed: bigint;
};
export type RangeGaugeBoundary = {
    grossLiquidity: bigint;
    netLiquidity: bigint;
    rewardOutsideRay: readonly [bigint, bigint, bigint, bigint, bigint];
};
export type RangeGaugeLpLeg = {
    manager: Address;
    posmTokenId: bigint;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    checkpointInsideRay: readonly [bigint, bigint, bigint, bigint, bigint];
    rewardRemainderRay: readonly [bigint, bigint, bigint, bigint, bigint];
    claimable: readonly [bigint, bigint, bigint, bigint, bigint];
};
export type RangeGaugeLpLegState = RangeGaugeLpLeg & {
    claimOnly: boolean;
};
export type RangeGaugePendingRewards = {
    slotCount: number;
    assets: readonly [Address, Address, Address, Address, Address];
    amounts: readonly [bigint, bigint, bigint, bigint, bigint];
};
export type RangeGaugePositionPoolPage = {
    poolIds: readonly Hex[];
    nextCursor: bigint;
};
export type RangeGaugeManagedLiquidityRequest = {
    tokenId: bigint;
    liquidity: bigint;
    amount0Limit: bigint;
    amount1Limit: bigint;
    deadline: bigint;
    receiver: Address;
};
export type RangeGaugeManagedPositionState = {
    poolId: Hex;
    poolKey: {
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address;
    };
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    owner: Address;
    subscriber: Address;
};
export type RangeGaugeManagedPositionMovement = {
    tokenId: bigint;
    liquidityBefore: bigint;
    liquidityAfter: bigint;
    spent0: bigint;
    spent1: bigint;
    received0: bigint;
    received1: bigint;
    refund0: bigint;
    refund1: bigint;
};
export type LiquidityStatementMovement = {
    liquidityBefore: bigint;
    liquidityAfter: bigint;
    payer: Address;
    receiver: Address;
    paid0: bigint;
    received0: bigint;
    paid1: bigint;
    received1: bigint;
};
export type RebalanceSettlement = {
    withdrawn0: bigint;
    withdrawn1: bigint;
    mintSpent0: bigint;
    mintReceived0: bigint;
    mintSpent1: bigint;
    mintReceived1: bigint;
};
export declare const staticsRangeGaugeAbi: readonly [{
    readonly name: "setGaugeRewardAssetAllowed";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "bool";
        readonly name: "allowed";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setGaugeRewardDuration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "duration";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "appendPoolRewardAsset";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "setPoolRewardAllocatorShare";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }, {
        readonly type: "uint16";
        readonly name: "allocatorShareBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "fundPoolReward";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint40";
        readonly name: "minRemainingDuration";
    }, {
        readonly type: "uint16";
        readonly name: "expectedAllocatorShareBps";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "installLiquidityManager";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "replaceLiquidityManager";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "newManager";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "provideLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "int24";
            readonly name: "tickLower";
        }, {
            readonly type: "int24";
            readonly name: "tickUpper";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Maximum";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Maximum";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "attachLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "posmTokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "increaseLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Maximum";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Maximum";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "decreaseLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Minimum";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Minimum";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "collectNativeFees";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "amount0Minimum";
    }, {
        readonly type: "uint256";
        readonly name: "amount1Minimum";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "rebalanceLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "int24";
            readonly name: "tickLower";
        }, {
            readonly type: "int24";
            readonly name: "tickUpper";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Maximum";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Maximum";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Minimum";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Minimum";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "exitLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "amount0Minimum";
    }, {
        readonly type: "uint256";
        readonly name: "amount1Minimum";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "claimLpRewards";
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
    readonly name: "forfeitLpReward";
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
    readonly name: "recoverUnboundPosm";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "uint256";
        readonly name: "posmTokenId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "reconcilePoolRewardSurplus";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
    readonly name: "gaugeRewardDuration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint40";
        readonly name: "duration";
    }];
}, {
    readonly name: "gaugeRewardAssetAllowed";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "allowed";
    }];
}, {
    readonly name: "poolRewardConfig";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "initialized";
        }, {
            readonly type: "uint8";
            readonly name: "slotCount";
        }, {
            readonly type: "address[5]";
            readonly name: "assets";
        }, {
            readonly type: "uint16[5]";
            readonly name: "allocatorShareBps";
        }];
        readonly name: "config";
    }];
}, {
    readonly name: "gaugePool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "initialized";
        }, {
            readonly type: "bool";
            readonly name: "stopped";
        }, {
            readonly type: "uint40";
            readonly name: "stoppedAt";
        }, {
            readonly type: "int24";
            readonly name: "referenceTick";
        }, {
            readonly type: "uint128";
            readonly name: "activeGaugeLiquidity";
        }, {
            readonly type: "uint64";
            readonly name: "managedLegCount";
        }, {
            readonly type: "uint64";
            readonly name: "unresolvedLegCount";
        }];
        readonly name: "pool";
    }];
}, {
    readonly name: "poolRewardStream";
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
            readonly type: "bool";
            readonly name: "assigned";
        }, {
            readonly type: "uint8";
            readonly name: "slot";
        }, {
            readonly type: "address";
            readonly name: "asset";
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
            readonly name: "periodRecycled";
        }, {
            readonly type: "uint256";
            readonly name: "globalIndexRay";
        }, {
            readonly type: "uint256";
            readonly name: "indexRemainder";
        }, {
            readonly type: "uint256";
            readonly name: "indexedLiability";
        }, {
            readonly type: "uint256";
            readonly name: "claimLiability";
        }, {
            readonly type: "uint256";
            readonly name: "indexCapacityUsed";
        }];
        readonly name: "stream";
    }];
}, {
    readonly name: "poolRewardCustodyAccount";
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
        readonly type: "bytes32";
        readonly name: "account";
    }, {
        readonly type: "bool";
        readonly name: "assigned";
    }];
}, {
    readonly name: "gaugeBoundary";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "grossLiquidity";
        }, {
            readonly type: "int128";
            readonly name: "netLiquidity";
        }, {
            readonly type: "uint256[5]";
            readonly name: "rewardOutsideRay";
        }];
        readonly name: "boundary";
    }];
}, {
    readonly name: "lpLeg";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "manager";
        }, {
            readonly type: "uint256";
            readonly name: "posmTokenId";
        }, {
            readonly type: "int24";
            readonly name: "tickLower";
        }, {
            readonly type: "int24";
            readonly name: "tickUpper";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256[5]";
            readonly name: "checkpointInsideRay";
        }, {
            readonly type: "uint256[5]";
            readonly name: "rewardRemainderRay";
        }, {
            readonly type: "uint256[5]";
            readonly name: "claimable";
        }];
        readonly name: "leg";
    }];
}, {
    readonly name: "positionGaugePools";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "cursor";
    }, {
        readonly type: "uint256";
        readonly name: "size";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32[]";
        readonly name: "poolIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "posmBinding";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "posmTokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "binding";
    }];
}, {
    readonly name: "liquidityManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "bool";
        readonly name: "installed";
    }];
}, {
    readonly name: "recordedLiquidityManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }];
}, {
    readonly name: "previewLpRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint8";
            readonly name: "slotCount";
        }, {
            readonly type: "address[5]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[5]";
            readonly name: "amounts";
        }];
        readonly name: "pending";
    }];
}, {
    readonly name: "previewNativeLpFees";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "GaugeRewardAssetAllowedSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "allowed";
    }];
}, {
    readonly name: "GaugeRewardDurationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "duration";
    }];
}, {
    readonly name: "PoolRewardAssetAppended";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
        readonly indexed: true;
    }];
}, {
    readonly name: "PoolRewardAllocatorShareSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "allocatorShareBps";
    }];
}, {
    readonly name: "PoolRewardFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "funder";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }, {
        readonly type: "uint256";
        readonly name: "lpAmount";
    }, {
        readonly type: "uint40";
        readonly name: "periodFinish";
    }];
}, {
    readonly name: "PoolAllocatorRewardFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "funder";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }, {
        readonly type: "uint256";
        readonly name: "allocatorAmount";
    }, {
        readonly type: "uint40";
        readonly name: "periodFinish";
    }];
}, {
    readonly name: "ManagedLiquidityProvided";
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
        readonly type: "uint256";
        readonly name: "posmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "int24";
        readonly name: "tickLower";
    }, {
        readonly type: "int24";
        readonly name: "tickUpper";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "address";
            readonly name: "payer";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }, {
            readonly type: "uint256";
            readonly name: "paid0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "paid1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "ManagedLiquidityAttached";
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
        readonly type: "uint256";
        readonly name: "posmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "int24";
        readonly name: "tickLower";
    }, {
        readonly type: "int24";
        readonly name: "tickUpper";
    }, {
        readonly type: "uint128";
        readonly name: "liquidity";
    }];
}, {
    readonly name: "ManagedLiquidityChanged";
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
        readonly type: "uint256";
        readonly name: "posmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "address";
            readonly name: "payer";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }, {
            readonly type: "uint256";
            readonly name: "paid0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "paid1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "ManagedLiquidityRebalanced";
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
        readonly type: "uint256";
        readonly name: "oldPosmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "newPosmTokenId";
    }, {
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "int24";
        readonly name: "tickLower";
    }, {
        readonly type: "int24";
        readonly name: "tickUpper";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "address";
            readonly name: "payer";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }, {
            readonly type: "uint256";
            readonly name: "paid0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "paid1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "withdrawn0";
        }, {
            readonly type: "uint256";
            readonly name: "withdrawn1";
        }, {
            readonly type: "uint256";
            readonly name: "mintSpent0";
        }, {
            readonly type: "uint256";
            readonly name: "mintReceived0";
        }, {
            readonly type: "uint256";
            readonly name: "mintSpent1";
        }, {
            readonly type: "uint256";
            readonly name: "mintReceived1";
        }];
        readonly name: "settlement";
    }];
}, {
    readonly name: "ManagedLiquidityExited";
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
        readonly type: "uint256";
        readonly name: "posmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "address";
            readonly name: "payer";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }, {
            readonly type: "uint256";
            readonly name: "paid0";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "paid1";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "ManagedLiquidityFeesCollected";
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
        readonly type: "uint256";
        readonly name: "posmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "LpRewardsClaimed";
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
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
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
    readonly name: "LpRewardForfeited";
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
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "UnboundPosmRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "posmTokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }];
}, {
    readonly name: "PoolRewardSurplusReconciled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "slot";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PoolGaugeStopped";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "ActionPaused";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "action";
    }];
}, {
    readonly name: "InvalidPublicPool";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "PublicPoolDecommissioned";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "GaugeStopped";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "NotPoolCreator";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "creator";
    }];
}, {
    readonly name: "GaugeRewardAssetNotAllowed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "GaugeRewardAssetRestricted";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "GaugeRewardAssetNotAssigned";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "GaugeRewardSlotNotAssigned";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "ProtocolRewardSlotReserved";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "InvalidAllocatorShareBps";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "allocatorShareBps";
    }];
}, {
    readonly name: "AllocatorShareChanged";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "expectedAllocatorShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "actualAllocatorShareBps";
    }];
}, {
    readonly name: "GaugeAllocatorPoolIneligible";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "MinimumRemainingDurationNotMet";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "available";
    }, {
        readonly type: "uint40";
        readonly name: "minimum";
    }];
}, {
    readonly name: "RewardBudgetExceedsIndexCapacity";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "committedBudget";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }, {
        readonly type: "uint256";
        readonly name: "maximumBudget";
    }];
}, {
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "ArrayLengthMismatch";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "DuplicateRewardSlot";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "ManagedLegAlreadyExists";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "ManagedLegNotFound";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "UnauthorizedPositionActor";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "LiquidityManagerNotInstalled";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "LiquidityManagerBindingMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "address";
        readonly name: "expected";
    }, {
        readonly type: "address";
        readonly name: "actual";
    }];
}, {
    readonly name: "NotPosmOwner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "posmTokenId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }];
}, {
    readonly name: "PositionMutationMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "posmTokenId";
    }];
}, {
    readonly name: "InputDebitExceedsMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "debit";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "ManagerAssetTransferMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }];
}, {
    readonly name: "InvalidPositionState";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "RewardAmountBelowMinimum";
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
    readonly name: "PoolRewardReconciliationUnavailable";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "slot";
    }];
}, {
    readonly name: "ClaimLiabilityUnderflow";
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
}];
export type RangeGaugeEventName = "GaugeRewardAssetAllowedSet" | "GaugeRewardDurationSet" | "PoolRewardAssetAppended" | "PoolRewardAllocatorShareSet" | "PoolRewardFunded" | "PoolAllocatorRewardFunded" | "ManagedLiquidityProvided" | "ManagedLiquidityAttached" | "ManagedLiquidityChanged" | "ManagedLiquidityRebalanced" | "ManagedLiquidityExited" | "ManagedLiquidityFeesCollected" | "LpRewardsClaimed" | "LpRewardForfeited" | "UnboundPosmRecovered" | "PoolRewardSurplusReconciled" | "PoolGaugeStopped";
export type RangeGaugeEventArgs<Name extends RangeGaugeEventName> = ContractEventArgs<typeof staticsRangeGaugeAbi, Name>;
export declare function buildSetGaugeRewardAssetAllowedCall(asset: Address, allowed: boolean): Hex;
export declare function buildSetGaugeRewardDurationCall(duration: bigint): Hex;
export declare function buildAppendPoolRewardAssetCall(poolId: Hex, asset: Address): Hex;
export declare function buildSetPoolRewardAllocatorShareCall(poolId: Hex, slot: number, allocatorShareBps: number): Hex;
export declare function buildFundPoolRewardCall(poolId: Hex, slot: number, amount: bigint, minRemainingDuration: bigint, expectedAllocatorShareBps: number): Hex;
export declare function buildInstallRangeGaugeLiquidityManagerCall(manager: Address): Hex;
export declare function buildReplaceRangeGaugeLiquidityManagerCall(newManager: Address): Hex;
export declare function buildProvideRangeLiquidityCall(positionId: bigint, params: RangeGaugeProvideLiquidityParams): Hex;
export declare function buildAttachRangeLiquidityCall(positionId: bigint, poolId: Hex, posmTokenId: bigint): Hex;
export declare function buildIncreaseRangeLiquidityCall(positionId: bigint, poolId: Hex, params: RangeGaugeIncreaseLiquidityParams): Hex;
export declare function buildDecreaseRangeLiquidityCall(positionId: bigint, poolId: Hex, params: RangeGaugeDecreaseLiquidityParams): Hex;
export declare function buildCollectRangeNativeFeesCall(positionId: bigint, poolId: Hex, amount0Minimum: bigint, amount1Minimum: bigint, deadline: bigint): Hex;
export declare function buildRebalanceRangeLiquidityCall(positionId: bigint, poolId: Hex, params: RangeGaugeRebalanceLiquidityParams): Hex;
export declare function buildExitRangeLiquidityCall(positionId: bigint, poolId: Hex, amount0Minimum: bigint, amount1Minimum: bigint, deadline: bigint): Hex;
export declare function buildClaimRangeLpRewardsCall(positionId: bigint, poolId: Hex, slots: readonly number[], minimumAmounts: readonly bigint[], receiver: Address): Hex;
export declare function buildForfeitRangeLpRewardCall(positionId: bigint, poolId: Hex, slot: number): Hex;
export declare function buildRecoverUnboundPosmCall(manager: Address, posmTokenId: bigint, receiver: Address): Hex;
export declare function buildReconcilePoolRewardSurplusCall(poolId: Hex, slot: number): Hex;
export declare function buildGaugeRewardDurationCall(): Hex;
export declare function buildGaugeRewardAssetAllowedCall(asset: Address): Hex;
export declare function buildPoolRewardConfigCall(poolId: Hex): Hex;
export declare function buildGaugePoolCall(poolId: Hex): Hex;
export declare function buildPoolRewardStreamCall(poolId: Hex, slot: number): Hex;
export declare function buildPoolRewardCustodyAccountCall(poolId: Hex, slot: number): Hex;
export declare function buildGaugeBoundaryCall(poolId: Hex, tick: number): Hex;
export declare function buildPositionGaugePoolsCall(positionId: bigint, cursor: bigint, size: bigint): Hex;
export declare function buildRangeGaugeLpLegCall(positionId: bigint, poolId: Hex): Hex;
export declare function buildPosmBindingCall(posmTokenId: bigint): Hex;
export declare function buildRangeGaugeLiquidityManagerCall(): Hex;
export declare function buildRecordedLiquidityManagerCall(positionId: bigint, poolId: Hex): Hex;
export declare function buildPreviewRangeLpRewardsCall(positionId: bigint, poolId: Hex): Hex;
export declare function buildPreviewNativeLpFeesCall(positionId: bigint, poolId: Hex): Hex;
export declare function isRangeGaugeClaimOnlyLeg(leg: RangeGaugeLpLeg): boolean;
export declare function decodeRangeGaugeLpLegResult(data: Hex): RangeGaugeLpLegState;
export declare function decodeRangeGaugePoolRewardConfigResult(data: Hex): RangeGaugePoolRewardConfig;
export declare function decodeRangeGaugePoolResult(data: Hex): RangeGaugePool;
export declare function decodeRangeGaugeRewardStreamResult(data: Hex): RangeGaugeRewardStream;
export declare function decodeRangeGaugeBoundaryResult(data: Hex): RangeGaugeBoundary;
export declare function decodePositionGaugePoolsResult(data: Hex): RangeGaugePositionPoolPage;
export declare function decodePreviewRangeLpRewardsResult(data: Hex): RangeGaugePendingRewards;
export declare function decodePreviewNativeLpFeesResult(data: Hex): readonly [bigint, bigint];
