import { type Address, type ContractEventArgs, type Hex } from "viem";
export declare const MAX_POSITION_MARKET_PAGE_SIZE = 100n;
export declare const MAX_POSITION_ROYALTY_BPS = 1000;
export type PositionStake = {
    stakedBalance: bigint;
    rewardMultiplierBps: number;
    claimAssetCount: bigint;
    optedInAssetCount: bigint;
};
export type PositionRewardSelection = {
    selected: boolean;
    eligibleStake: bigint;
    eligibleWeight: bigint;
    pendingStake: bigint;
    pendingWeight: bigint;
    eligibleAt: number;
};
export type PositionRewardSelectionWithTiming = {
    selection: PositionRewardSelection;
    /** Weighted effective start; zero when no stake is effectively pending. */
    pendingStartTime: number;
};
export type PositionAddressPage = {
    assets: readonly Address[];
    nextCursor: bigint;
};
export type PositionRoyalty = {
    receiver: Address;
    royaltyBps: number;
};
export declare const STATICS_REWARD_SELECTION_TIMING_INTERFACE_ID: "0x13cfa782";
export declare const staticsRewardSelectionTimingAbi: readonly [{
    readonly name: "rewardSelectionWithTiming";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "selected";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleStake";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleWeight";
        }, {
            readonly type: "uint256";
            readonly name: "pendingStake";
        }, {
            readonly type: "uint256";
            readonly name: "pendingWeight";
        }, {
            readonly type: "uint40";
            readonly name: "eligibleAt";
        }];
        readonly name: "selection";
    }, {
        readonly type: "uint40";
        readonly name: "pendingStartTime";
    }];
}];
export declare const staticsPositionMarketAbi: readonly [{
    readonly name: "royaltyInfo";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "uint256";
        readonly name: "salePrice";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "royaltyAmount";
    }];
}, {
    readonly name: "positionRoyalty";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint16";
        readonly name: "royaltyBps";
    }];
}, {
    readonly name: "setPositionRoyalty";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint16";
        readonly name: "royaltyBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "pendingRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address[]";
        readonly name: "assets";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amounts";
    }];
}, {
    readonly name: "stakePosition";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "stakedBalance";
        }, {
            readonly type: "uint16";
            readonly name: "rewardMultiplierBps";
        }, {
            readonly type: "uint256";
            readonly name: "claimAssetCount";
        }, {
            readonly type: "uint256";
            readonly name: "optedInAssetCount";
        }];
        readonly name: "position";
    }];
}, {
    readonly name: "positionRewardAssets";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }];
}, {
    readonly name: "isRewardAssetOptedIn";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "rewardSelection";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "selected";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleStake";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleWeight";
        }, {
            readonly type: "uint256";
            readonly name: "pendingStake";
        }, {
            readonly type: "uint256";
            readonly name: "pendingWeight";
        }, {
            readonly type: "uint40";
            readonly name: "eligibleAt";
        }];
        readonly name: "selection";
    }];
}, {
    readonly name: "rewardSelectionWithTiming";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "selected";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleStake";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleWeight";
        }, {
            readonly type: "uint256";
            readonly name: "pendingStake";
        }, {
            readonly type: "uint256";
            readonly name: "pendingWeight";
        }, {
            readonly type: "uint40";
            readonly name: "eligibleAt";
        }];
        readonly name: "selection";
    }, {
        readonly type: "uint40";
        readonly name: "pendingStartTime";
    }];
}, {
    readonly name: "globalRewardAssetsOfPosition";
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
        readonly name: "limit";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "PositionRoyaltyUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "royaltyBps";
    }];
}, {
    readonly name: "PositionRoyaltyAlreadyInitialized";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "PositionRoyaltyNotInitialized";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidPositionRoyaltyReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "PositionRoyaltyExceedsMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "royaltyBps";
    }, {
        readonly type: "uint256";
        readonly name: "maximumRoyaltyBps";
    }];
}, {
    readonly name: "InvalidRewardAssetPageSize";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}];
export declare const staticsPositionRoyaltyAbi: readonly [{
    readonly name: "royaltyInfo";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "uint256";
        readonly name: "salePrice";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "royaltyAmount";
    }];
}, {
    readonly name: "positionRoyalty";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint16";
        readonly name: "royaltyBps";
    }];
}, {
    readonly name: "setPositionRoyalty";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint16";
        readonly name: "royaltyBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "PositionRoyaltyUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "royaltyBps";
    }];
}];
export type PositionMarketEventName = "PositionRoyaltyUpdated";
export type PositionMarketEventArgs<Name extends PositionMarketEventName> = ContractEventArgs<typeof staticsPositionMarketAbi, Name>;
export declare function buildSetPositionRoyaltyCall(receiver: Address, royaltyBps: number): Hex;
export declare function buildPositionRoyaltyCall(): Hex;
export declare function buildPositionRoyaltyInfoCall(tokenId: bigint, salePrice: bigint): Hex;
export declare function buildPositionPendingRewardsCall(positionId: bigint, assets: readonly Address[]): Hex;
export declare function buildPositionStakeCall(positionId: bigint): Hex;
export declare function buildPositionRewardAssetsCall(positionId: bigint): Hex;
export declare function buildPositionRewardOptInStatusCall(positionId: bigint, asset: Address): Hex;
export declare function buildPositionRewardSelectionCall(positionId: bigint, asset: Address): Hex;
/** Requires IStaticsRewardSelectionTiming support on the selected diamond. */
export declare function buildPositionRewardSelectionWithTimingCall(positionId: bigint, asset: Address): Hex;
export declare function buildGlobalRewardAssetsOfPositionCall(positionId: bigint, cursor: bigint, limit: bigint): Hex;
export declare function decodePositionRoyaltyResult(data: Hex): PositionRoyalty;
export declare function decodePositionStakeResult(data: Hex): PositionStake;
export declare function decodePositionRewardSelectionResult(data: Hex): PositionRewardSelection;
export declare function decodePositionRewardSelectionWithTimingResult(data: Hex): PositionRewardSelectionWithTiming;
export declare function decodeGlobalRewardAssetsOfPositionResult(data: Hex): PositionAddressPage;
