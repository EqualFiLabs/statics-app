import { type ContractEventArgs, type Hex } from "viem";
export declare const MARKET_FLAG_ZERO_FOR_ONE: number;
export declare const MARKET_FLAG_EXACT_OUTPUT: number;
export declare const MARKET_FLAG_PERMISSIONED: number;
export declare const MARKET_FLAG_INTERNAL: number;
export declare const MARKET_FLAG_PARTIAL: number;
export declare const MARKET_SAT_EXTERNAL_VOLUME0: number;
export declare const MARKET_SAT_EXTERNAL_VOLUME1: number;
export declare const MARKET_SAT_INTERNAL_VOLUME0: number;
export declare const MARKET_SAT_INTERNAL_VOLUME1: number;
export declare const MARKET_SAT_STATICS_FEES0: number;
export declare const MARKET_SAT_STATICS_FEES1: number;
export declare const MARKET_SAT_EXTERNAL_SWAP_COUNT: number;
export declare const MARKET_SAT_INTERNAL_SWAP_COUNT: number;
export declare const DEFAULT_MARKET_OBSERVATION_CADENCE: number;
export declare const DEFAULT_MARKET_OBSERVATION_CARDINALITY = 96;
export declare const MIN_MARKET_OBSERVATION_CADENCE = 60;
export declare const MAX_MARKET_OBSERVATION_CADENCE: number;
export declare const MAX_MARKET_OBSERVATION_CARDINALITY = 672;
export declare const MAX_MARKET_OBSERVE_QUERIES = 64;
export type CanonicalMarketState = {
    externalVolume0: bigint;
    externalVolume1: bigint;
    internalVolume0: bigint;
    internalVolume1: bigint;
    staticsFees0: bigint;
    staticsFees1: bigint;
    externalSwapCount: bigint;
    internalSwapCount: bigint;
    sequence: bigint;
    tickCumulative: bigint;
    lastTimestamp: number;
    lastTick: number;
    lastNativeLpFee: number;
    lastFlags: number;
    saturatedFields: number;
};
export type MarketObservationConfig = {
    initialized: boolean;
    enabled: boolean;
    cadence: number;
    cardinality: number;
    cardinalityNext: number;
    stored: bigint;
    latestId: bigint;
    lastObservationTimestamp: number;
    failedWriteCount: bigint;
    lastFailedSequence: bigint;
};
export type MarketObservation = {
    timestamp: number;
    tick: number;
    nativeLpFee: number;
    flags: number;
    sequence: bigint;
    tickCumulative: bigint;
    externalVolume0: bigint;
    externalVolume1: bigint;
    internalVolume0: bigint;
    internalVolume1: bigint;
    staticsFees0: bigint;
    staticsFees1: bigint;
    externalSwapCount: bigint;
    internalSwapCount: bigint;
};
export declare const staticsSwapCallbackAbi: readonly [{
    readonly name: "afterStaticsPoolSwap";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "int256";
        readonly name: "poolDelta";
    }, {
        readonly type: "uint256";
        readonly name: "staticsFeesPacked";
    }, {
        readonly type: "uint8";
        readonly name: "flags";
    }];
    readonly outputs: readonly [];
}];
export declare const staticsMarketTapeAbi: readonly [{
    readonly name: "canonicalMarketState";
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
            readonly name: "externalVolume0";
        }, {
            readonly type: "uint256";
            readonly name: "externalVolume1";
        }, {
            readonly type: "uint256";
            readonly name: "internalVolume0";
        }, {
            readonly type: "uint256";
            readonly name: "internalVolume1";
        }, {
            readonly type: "uint256";
            readonly name: "staticsFees0";
        }, {
            readonly type: "uint256";
            readonly name: "staticsFees1";
        }, {
            readonly type: "uint256";
            readonly name: "externalSwapCount";
        }, {
            readonly type: "uint256";
            readonly name: "internalSwapCount";
        }, {
            readonly type: "uint256";
            readonly name: "sequence";
        }, {
            readonly type: "int256";
            readonly name: "tickCumulative";
        }, {
            readonly type: "uint40";
            readonly name: "lastTimestamp";
        }, {
            readonly type: "int24";
            readonly name: "lastTick";
        }, {
            readonly type: "uint24";
            readonly name: "lastNativeLpFee";
        }, {
            readonly type: "uint8";
            readonly name: "lastFlags";
        }, {
            readonly type: "uint8";
            readonly name: "saturatedFields";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "setMarketObservationConfig";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "bool";
        readonly name: "enabled";
    }, {
        readonly type: "uint32";
        readonly name: "cadence";
    }, {
        readonly type: "uint16";
        readonly name: "cardinalityNext";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "recordMarketObservation";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "expectedSequence";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "marketObservationConfig";
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
            readonly name: "enabled";
        }, {
            readonly type: "uint32";
            readonly name: "cadence";
        }, {
            readonly type: "uint16";
            readonly name: "cardinality";
        }, {
            readonly type: "uint16";
            readonly name: "cardinalityNext";
        }, {
            readonly type: "uint64";
            readonly name: "stored";
        }, {
            readonly type: "uint64";
            readonly name: "latestId";
        }, {
            readonly type: "uint40";
            readonly name: "lastObservationTimestamp";
        }, {
            readonly type: "uint256";
            readonly name: "failedWriteCount";
        }, {
            readonly type: "uint256";
            readonly name: "lastFailedSequence";
        }];
        readonly name: "config";
    }];
}, {
    readonly name: "marketObservation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint64";
        readonly name: "observationId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint40";
            readonly name: "timestamp";
        }, {
            readonly type: "int24";
            readonly name: "tick";
        }, {
            readonly type: "uint24";
            readonly name: "nativeLpFee";
        }, {
            readonly type: "uint8";
            readonly name: "flags";
        }, {
            readonly type: "uint256";
            readonly name: "sequence";
        }, {
            readonly type: "int256";
            readonly name: "tickCumulative";
        }, {
            readonly type: "uint256";
            readonly name: "externalVolume0";
        }, {
            readonly type: "uint256";
            readonly name: "externalVolume1";
        }, {
            readonly type: "uint256";
            readonly name: "internalVolume0";
        }, {
            readonly type: "uint256";
            readonly name: "internalVolume1";
        }, {
            readonly type: "uint256";
            readonly name: "staticsFees0";
        }, {
            readonly type: "uint256";
            readonly name: "staticsFees1";
        }, {
            readonly type: "uint256";
            readonly name: "externalSwapCount";
        }, {
            readonly type: "uint256";
            readonly name: "internalSwapCount";
        }];
        readonly name: "observation";
    }];
}, {
    readonly name: "observeMarket";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint32[]";
        readonly name: "secondsAgo";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint40";
            readonly name: "timestamp";
        }, {
            readonly type: "int24";
            readonly name: "tick";
        }, {
            readonly type: "uint24";
            readonly name: "nativeLpFee";
        }, {
            readonly type: "uint8";
            readonly name: "flags";
        }, {
            readonly type: "uint256";
            readonly name: "sequence";
        }, {
            readonly type: "int256";
            readonly name: "tickCumulative";
        }, {
            readonly type: "uint256";
            readonly name: "externalVolume0";
        }, {
            readonly type: "uint256";
            readonly name: "externalVolume1";
        }, {
            readonly type: "uint256";
            readonly name: "internalVolume0";
        }, {
            readonly type: "uint256";
            readonly name: "internalVolume1";
        }, {
            readonly type: "uint256";
            readonly name: "staticsFees0";
        }, {
            readonly type: "uint256";
            readonly name: "staticsFees1";
        }, {
            readonly type: "uint256";
            readonly name: "externalSwapCount";
        }, {
            readonly type: "uint256";
            readonly name: "internalSwapCount";
        }];
        readonly name: "observations";
    }];
}, {
    readonly name: "MarketSwapRecorded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "sequence";
        readonly indexed: true;
    }, {
        readonly type: "int256";
        readonly name: "poolDelta";
    }, {
        readonly type: "uint256";
        readonly name: "staticsFeesPacked";
    }, {
        readonly type: "int24";
        readonly name: "finalTick";
    }, {
        readonly type: "uint24";
        readonly name: "nativeLpFee";
    }, {
        readonly type: "uint8";
        readonly name: "flags";
    }];
}, {
    readonly name: "MarketObservationConfigSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "enabled";
    }, {
        readonly type: "uint32";
        readonly name: "cadence";
    }, {
        readonly type: "uint16";
        readonly name: "cardinalityNext";
    }];
}, {
    readonly name: "MarketObservationCommitted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint64";
        readonly name: "observationId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "sequence";
    }];
}, {
    readonly name: "MarketObservationWriteFailed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "sequence";
        readonly indexed: true;
    }];
}, {
    readonly name: "OnlyDiamondSelf";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "CanonicalSequenceMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }];
}, {
    readonly name: "NoMarketObservations";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "MarketObservationNotFound";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint64";
        readonly name: "observationId";
    }];
}, {
    readonly name: "ObservationQueryInFuture";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "secondsAgo";
    }, {
        readonly type: "uint256";
        readonly name: "timestamp";
    }];
}, {
    readonly name: "ObservationTooOld";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "target";
    }, {
        readonly type: "uint256";
        readonly name: "oldest";
    }];
}, {
    readonly name: "TooManyObservationQueries";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "InvalidMarketFlags";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "flags";
    }];
}, {
    readonly name: "InvalidInternalMarketFlags";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "flags";
    }];
}, {
    readonly name: "MarketTimestampOverflow";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "timestamp";
    }];
}, {
    readonly name: "InvalidObservationCadence";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "cadence";
    }];
}, {
    readonly name: "InvalidObservationCardinality";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "cardinality";
    }];
}];
export type MarketTapeEventName = "MarketSwapRecorded" | "MarketObservationConfigSet" | "MarketObservationCommitted" | "MarketObservationWriteFailed";
export type MarketTapeEventArgs<Name extends MarketTapeEventName> = ContractEventArgs<typeof staticsMarketTapeAbi, Name>;
export declare function buildCanonicalMarketStateCall(poolId: Hex): Hex;
export declare function buildSetMarketObservationConfigCall(poolId: Hex, enabled: boolean, cadence: number, cardinalityNext: number): Hex;
export declare function buildMarketObservationConfigCall(poolId: Hex): Hex;
export declare function buildMarketObservationCall(poolId: Hex, observationId: bigint): Hex;
export declare function buildObserveMarketCall(poolId: Hex, secondsAgo: readonly number[]): Hex;
export declare function decodeCanonicalMarketStateResult(data: Hex): CanonicalMarketState;
export declare function decodeMarketObservationConfigResult(data: Hex): MarketObservationConfig;
export declare function decodeMarketObservationResult(data: Hex): MarketObservation;
export declare function decodeObserveMarketResult(data: Hex): readonly MarketObservation[];
export declare function hasMarketFlag(flags: number, flag: number): boolean;
export declare function hasMarketSaturation(saturatedFields: number, field: number): boolean;
