import { type Address, type Hex, type PublicClient } from "viem";
import type { V4PoolKey } from "./index.js";
export type { V4PoolKey };
export type BasketConversionRoute = Readonly<{
    currencies: readonly Address[];
    pools: readonly V4PoolKey[];
    hookData: readonly Hex[];
}>;
export type BasketConversionRequest = Readonly<{
    deadline: bigint;
    limit: bigint;
    routeLimits: readonly bigint[];
    preset: boolean;
    routes: readonly BasketConversionRoute[];
}>;
export type BasketConversionStep = Readonly<{
    key: V4PoolKey;
    params: Readonly<{
        zeroForOne: boolean;
        amountSpecified: bigint;
        sqrtPriceLimitX96: bigint;
    }>;
    data: Hex;
}>;
export type BasketConversionBounds = Readonly<{
    maxQuoteIn: bigint;
    minQuoteOut: bigint;
    minBasketOut: bigint;
    deadline: bigint;
}>;
export declare const staticsBasketConversionAbi: readonly [{
    readonly name: "basketConversionConfiguration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "hook";
        }, {
            readonly type: "address";
            readonly name: "zap";
        }, {
            readonly type: "address";
            readonly name: "router";
        }, {
            readonly type: "address";
            readonly name: "poolManager";
        }];
    }];
}, {
    readonly name: "basketConversionMarket";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "currency0";
            }, {
                readonly type: "address";
                readonly name: "currency1";
            }, {
                readonly type: "uint24";
                readonly name: "fee";
            }, {
                readonly type: "int24";
                readonly name: "tickSpacing";
            }, {
                readonly type: "address";
                readonly name: "hooks";
            }];
            readonly name: "key";
        }, {
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "address";
            readonly name: "basketToken";
        }, {
            readonly type: "address";
            readonly name: "quote";
        }, {
            readonly type: "bool";
            readonly name: "active";
        }];
    }];
}, {
    readonly name: "createBasketConversionMarket";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "quote";
    }, {
        readonly type: "uint256";
        readonly name: "maximumCreationFee";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "decommissionBasketConversionMarket";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "mintBasketConversion";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256[]";
        readonly name: "expected";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "prefundBasketConversion";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "payer";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "BasketConversionMarketCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "quote";
        readonly indexed: true;
    }];
}, {
    readonly name: "BasketConversionMarketDecommissioned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}];
export declare const staticsBasketConversionZapAbi: readonly [{
    readonly name: "buy";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint256";
            readonly name: "limit";
        }, {
            readonly type: "uint256[]";
            readonly name: "routeLimits";
        }, {
            readonly type: "bool";
            readonly name: "preset";
        }, {
            readonly components: readonly [{
                readonly type: "Error:";
                readonly name: ["Error: Identifier \"Unbalanced parentheses. \"(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks\" has too many opening parentheses.\" cannot contain whitespace."];
            }];
            readonly type: "tuple[]";
            readonly name: ["Error: Identifier \"pools,bytes[] hookData)[] routes\" cannot contain whitespace."];
        }];
        readonly name: "r";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "sell";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint256";
            readonly name: "limit";
        }, {
            readonly type: "uint256[]";
            readonly name: "routeLimits";
        }, {
            readonly type: "bool";
            readonly name: "preset";
        }, {
            readonly components: readonly [{
                readonly type: "Error:";
                readonly name: ["Error: Identifier \"Unbalanced parentheses. \"(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks\" has too many opening parentheses.\" cannot contain whitespace."];
            }];
            readonly type: "tuple[]";
            readonly name: ["Error: Identifier \"pools,bytes[] hookData)[] routes\" cannot contain whitespace."];
        }];
        readonly name: "r";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
export declare const staticsBasketConversionHookAbi: readonly [{
    readonly name: "setPreset";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "bool";
        readonly name: "buying";
    }, {
        readonly components: readonly [{
            readonly type: "Error:";
            readonly name: ["Error: Identifier \"Unbalanced parentheses. \"(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks\" has too many opening parentheses.\" cannot contain whitespace."];
        }];
        readonly type: "tuple[]";
        readonly name: ["Error: Identifier \"pools,bytes[] hookData)[] paths\" cannot contain whitespace."];
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "preset";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "bool";
        readonly name: "buying";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "address[]";
            readonly name: "currencies";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "currency0";
            }, {
                readonly type: "address";
                readonly name: "currency1";
            }, {
                readonly type: "uint24";
                readonly name: "fee";
            }, {
                readonly type: "int24";
                readonly name: "tickSpacing";
            }, {
                readonly type: "address";
                readonly name: "hooks";
            }];
            readonly name: "pools";
        }, {
            readonly type: "bytes[]";
            readonly name: "hookData";
        }];
    }];
}, {
    readonly name: "BasketConversionPresetSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "buying";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "routesHash";
    }];
}];
export declare const staticsBasketConversionRouterAbi: readonly [{
    readonly name: "execute";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "currency0";
            }, {
                readonly type: "address";
                readonly name: "currency1";
            }, {
                readonly type: "uint24";
                readonly name: "fee";
            }, {
                readonly type: "int24";
                readonly name: "tickSpacing";
            }, {
                readonly type: "address";
                readonly name: "hooks";
            }];
            readonly name: "key";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "bool";
                readonly name: "zeroForOne";
            }, {
                readonly type: "int256";
                readonly name: "amountSpecified";
            }, {
                readonly type: "uint160";
                readonly name: "sqrtPriceLimitX96";
            }];
            readonly name: "params";
        }, {
            readonly type: "bytes";
            readonly name: "data";
        }];
        readonly name: "steps";
    }, {
        readonly type: "uint256";
        readonly name: "prefund";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "maxQuoteIn";
        }, {
            readonly type: "uint256";
            readonly name: "minQuoteOut";
        }, {
            readonly type: "uint256";
            readonly name: "minBasketOut";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "bounds";
    }];
    readonly outputs: readonly [{
        readonly type: "int256";
        readonly name: "quoteDelta";
    }];
}];
/** Bounds include existing basket charges and underlying swaps; no outer conversion fee is added. */
export declare function validateBasketConversionRequest(r: BasketConversionRequest): void;
/** Hook modes are exact basket output when buying and exact basket input when selling. */
export declare function encodeBasketConversionRequest(r: BasketConversionRequest): Hex;
export declare function buildBasketConversionZapCall(mode: "buy" | "sell", poolId: Hex, shares: bigint, receiver: Address, r: BasketConversionRequest): Hex;
export declare function buildBasketConversionRouterCall(poolId: Hex, steps: readonly BasketConversionStep[], prefund: bigint, b: BasketConversionBounds): Hex;
export declare function buildCreateBasketConversionMarketCall(basketId: bigint, quote: Address, maximumCreationFee: bigint, deadline: bigint): Hex;
export declare function readBasketConversionMarket(client: PublicClient, diamond: Address, poolId: Hex): Promise<{
    key: {
        tickSpacing: number;
        currency0: `0x${string}`;
        currency1: `0x${string}`;
        fee: number;
        hooks: `0x${string}`;
    };
    basketId: bigint;
    basketToken: `0x${string}`;
    quote: `0x${string}`;
    active: boolean;
}>;
/** Simulate from the real payer: approvals, lifecycle, route liquidity and fee rounding affect executability. */
export declare function simulateBasketConversionZap(client: PublicClient, zap: Address, payer: Address, mode: "buy" | "sell", poolId: Hex, shares: bigint, receiver: Address, r: BasketConversionRequest): Promise<import("viem").SimulateContractReturnType<readonly [{
    readonly name: "buy";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint256";
            readonly name: "limit";
        }, {
            readonly type: "uint256[]";
            readonly name: "routeLimits";
        }, {
            readonly type: "bool";
            readonly name: "preset";
        }, {
            readonly components: readonly [{
                readonly type: "Error:";
                readonly name: ["Error: Identifier \"Unbalanced parentheses. \"(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks\" has too many opening parentheses.\" cannot contain whitespace."];
            }];
            readonly type: "tuple[]";
            readonly name: ["Error: Identifier \"pools,bytes[] hookData)[] routes\" cannot contain whitespace."];
        }];
        readonly name: "r";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "sell";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint256";
            readonly name: "limit";
        }, {
            readonly type: "uint256[]";
            readonly name: "routeLimits";
        }, {
            readonly type: "bool";
            readonly name: "preset";
        }, {
            readonly components: readonly [{
                readonly type: "Error:";
                readonly name: ["Error: Identifier \"Unbalanced parentheses. \"(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks\" has too many opening parentheses.\" cannot contain whitespace."];
            }];
            readonly type: "tuple[]";
            readonly name: ["Error: Identifier \"pools,bytes[] hookData)[] routes\" cannot contain whitespace."];
        }];
        readonly name: "r";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}], "buy" | "sell", readonly [`0x${string}`, bigint, `0x${string}`, Readonly<{
    deadline: bigint;
    limit: bigint;
    routeLimits: readonly bigint[];
    preset: boolean;
    routes: readonly BasketConversionRoute[];
}>], import("viem").Chain | undefined, undefined, import("viem").Chain | undefined, `0x${string}`>>;
export declare function simulateBasketConversionRouter(client: PublicClient, router: Address, payer: Address, poolId: Hex, steps: readonly BasketConversionStep[], prefund: bigint, b: BasketConversionBounds): Promise<import("viem").SimulateContractReturnType<readonly [{
    readonly name: "execute";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "currency0";
            }, {
                readonly type: "address";
                readonly name: "currency1";
            }, {
                readonly type: "uint24";
                readonly name: "fee";
            }, {
                readonly type: "int24";
                readonly name: "tickSpacing";
            }, {
                readonly type: "address";
                readonly name: "hooks";
            }];
            readonly name: "key";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "bool";
                readonly name: "zeroForOne";
            }, {
                readonly type: "int256";
                readonly name: "amountSpecified";
            }, {
                readonly type: "uint160";
                readonly name: "sqrtPriceLimitX96";
            }];
            readonly name: "params";
        }, {
            readonly type: "bytes";
            readonly name: "data";
        }];
        readonly name: "steps";
    }, {
        readonly type: "uint256";
        readonly name: "prefund";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "maxQuoteIn";
        }, {
            readonly type: "uint256";
            readonly name: "minQuoteOut";
        }, {
            readonly type: "uint256";
            readonly name: "minBasketOut";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "bounds";
    }];
    readonly outputs: readonly [{
        readonly type: "int256";
        readonly name: "quoteDelta";
    }];
}], "execute", readonly [`0x${string}`, readonly Readonly<{
    key: V4PoolKey;
    params: Readonly<{
        zeroForOne: boolean;
        amountSpecified: bigint;
        sqrtPriceLimitX96: bigint;
    }>;
    data: Hex;
}>[], bigint, Readonly<{
    maxQuoteIn: bigint;
    minQuoteOut: bigint;
    minBasketOut: bigint;
    deadline: bigint;
}>], import("viem").Chain | undefined, undefined, import("viem").Chain | undefined, `0x${string}`>>;
/** Discover registered identities over an explicit block range; retired markets remain discoverable. */
export declare function discoverBasketConversionMarkets(client: PublicClient, diamond: Address, fromBlock: bigint, toBlock: bigint, basketId?: bigint): Promise<{
    key: {
        tickSpacing: number;
        currency0: `0x${string}`;
        currency1: `0x${string}`;
        fee: number;
        hooks: `0x${string}`;
    };
    basketId: bigint;
    basketToken: `0x${string}`;
    quote: `0x${string}`;
    active: boolean;
}[]>;
export declare const staticsBasketDistributorAbi: readonly [{
    readonly name: "setBasketDistributor";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "bool";
        readonly name: "allowed";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "isBasketDistributor";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "BasketDistributorSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "account";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "allowed";
    }];
}];
export declare function buildSetBasketDistributorCall(basketId: bigint, account: Address, allowed: boolean): Hex;
export type ReviewedBasketConversionMarket = Readonly<{
    chainId: number;
    basketId: bigint;
    poolId: Hex;
    quote: Address;
    /** Constituents in the order stored on the Diamond. */
    assets: readonly Address[];
    /** A direct quote/constituent pool at each index, or null for the quote asset itself. */
    pools: readonly (V4PoolKey | null)[];
}>;
export declare function quoteReviewedBasketConversion(client: PublicClient, diamond: Address, quoter: Address, reviewed: ReviewedBasketConversionMarket, mode: "buy" | "sell", shares: bigint, slippageBps: bigint): Promise<{
    blockNumber: bigint;
    total: bigint;
    request: Readonly<{
        deadline: bigint;
        limit: bigint;
        routeLimits: readonly bigint[];
        preset: boolean;
        routes: readonly BasketConversionRoute[];
    }>;
    zap: `0x${string}`;
    basketToken: `0x${string}`;
}>;
