import { type Address, type ContractEventArgs, type Hex } from "viem";
export { robinhoodChain } from "./generated/robinhoodChain.js";
export * from "./gauge-incentives.js";
export * from "./market-tape.js";
export * from "./range-gauges.js";
export declare const BPS = 10000n;
export declare const SHARE_SCALE: bigint;
export declare const MAX_LTV_BPS = 9500n;
export declare const LOAN_RECOVERY_GRACE_PERIOD = 3600n;
export declare const RECOVERY_CALLER_SHARE_BPS = 2000n;
export declare const POSITION_PORTFOLIO_MAX_PAGE_SIZE = 100n;
export declare const Q96: bigint;
export declare const Q128: bigint;
export declare const Q192: bigint;
export declare const MAX_UINT256: bigint;
export declare const MORPHO_ORACLE_PRICE_SCALE: bigint;
export declare const MORPHO_LLTV_SCALE: bigint;
export declare const MORPHO_VIRTUAL_ASSETS = 1n;
export declare const MORPHO_VIRTUAL_SHARES = 1000000n;
export declare const MIN_TICK = -887272;
export declare const MAX_TICK = 887272;
export declare const STATICS_MAX_SUPPLY: bigint;
export declare const STATICS_TREASURY_ALLOCATION: bigint;
export declare const STATICS_DOPPLER_INVENTORY: bigint;
export declare const GENESIS_COLLECTION_SIZE = 5555n;
export declare const GENESIS_VAULT_PRICE: bigint;
export declare const GENESIS_FULL_BACKING: bigint;
export declare const GENESIS_SUPPLY_RESIDUAL: bigint;
export declare const TREASURY_GENESIS_COUNT = 555n;
export declare const TREASURY_GENESIS_FIRST_ID = 5001n;
export declare const TREASURY_GENESIS_LAST_ID = 5555n;
export declare const TREASURY_GENESIS_BACKING: bigint;
export declare const TREASURY_STATICS_VESTING_PRINCIPAL: bigint;
export declare const TREASURY_VESTING_DURATION: bigint;
export declare const TREASURY_GENESIS_RELEASE_BATCH_CAP = 50n;
export declare const DOPPLER_OWNER_FEE_SHARE: bigint;
export declare const STATICS_FEE_RECEIVER_SHARE: bigint;
export declare const GENESIS_RESERVE_DENOMINATOR = 5555n;
export declare const GENESIS_RESERVE_BUY_IN_DENOMINATOR: bigint;
export declare const GENESIS_DEFAULT_NATIVE_ACQUISITION_FEE: bigint;
export declare const GENESIS_MAX_NATIVE_ACQUISITION_FEE: bigint;
export declare const STATICS_FLASH_CALLBACK_SUCCESS: `0x${string}`;
export declare const STATICS_FLASH_ASSET_CALLBACK_SUCCESS: `0x${string}`;
export type DopplerGenesisCurve = {
    name: "low" | "medium" | "high" | "filler";
    tickLower: number;
    tickUpper: number;
    numPositions: number;
    shareWad: bigint;
    staticsAmount: bigint;
};
export type MorphoMarketParams = {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
};
export type MorphoMarket = {
    totalSupplyAssets: bigint;
    totalSupplyShares: bigint;
    totalBorrowAssets: bigint;
    totalBorrowShares: bigint;
    lastUpdate: bigint;
    fee: bigint;
};
export type MorphoPosition = {
    supplyShares: bigint;
    borrowShares: bigint;
    collateral: bigint;
};
export type StaticsMorphoMarket = {
    params: MorphoMarketParams;
    kind: number;
    mode: number;
    basketId: bigint;
};
export type StaticsMorphoPosition = {
    trackedCollateral: bigint;
    actualCollateral: bigint;
    untrackedSurplus: bigint;
    borrowShares: bigint;
    debtActive: boolean;
};
export type MorphoHealth = {
    suppliedAssets: bigint;
    borrowedAssets: bigint;
    availableLiquidity: bigint;
    utilizationWad: bigint;
    maximumBorrowAssets: bigint;
    borrowHeadroomAssets: bigint;
    healthFactorWad: bigint | null;
};
export declare const morphoBlueAbi: readonly [{
    readonly name: "supply";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "loanToken";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "address";
            readonly name: "irm";
        }, {
            readonly type: "uint256";
            readonly name: "lltv";
        }];
        readonly name: "marketParams";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "onBehalf";
    }, {
        readonly type: "bytes";
        readonly name: "data";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "assetsSupplied";
    }, {
        readonly type: "uint256";
        readonly name: "sharesSupplied";
    }];
}, {
    readonly name: "withdraw";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "loanToken";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "address";
            readonly name: "irm";
        }, {
            readonly type: "uint256";
            readonly name: "lltv";
        }];
        readonly name: "marketParams";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "onBehalf";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "assetsWithdrawn";
    }, {
        readonly type: "uint256";
        readonly name: "sharesWithdrawn";
    }];
}, {
    readonly name: "position";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
    }, {
        readonly type: "address";
        readonly name: "user";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "supplyShares";
        }, {
            readonly type: "uint128";
            readonly name: "borrowShares";
        }, {
            readonly type: "uint128";
            readonly name: "collateral";
        }];
        readonly name: "position";
    }];
}, {
    readonly name: "market";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "totalSupplyAssets";
        }, {
            readonly type: "uint128";
            readonly name: "totalSupplyShares";
        }, {
            readonly type: "uint128";
            readonly name: "totalBorrowAssets";
        }, {
            readonly type: "uint128";
            readonly name: "totalBorrowShares";
        }, {
            readonly type: "uint128";
            readonly name: "lastUpdate";
        }, {
            readonly type: "uint128";
            readonly name: "fee";
        }];
        readonly name: "market";
    }];
}, {
    readonly name: "idToMarketParams";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "loanToken";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "address";
            readonly name: "irm";
        }, {
            readonly type: "uint256";
            readonly name: "lltv";
        }];
        readonly name: "marketParams";
    }];
}, {
    readonly name: "Supply";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "onBehalf";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "Withdraw";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "onBehalf";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "Borrow";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "onBehalf";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "Repay";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "onBehalf";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "Liquidate";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "borrower";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "repaidAssets";
    }, {
        readonly type: "uint256";
        readonly name: "repaidShares";
    }, {
        readonly type: "uint256";
        readonly name: "seizedAssets";
    }, {
        readonly type: "uint256";
        readonly name: "badDebtAssets";
    }, {
        readonly type: "uint256";
        readonly name: "badDebtShares";
    }];
}];
export declare const DOPPLER_GENESIS_FIXTURE: {
    readonly productionApproved: false;
    readonly sdkRevision: "daa12c19d849f41ec5126168055935b143948c54";
    readonly contractsRevision: "86a5200456b148c156d2eb81a893747dd601c3ca";
    readonly tickSpacing: 100;
    readonly farTick: -83100;
    readonly curves: readonly [{
        readonly name: "low";
        readonly tickLower: -887200;
        readonly tickUpper: -142200;
        readonly numPositions: 11;
        readonly shareWad: 500000000000000000n;
        readonly staticsAmount: bigint;
    }, {
        readonly name: "medium";
        readonly tickLower: -222200;
        readonly tickUpper: -116300;
        readonly numPositions: 11;
        readonly shareWad: 250000000000000000n;
        readonly staticsAmount: bigint;
    }, {
        readonly name: "high";
        readonly tickLower: -176200;
        readonly tickUpper: -84100;
        readonly numPositions: 11;
        readonly shareWad: 240000000000000000n;
        readonly staticsAmount: bigint;
    }, {
        readonly name: "filler";
        readonly tickLower: -84100;
        readonly tickUpper: -83000;
        readonly numPositions: 11;
        readonly shareWad: 10000000000000000n;
        readonly staticsAmount: bigint;
    }];
};
export declare const dopplerGenesisModules: {
    readonly 4663: {
        readonly airlock: "0xeB7c034704eF8dCd2d32324C1545f62fb4aD0862";
        readonly tokenFactory: "0x1B37D3a72082029c44b35B604eA473617580b69A";
        readonly governanceFactory: "0xDB036746d65dD52126b1915F1Adf555E6C5237Cf";
        readonly poolInitializer: "0x4E3468951D49f2eeA976ed0d6e75FfCB44a9a544";
        readonly noOpMigrator: "0xBA2F330EDb16CD8056F5988D8CE19bBc63475a0E";
    };
    readonly 84532: {
        readonly airlock: "0x3411306cE66c9469BFf1535BA955503c4BDE1C6E";
        readonly tokenFactory: "0x89C261c05B5F9B6bCbA07C199B8DeE7CFaD45292";
        readonly governanceFactory: "0x0902e7C7207dF8ED6303aef4382bCAb181B5fbfA";
        readonly poolInitializer: "0xBDF938149aC6a781f94FaA0eD45E6A0E984c6544";
        readonly noOpMigrator: "0xF11066ABBd329aC4BbA39455340539322C222EB0";
    };
};
export declare function getDopplerGenesisModules(chainId: number): {
    readonly airlock: "0xeB7c034704eF8dCd2d32324C1545f62fb4aD0862";
    readonly tokenFactory: "0x1B37D3a72082029c44b35B604eA473617580b69A";
    readonly governanceFactory: "0xDB036746d65dD52126b1915F1Adf555E6C5237Cf";
    readonly poolInitializer: "0x4E3468951D49f2eeA976ed0d6e75FfCB44a9a544";
    readonly noOpMigrator: "0xBA2F330EDb16CD8056F5988D8CE19bBc63475a0E";
} | {
    readonly airlock: "0x3411306cE66c9469BFf1535BA955503c4BDE1C6E";
    readonly tokenFactory: "0x89C261c05B5F9B6bCbA07C199B8DeE7CFaD45292";
    readonly governanceFactory: "0x0902e7C7207dF8ED6303aef4382bCAb181B5fbfA";
    readonly poolInitializer: "0xBDF938149aC6a781f94FaA0eD45E6A0E984c6544";
    readonly noOpMigrator: "0xF11066ABBd329aC4BbA39455340539322C222EB0";
};
export declare const staticsGenesisAbi: readonly [{
    readonly name: "COLLECTION_SIZE";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "mintedSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vault";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "treasuryVesting";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "activationRegistry";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "protocol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "launchFinalized";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "contractURI";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "externalURLBase";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "owner";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "pendingOwner";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getApproved";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "isApprovedForAll";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "operator";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setApprovalForAll";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
    }, {
        readonly type: "bool";
        readonly name: "approved";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "transferFrom";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
    }, {
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "safeTransferFrom";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
    }, {
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "safeTransferFrom";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
    }, {
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "bytes";
        readonly name: "data";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "tokenURI";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "locked";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
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
    readonly name: "getTransferValidator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "validator";
    }];
}, {
    readonly name: "getTransferValidationFunction";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes4";
        readonly name: "functionSignature";
    }, {
        readonly type: "bool";
        readonly name: "isViewFunction";
    }];
}, {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }];
}, {
    readonly name: "ConsecutiveTransfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "fromTokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "toTokenId";
    }, {
        readonly type: "address";
        readonly name: "fromAddress";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "toAddress";
        readonly indexed: true;
    }];
}, {
    readonly name: "Approval";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "approved";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }];
}, {
    readonly name: "ApprovalForAll";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "operator";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "approved";
    }];
}, {
    readonly name: "ProtocolBound";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "protocol";
        readonly indexed: true;
    }];
}, {
    readonly name: "MetadataUpdate";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "_tokenId";
    }];
}, {
    readonly name: "BatchMetadataUpdate";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "_fromTokenId";
    }, {
        readonly type: "uint256";
        readonly name: "_toTokenId";
    }];
}, {
    readonly name: "Locked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
}, {
    readonly name: "Unlocked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
}];
export declare const staticsGenesisVaultAbi: readonly [{
    readonly name: "statics";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "finalized";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "buyGenesis";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "redeemGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "donate";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
}, {
    readonly name: "quoteGenesisPurchase";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "staticsPrice";
        }, {
            readonly type: "uint256";
            readonly name: "reserveBuyIn";
        }, {
            readonly type: "uint256";
            readonly name: "nativeFee";
        }, {
            readonly type: "uint256";
            readonly name: "requiredNative";
        }, {
            readonly type: "bool";
            readonly name: "epochActive";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "quoteGenesisRedemption";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "staticsPayout";
        }, {
            readonly type: "uint256";
            readonly name: "reservePayout";
        }, {
            readonly type: "bool";
            readonly name: "epochActive";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "reserveBuyIn";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "reserveRedemptionPayout";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "reserveBackingPerGenesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "reserveDenominator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "epochActive";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "genesisEpochEnd";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "reserveETH";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "tokenBacking";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vaultPrice";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "nativeAcquisitionFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "purchasesPaused";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "circulatingGenesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vaultInventory";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "requiredBacking";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "isVaultInventory";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "vaultAccounting";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "vaultPrice";
        }, {
            readonly type: "uint256";
            readonly name: "maximumSupply";
        }, {
            readonly type: "uint256";
            readonly name: "mintedSupply";
        }, {
            readonly type: "uint256";
            readonly name: "vaultInventory";
        }, {
            readonly type: "uint256";
            readonly name: "circulatingGenesis";
        }, {
            readonly type: "uint256";
            readonly name: "tokenBacking";
        }, {
            readonly type: "uint256";
            readonly name: "grossBacking";
        }, {
            readonly type: "uint256";
            readonly name: "outstandingGenesisCredit";
        }, {
            readonly type: "uint256";
            readonly name: "requiredBacking";
        }, {
            readonly type: "uint256";
            readonly name: "tokenCustody";
        }, {
            readonly type: "uint256";
            readonly name: "reserveETH";
        }, {
            readonly type: "uint256";
            readonly name: "nativeCustody";
        }, {
            readonly type: "uint256";
            readonly name: "genesisEpochEnd";
        }, {
            readonly type: "bool";
            readonly name: "epochActive";
        }, {
            readonly type: "uint256";
            readonly name: "reserveBackingPerGenesis";
        }];
        readonly name: "accounting";
    }];
}, {
    readonly name: "GenesisPurchased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "staticsPrice";
    }, {
        readonly type: "uint256";
        readonly name: "reserveBuyIn";
    }, {
        readonly type: "uint256";
        readonly name: "nativeFee";
    }];
}, {
    readonly name: "GenesisRedeemed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "staticsPayout";
    }, {
        readonly type: "uint256";
        readonly name: "reservePayout";
    }];
}, {
    readonly name: "GenesisCollectionFinalized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "collection";
        readonly indexed: true;
    }];
}, {
    readonly name: "PurchasesPausedSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bool";
        readonly name: "paused";
    }];
}, {
    readonly name: "NativeAcquisitionFeeSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "previousFee";
    }, {
        readonly type: "uint256";
        readonly name: "newFee";
    }];
}, {
    readonly name: "ReserveFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "contributor";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "reserveETH";
    }];
}, {
    readonly name: "PurchaseRefunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
export declare const staticsTreasuryVestingAbi: readonly [{
    readonly name: "STATICS_SUPPLY";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "GENESIS_BACKING_COMMITMENT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "GENESIS_VESTING_PRINCIPAL";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "FIRST_GENESIS_ID";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "LAST_GENESIS_ID";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "VESTING_DURATION";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "MAX_GENESIS_RELEASE_BATCH";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "statics";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesisVault";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "recipientAdmin";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "withdrawalRecipient";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "bootstrapper";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "vestingStart";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vestingEnd";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "releasedGenesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vestedGenesisAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "timestamp";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "releasableGenesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "nextGenesisId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vestingComplete";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "sweepStaticsSurplus";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "releaseGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "maxCount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "count";
    }];
}, {
    readonly name: "setWithdrawalRecipient";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "newRecipient";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "TreasuryVestingBootstrapped";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "statics";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "genesisVault";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "genesis";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "vestingStart";
    }];
}, {
    readonly name: "WithdrawalRecipientUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "previousRecipient";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "newRecipient";
        readonly indexed: true;
    }];
}, {
    readonly name: "StaticsSurplusSwept";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "GenesisReleased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "recipient";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "firstGenesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "lastGenesisId";
    }, {
        readonly type: "uint256";
        readonly name: "count";
    }, {
        readonly type: "uint256";
        readonly name: "totalReleased";
    }];
}];
export declare const dopplerERC20V1VestingAbi: readonly [{
    readonly name: "vestingStart";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vestedTotalAmount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vestingScheduleCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "vestingSchedules";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "scheduleId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
        readonly name: "cliff";
    }, {
        readonly type: "uint64";
        readonly name: "duration";
    }];
}, {
    readonly name: "vestingOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "beneficiary";
    }, {
        readonly type: "uint256";
        readonly name: "scheduleId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "totalAmount";
    }, {
        readonly type: "uint256";
        readonly name: "releasedAmount";
    }];
}, {
    readonly name: "totalAllocatedOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "beneficiary";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getScheduleIdsOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "beneficiary";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "scheduleIds";
    }];
}, {
    readonly name: "computeAvailableVestedAmount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "beneficiary";
    }, {
        readonly type: "uint256";
        readonly name: "scheduleId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "releaseFor";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "beneficiary";
    }, {
        readonly type: "uint256";
        readonly name: "scheduleId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "TokensReleased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "beneficiary";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "scheduleId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
export declare const genesisActivationRegistryAbi: readonly [{
    readonly name: "statics";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "treasury";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesisCollection";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "tierOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "multiplierBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "tierCost";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "tier";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "activeConsumer";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "pendingConsumer";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "activate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint8";
        readonly name: "targetTier";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "paid";
    }];
}, {
    readonly name: "GenesisActivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "previousTier";
    }, {
        readonly type: "uint8";
        readonly name: "newTier";
    }, {
        readonly type: "uint256";
        readonly name: "staticsPaid";
    }];
}, {
    readonly name: "GenesisActivationReset";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "previousOwner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "nextOwner";
        readonly indexed: true;
    }];
}, {
    readonly name: "TierCostUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "tier";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "previousCost";
    }, {
        readonly type: "uint256";
        readonly name: "newCost";
    }];
}, {
    readonly name: "ConsumerProposed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "currentConsumer";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "pendingConsumer";
        readonly indexed: true;
    }];
}, {
    readonly name: "ConsumerAccepted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "previousConsumer";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "newConsumer";
        readonly indexed: true;
    }];
}];
export declare const staticsFeeReceiverAbi: readonly [{
    readonly name: "statics";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "numeraire";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "poolInitializer";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "poolId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "reserveVault";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "reserveShareBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "activeDistributor";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "pendingDistributor";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "cumulativeHarvested";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "cumulativeDistributorAttributed";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "distributor";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "distributorClaimable";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "distributor";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "totalDistributorLiability";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "cumulativeReserveWeth";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "cumulativeDistributorWeth";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "harvest";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "claimDistributorFees";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "MarketBound";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "statics";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "numeraire";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "ReserveVaultBound";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "reserveVault";
        readonly indexed: true;
    }];
}, {
    readonly name: "ReserveShareUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "previousShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "newShareBps";
    }];
}, {
    readonly name: "ReserveFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "grossWeth";
    }, {
        readonly type: "uint256";
        readonly name: "reserveWeth";
    }, {
        readonly type: "uint256";
        readonly name: "distributorWeth";
    }];
}, {
    readonly name: "FeesHarvested";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "distributor";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "cumulativeAmount";
    }];
}, {
    readonly name: "DistributorProposed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "currentDistributor";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "pendingDistributor";
        readonly indexed: true;
    }];
}, {
    readonly name: "DistributorAccepted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "previousDistributor";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "newDistributor";
        readonly indexed: true;
    }];
}, {
    readonly name: "DistributorFeesClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "distributor";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "SurplusRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
export declare const genesisLaunchDistributorAbi: readonly [{
    readonly name: "feeReceiver";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "activationRegistry";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "statics";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "numeraire";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "vault";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "treasury";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "registerGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "accrue";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "claimGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "claimOwnerRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "claimAllGenesisRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "genesisIds";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "claimAllGenesisTreasuryRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "pendingGenesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "registered";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "effectiveWeight";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "ownerClaimable";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "genesisRewardShareBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "totalWeight";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "finalized";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "indexedReceiverAttribution";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "rewardBook";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "indexRay";
        }, {
            readonly type: "uint256";
            readonly name: "indexRemainder";
        }, {
            readonly type: "uint256";
            readonly name: "indexedAmount";
        }, {
            readonly type: "uint256";
            readonly name: "crystallizedAmount";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimable";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimed";
        }, {
            readonly type: "uint256";
            readonly name: "treasuryClaimable";
        }];
        readonly name: "book";
    }];
}, {
    readonly name: "GenesisRegistered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "weight";
    }, {
        readonly type: "uint256";
        readonly name: "totalWeight";
    }];
}, {
    readonly name: "GenesisWeightChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "previousWeight";
    }, {
        readonly type: "uint256";
        readonly name: "newWeight";
    }, {
        readonly type: "uint256";
        readonly name: "totalWeight";
    }];
}, {
    readonly name: "RevenueAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "genesisAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }];
}, {
    readonly name: "GenesisRewardsClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "OwnerRewardsClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
export declare const dopplerStaticsTokenAbi: readonly [{
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "transfer";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "transferFrom";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
    }, {
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "nonces";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "permit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "uint8";
        readonly name: "v";
    }, {
        readonly type: "bytes32";
        readonly name: "r";
    }, {
        readonly type: "bytes32";
        readonly name: "s";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "burn";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "tokenURI";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}];
export declare const BasketStatus: {
    readonly Active: 0;
    readonly Quarantined: 1;
    readonly ExitOnly: 2;
};
export type BasketStatus = typeof BasketStatus[keyof typeof BasketStatus];
export declare const DollarRecoveryClaimMode: {
    readonly NAV: 0;
    readonly ExactUnits: 1;
    readonly CollateralOnly: 2;
};
export type DollarRecoveryClaimMode = typeof DollarRecoveryClaimMode[keyof typeof DollarRecoveryClaimMode];
export declare const ProtocolPoolKind: {
    readonly None: 0;
    readonly BasketCanonical: 1;
    readonly General: 2;
    readonly PermissionedGeneral: 3;
};
export type ProtocolPoolKind = typeof ProtocolPoolKind[keyof typeof ProtocolPoolKind];
export type FeeTier = {
    minActionShares: bigint;
    feeShares: bigint;
};
export type SwapFeeConfiguration = {
    inputFeeBps: bigint;
    outputFeeBps: bigint;
    polShareBps: bigint;
    basketStakerShareBps: bigint;
    staticsStakerShareBps: bigint;
    treasuryShareBps: bigint;
};
export type SwapFeeSplit = {
    polAmount: bigint;
    basketStakerAmount: bigint;
    staticsStakerAmount: bigint;
    creatorAmount: bigint;
    treasuryAmount: bigint;
};
export type ConstituentSnapshot = {
    asset: Address;
    bundleAmount: bigint;
    vaultBalance: bigint;
};
export type BasketSnapshot = {
    basketId: bigint;
    basketToken: Address;
    status: BasketStatus;
    totalSupply: bigint;
    mintFeeTiers: readonly FeeTier[];
    redemptionFeeTiers: readonly FeeTier[];
    originationFeeBps: bigint;
    extensionFeeBps: bigint;
    ltvBps: bigint;
    recoveryPenaltyBps: bigint;
    constituents: readonly ConstituentSnapshot[];
};
export type BasketConfiguration = {
    token: Address;
    creator: Address;
    status: BasketStatus;
    assets: readonly Address[];
    bundleAmounts: readonly bigint[];
    mintFeeTiers: readonly FeeTier[];
    redemptionFeeTiers: readonly FeeTier[];
    flashFeeBps: number;
    originationFeeBps: number;
    extensionFeeBps: number;
    ltvBps: number;
    recoveryPenaltyBps: number;
    loanDuration: number;
};
export type CreateBasketParams = {
    name: string;
    symbol: string;
    assets: readonly Address[];
    bundleAmounts: readonly bigint[];
    mintFeeTiers: readonly FeeTier[];
    redemptionFeeTiers: readonly FeeTier[];
    flashFeeBps: number;
    originationFeeBps: number;
    extensionFeeBps: number;
    ltvBps: number;
    recoveryPenaltyBps: number;
    loanDuration: number;
};
export type PoolLaunchParams = {
    lpFee: number;
    tickSpacing: number;
    sqrtPriceAssetPerBasketX96: bigint;
    pairedAssetAmount: bigint;
};
export type PoolSwapFeeRate = {
    inputFeeBps: bigint;
    outputFeeBps: bigint;
};
export type PoolFeeRateView = PoolSwapFeeRate & {
    overridden: boolean;
};
export type BasketFeeAllocation = {
    polShareBps: bigint;
    basketStakerShareBps: bigint;
    staticsStakerShareBps: bigint;
    treasuryShareBps: bigint;
};
export type GeneralFeeAllocation = {
    polShareBps: bigint;
    staticsStakerShareBps: bigint;
    treasuryShareBps: bigint;
};
export type ProtocolPoolMaintenanceConfig = {
    revenueTipBps: bigint;
};
export type CreatePoolParams = {
    tokenA: Address;
    tokenB: Address;
    lpFee: number;
    tickSpacing: number;
    sqrtPriceBPerAX96: bigint;
    initialFeeRate: PoolSwapFeeRate;
    creator: Address;
    activateManagedPol: boolean;
    nonce: bigint;
    deadline: bigint;
};
export type GeneralPoolQuote = {
    key: V4PoolKey;
    poolId: Hex;
    sqrtPriceX96: bigint;
    creationFee: bigint;
    polActivationFee: bigint;
    totalNativeFee: bigint;
    authorizationDigest: Hex;
};
export type ProtocolPolPosition = {
    positionId: bigint;
    poolId: Hex;
    manager: Address;
    posmTokenId: bigint;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    active: boolean;
};
export type ProtocolPolOpenParams = {
    poolId: Hex;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    amount0Maximum: bigint;
    amount1Maximum: bigint;
    deadline: bigint;
};
export type ProtocolPolLiquidityParams = {
    positionId: bigint;
    liquidity: bigint;
    amount0Limit: bigint;
    amount1Limit: bigint;
    deadline: bigint;
};
export type PermissionedFeeAllocation = {
    creatorShareBps: bigint;
    treasuryShareBps: bigint;
    staticsStakerShareBps: bigint;
    basketStakerShareBps: bigint;
};
export type PermissionedPoolEconomics = {
    venueFeeBps: bigint;
    additionalRewardRestrictedMask: number;
    allocation: PermissionedFeeAllocation;
};
export type CreatePermissionedPoolParams = {
    tokenA: Address;
    tokenB: Address;
    lpFee: number;
    tickSpacing: number;
    sqrtPriceBPerAX96: bigint;
    creator: Address;
    controller: Address;
    economics: PermissionedPoolEconomics;
    authorizationNonce: bigint;
    deadline: bigint;
    agreementHash: Hex;
};
export type PermissionedPoolQuote = {
    key: V4PoolKey;
    poolId: Hex;
    sqrtPriceX96: bigint;
    authorizationDigest: Hex;
};
export type PermissionedControllerReplacement = {
    poolId: Hex;
    currentController: Address;
    newController: Address;
    nonce: bigint;
    deadline: bigint;
    agreementHash: Hex;
};
export type ProtocolFeeDistribution = {
    basketStaker: bigint;
    staticsStaker: bigint;
    creator: bigint;
    treasury: bigint;
};
export type ProtocolPool = {
    poolId: Hex;
    key: V4PoolKey;
    kind: ProtocolPoolKind;
    decommissioned: boolean;
    basketId: bigint;
    basketAsset: Address;
    creator: Address;
    polActivated: boolean;
    polShareOverridden: boolean;
    polShareBps: bigint;
    activePolPositions: bigint;
};
export type PreparedTransaction = {
    data: Hex;
    value: bigint;
};
export type GlobalRewardAsset = {
    eligibleStake: bigint;
    eligibleWeight: bigint;
    pendingStake: bigint;
    pendingWeight: bigint;
    indexRay: bigint;
    indexedReserve: bigint;
    totalClaimable: bigint;
};
export type GlobalRewardSelection = {
    selected: boolean;
    eligibleStake: bigint;
    eligibleWeight: bigint;
    pendingStake: bigint;
    pendingWeight: bigint;
    eligibleAt: bigint;
};
export type GlobalStakePosition = {
    stakedBalance: bigint;
    rewardMultiplierBps: number;
    claimAssetCount: bigint;
    optedInAssetCount: bigint;
};
export type GenesisRewardBook = {
    indexRay: bigint;
    indexRemainder: bigint;
    indexedAmount: bigint;
    crystallizedAmount: bigint;
    totalClaimable: bigint;
    totalClaimed: bigint;
    treasuryClaimable: bigint;
};
export type ProtocolRevenueLiabilities = {
    creator: bigint;
    partner: bigint;
};
export type PermitSignature = {
    value: bigint;
    deadline: bigint;
    v: number;
    r: Hex;
    s: Hex;
};
export type Erc20PermitTypedDataParams = {
    tokenName: string;
    chainId: number;
    token: Address;
    owner: Address;
    spender: Address;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
};
export type Permit2PermitSingle = {
    details: {
        token: Address;
        amount: bigint;
        expiration: number;
        nonce: number;
    };
    spender: Address;
    sigDeadline: bigint;
};
export type V4ExactInputSingleRequest = {
    router: Address;
    poolKey: V4PoolKey;
    zeroForOne: boolean;
    amountIn: bigint;
    amountOutMinimum: bigint;
    deadline: bigint;
    minHopPriceX36?: bigint;
    hookData?: Hex;
    permit?: {
        permitSingle: Permit2PermitSingle;
        signature: Hex;
    };
    settlement?: {
        input: "erc20";
        output: "erc20";
    } | {
        input: "native";
        output: "erc20";
        wrappedNative: Address;
    } | {
        input: "erc20";
        output: "native";
        wrappedNative: Address;
    };
};
export type PeggedMintAndRecombineQuote = {
    eligible: boolean;
    exitStatus: number;
    peggedCollateralToken: Address;
    volatileCollateralToken: Address;
    staticsDollarAmount: bigint;
    peggedCollateralPrincipal: bigint;
    peggedMintFee: bigint;
    totalPeggedCollateralIn: bigint;
    volatileCollateralOut: bigint;
    volatileRecombinationFee: bigint;
};
export type MintQuoteLeg = {
    asset: Address;
    baseAmount: bigint;
    feeAmount: bigint;
    amountIn: bigint;
};
export type RedeemQuoteLeg = {
    asset: Address;
    baseAmount: bigint;
    feeAmount: bigint;
    amountOut: bigint;
};
export type BorrowQuote = {
    feeShares: bigint;
    collateralShares: bigint;
    debtShares: bigint;
    penaltyShares: bigint;
    principals: readonly {
        asset: Address;
        amount: bigint;
    }[];
};
export type LoanSnapshot = {
    positionId: bigint;
    basketId: bigint;
    collateralShares: bigint;
    feeShares: bigint;
    debtShares: bigint;
    penaltyShares: bigint;
    maturity: bigint;
    assets: readonly Address[];
    principals: readonly bigint[];
};
export type PositionPortfolioCounts = {
    basketCount: bigint;
    loanCount: bigint;
    globalRewardAssetCount: bigint;
    riskSeriesCount: bigint;
    morphoMarketCount: bigint;
};
export type RecoveryQuote = {
    recoverableAt: bigint;
    burnShares: bigint;
    unlockedShares: bigint;
    assets: readonly Address[];
    callerAmounts: readonly bigint[];
    protocolAmounts: readonly bigint[];
};
export type EffectiveCanonicalFees = {
    lpFeePips: bigint;
    inputFeeBps: bigint;
    outputFeeBps: bigint;
};
export type LiquidityParams = {
    asset: Address;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    amount0Max: bigint;
    amount1Max: bigint;
    deadline: bigint;
};
export type V4PoolKey = {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
};
export type V4MintPositionRequest = {
    poolKey: V4PoolKey;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    amount0Max: bigint;
    amount1Max: bigint;
    recipient: Address;
    deadline: bigint;
};
export type CanonicalLiquidityInput = {
    asset: Address;
    currency0: Address;
    currency1: Address;
    sqrtPriceX96: bigint;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    deadline: bigint;
};
export type CombinedLiquidityQuote = {
    borrow: BorrowQuote;
    basketSharesMinted: bigint;
    mintInputs: readonly MintQuoteLeg[];
    poolAssetAmounts: readonly {
        asset: Address;
        amount: bigint;
    }[];
    totalPrincipalRequirements: readonly {
        asset: Address;
        amount: bigint;
        refund: bigint;
    }[];
    pools: readonly LiquidityParams[];
};
export declare function mulDivDown(value: bigint, multiplier: bigint, denominator: bigint): bigint;
export declare function mulDivUp(value: bigint, multiplier: bigint, denominator: bigint): bigint;
export declare function morphoSupplyAssets(position: MorphoPosition, market: MorphoMarket): bigint;
export declare function morphoBorrowAssets(position: Pick<MorphoPosition, "borrowShares">, market: MorphoMarket): bigint;
export declare function quoteMorphoHealth(input: {
    position: MorphoPosition;
    market: MorphoMarket;
    oraclePrice: bigint;
    lltv: bigint;
}): MorphoHealth;
export declare function encodeSqrtPriceAssetPerBasketX96(assetAmountRaw: bigint, basketAmountRaw: bigint): bigint;
export declare function encodeSqrtPriceBPerAX96(tokenBAmountRaw: bigint, tokenAAmountRaw: bigint): bigint;
export declare function quoteExactInputHookFee(realizedAmount: bigint, hookFeeBps: bigint): bigint;
export declare function quoteExactOutputHookFee(netAmount: bigint, hookFeeBps: bigint): bigint;
export declare function splitSwapFee(chargedAmount: bigint, configuration: SwapFeeConfiguration, basketStakersEligible: boolean, staticsStakersEligible: boolean): SwapFeeSplit;
export declare function effectiveCanonicalFees(lpFeePips: bigint, inputFeeBps: bigint, outputFeeBps: bigint): EffectiveCanonicalFees;
export declare function getSqrtPriceAtTick(tick: number): bigint;
export declare function quoteRangeAmounts(sqrtPriceX96: bigint, tickLower: number, tickUpper: number, liquidity: bigint): {
    amount0: bigint;
    amount1: bigint;
};
export declare function maximumLiquidityForAmounts(sqrtPriceX96: bigint, tickLower: number, tickUpper: number, amount0Max: bigint, amount1Max: bigint): bigint;
export declare function pendingLpFees(liquidity: bigint, currentFeeGrowth0X128: bigint, currentFeeGrowth1X128: bigint, lastFeeGrowth0X128: bigint, lastFeeGrowth1X128: bigint): {
    amount0: bigint;
    amount1: bigint;
};
export declare function decodePositionInfo(info: bigint): {
    tickLower: number;
    tickUpper: number;
    hasSubscriber: boolean;
};
export declare function positionSalt(tokenId: bigint): Hex;
export declare function backingAtSupply(bundleAmount: bigint, supply: bigint): bigint;
export declare function selectFeeShares(tiers: readonly FeeTier[], actionShares: bigint): bigint;
export declare function quoteMint(snapshot: BasketSnapshot, shares: bigint): readonly MintQuoteLeg[];
export declare function quoteRedeem(snapshot: BasketSnapshot, shares: bigint): readonly RedeemQuoteLeg[];
export declare function quoteBorrow(snapshot: BasketSnapshot, sharesIn: bigint): BorrowQuote;
export declare function quoteRecovery(snapshot: BasketSnapshot, loan: LoanSnapshot): RecoveryQuote;
export declare function quoteBorrowAndProvideLiquidity(snapshot: BasketSnapshot, sharesIn: bigint, poolInputs: readonly CanonicalLiquidityInput[], maxInputSlippageBps?: bigint): CombinedLiquidityQuote;
export declare function quoteExtension(snapshot: BasketSnapshot, principals: readonly {
    asset: Address;
    amount: bigint;
}[]): readonly {
    asset: Address;
    amount: bigint;
}[];
export declare function allowsExposureIncrease(status: BasketStatus): boolean;
export declare const staticsAbi: readonly [{
    readonly name: "createBasket";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "string";
            readonly name: "name";
        }, {
            readonly type: "string";
            readonly name: "symbol";
        }, {
            readonly type: "address[]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[]";
            readonly name: "bundleAmounts";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "uint256";
                readonly name: "minActionShares";
            }, {
                readonly type: "uint256";
                readonly name: "feeShares";
            }];
            readonly name: "mintFeeTiers";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "uint256";
                readonly name: "minActionShares";
            }, {
                readonly type: "uint256";
                readonly name: "feeShares";
            }];
            readonly name: "redemptionFeeTiers";
        }, {
            readonly type: "uint16";
            readonly name: "flashFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "originationFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "extensionFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "ltvBps";
        }, {
            readonly type: "uint16";
            readonly name: "recoveryPenaltyBps";
        }, {
            readonly type: "uint40";
            readonly name: "loanDuration";
        }];
        readonly name: "params";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "uint24";
            readonly name: "lpFee";
        }, {
            readonly type: "int24";
            readonly name: "tickSpacing";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceAssetPerBasketX96";
        }, {
            readonly type: "uint256";
            readonly name: "pairedAssetAmount";
        }];
        readonly name: "pools";
    }, {
        readonly type: "uint256[]";
        readonly name: "maxAmountsIn";
    }, {
        readonly type: "uint256";
        readonly name: "launchDeadline";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "token";
    }];
}, {
    readonly name: "mint";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256[]";
        readonly name: "maxAmountsIn";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsIn";
    }];
}, {
    readonly name: "redeem";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256[]";
        readonly name: "minAmountsOut";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsOut";
    }];
}, {
    readonly name: "quoteMint";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsIn";
    }];
}, {
    readonly name: "quoteRedeem";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsOut";
    }];
}, {
    readonly name: "basket";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "token";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "uint8";
            readonly name: "status";
        }, {
            readonly type: "address[]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[]";
            readonly name: "bundleAmounts";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "uint256";
                readonly name: "minActionShares";
            }, {
                readonly type: "uint256";
                readonly name: "feeShares";
            }];
            readonly name: "mintFeeTiers";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "uint256";
                readonly name: "minActionShares";
            }, {
                readonly type: "uint256";
                readonly name: "feeShares";
            }];
            readonly name: "redemptionFeeTiers";
        }, {
            readonly type: "uint16";
            readonly name: "flashFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "originationFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "extensionFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "ltvBps";
        }, {
            readonly type: "uint16";
            readonly name: "recoveryPenaltyBps";
        }, {
            readonly type: "uint40";
            readonly name: "loanDuration";
        }];
        readonly name: "result";
    }];
}, {
    readonly name: "basketStatus";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "basketCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "basketIdOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "bool";
        readonly name: "exists";
    }];
}, {
    readonly name: "vaultBalance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "feeSharesFor";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "bool";
        readonly name: "mintAction";
    }, {
        readonly type: "uint256";
        readonly name: "actionShares";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "feeShares";
    }];
}, {
    readonly name: "createAndDepositBasketCollateral";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "depositBasketCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "withdrawBasketCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "createAndMintBasketCollateral";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256[]";
        readonly name: "maxAmountsIn";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256[]";
        readonly name: "amountsIn";
    }];
}, {
    readonly name: "mintBasketCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "uint256[]";
        readonly name: "maxAmountsIn";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsIn";
    }];
}, {
    readonly name: "redeemBasketCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256[]";
        readonly name: "minAmountsOut";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsOut";
    }];
}, {
    readonly name: "basketCollateralPosition";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "depositedShares";
        }, {
            readonly type: "uint256";
            readonly name: "lockedShares";
        }, {
            readonly type: "uint256";
            readonly name: "rewardEligibleAt";
        }];
        readonly name: "position";
    }];
}, {
    readonly name: "getBasketRewardAssets";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }];
}, {
    readonly name: "getBasketRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[]";
        readonly name: "amounts";
    }];
}, {
    readonly name: "claimBasketRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[]";
        readonly name: "amounts";
    }];
}, {
    readonly name: "basketRewardState";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "totalEligibleShares";
        }, {
            readonly type: "uint256";
            readonly name: "indexRay";
        }, {
            readonly type: "uint256";
            readonly name: "indexedReserve";
        }, {
            readonly type: "uint256";
            readonly name: "crystallizedReserve";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimable";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "createAndStake";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "address[]";
        readonly name: "rewardAssets";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "stake";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "unstake";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "optInRewardAssets";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address[]";
        readonly name: "assets";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "optOutRewardAssets";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address[]";
        readonly name: "assets";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256[]";
        readonly name: "minAmountsOut";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amountsOut";
    }];
}, {
    readonly name: "distributeTreasuryFees";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
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
    readonly name: "rewardAsset";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
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
            readonly type: "uint256";
            readonly name: "indexRay";
        }, {
            readonly type: "uint256";
            readonly name: "indexedReserve";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimable";
        }];
        readonly name: "state";
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
    readonly name: "maxRewardAssetsPerPosition";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "rewardEligibilityDelay";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "rewardEligibilityBucketSize";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "stakingToken";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "totalStaked";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "treasuryAccrued";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "canAccrueStakerRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "unfundedSwapRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "fundedGlobalRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "outstandingGlobalRewardLiability";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "settlePublicSwapRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "maximumAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "checkpointRewardAssets";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "rewardBookNeedsCheckpoint";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "locked";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "genesisCollection";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "linkedPosition";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "linkedGenesis";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "linkGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "unlinkGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "genesisRecoveryVault";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesisRecoveryAsset";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesisRecoveryReady";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "genesisIntegrationReady";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "registerGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "accrueGenesisRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "claimGenesisRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "claimGenesisOwnerRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "claimGenesisTreasuryRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "claimAllGenesisRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "genesisIds";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "claimAllGenesisTreasuryRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }, {
        readonly type: "uint256";
        readonly name: "numeraireAmount";
    }];
}, {
    readonly name: "setGenesisRewardShareBps";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "newShareBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "pendingGenesisRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "genesisRewardBook";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "indexRay";
        }, {
            readonly type: "uint256";
            readonly name: "indexRemainder";
        }, {
            readonly type: "uint256";
            readonly name: "indexedAmount";
        }, {
            readonly type: "uint256";
            readonly name: "crystallizedAmount";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimable";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimed";
        }, {
            readonly type: "uint256";
            readonly name: "treasuryClaimable";
        }];
        readonly name: "book";
    }];
}, {
    readonly name: "genesisRegistered";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "genesisEffectiveWeight";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "genesisTotalWeight";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "genesisRewardShareBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "genesisOwnerClaimable";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "pendingGenesisRecovery";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "genesisRewardCustodyAccount";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "initializeMorphoIntegration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "morpho";
    }, {
        readonly type: "address";
        readonly name: "usdStx";
    }, {
        readonly type: "uint16";
        readonly name: "syncBountyBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "registerMorphoMarket";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "loanToken";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "address";
            readonly name: "irm";
        }, {
            readonly type: "uint256";
            readonly name: "lltv";
        }];
        readonly name: "params";
    }, {
        readonly type: "uint8";
        readonly name: "kind";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "marketId";
    }];
}, {
    readonly name: "setMorphoMarketMode";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setMorphoSyncBountyBps";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "bountyBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setMorphoPerformanceFeeConfig";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "router";
    }, {
        readonly type: "uint16";
        readonly name: "feeBps";
    }, {
        readonly type: "uint16";
        readonly name: "operatorShareBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "deployMorphoCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "recallMorphoCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "withdrawUntrackedMorphoCollateral";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "borrowMorphoUsd";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "maxBorrowShares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "assetsBorrowed";
    }, {
        readonly type: "uint256";
        readonly name: "sharesBorrowed";
    }];
}, {
    readonly name: "repayMorphoUsd";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "uint256";
        readonly name: "maxAssets";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "assetsRepaid";
    }, {
        readonly type: "uint256";
        readonly name: "sharesRepaid";
    }];
}, {
    readonly name: "syncMorpho";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "trackedLoss";
    }];
}, {
    readonly name: "syncMorphoForModule";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "keeper";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "liquidateMorphoAndSync";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "seizedAssets";
    }, {
        readonly type: "uint256";
        readonly name: "repaidShares";
    }, {
        readonly type: "uint256";
        readonly name: "maxRepayAssets";
    }, {
        readonly type: "uint256";
        readonly name: "minSeizedAssets";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "assetsSeized";
    }, {
        readonly type: "uint256";
        readonly name: "assetsRepaid";
    }];
}, {
    readonly name: "claimMorphoSyncBounties";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "amounts";
    }];
}, {
    readonly name: "recoverMorphoAccountToken";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minReceived";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "routeMorphoPerformanceFee";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "realizedYield";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "feeAmount";
    }];
}, {
    readonly name: "quoteMorphoPerformanceFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "realizedYield";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "feeAmount";
    }, {
        readonly type: "uint256";
        readonly name: "operatorAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }];
}, {
    readonly name: "morpho";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "morphoUsdStx";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "morphoAccount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "bool";
        readonly name: "deployed";
    }];
}, {
    readonly name: "morphoMarket";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "address";
                readonly name: "loanToken";
            }, {
                readonly type: "address";
                readonly name: "collateralToken";
            }, {
                readonly type: "address";
                readonly name: "oracle";
            }, {
                readonly type: "address";
                readonly name: "irm";
            }, {
                readonly type: "uint256";
                readonly name: "lltv";
            }];
            readonly name: "params";
        }, {
            readonly type: "uint8";
            readonly name: "kind";
        }, {
            readonly type: "uint8";
            readonly name: "mode";
        }, {
            readonly type: "uint256";
            readonly name: "basketId";
        }];
        readonly name: "config";
    }];
}, {
    readonly name: "morphoPositionMarket";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "trackedCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "actualCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "untrackedSurplus";
        }, {
            readonly type: "uint256";
            readonly name: "borrowShares";
        }, {
            readonly type: "bool";
            readonly name: "debtActive";
        }];
        readonly name: "position";
    }];
}, {
    readonly name: "morphoMarketIdsOfPosition";
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
        readonly type: "bytes32[]";
        readonly name: "marketIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "enforceMorphoAccountEmpty";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "morphoSyncBountyBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "morphoSyncBounty";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "keeper";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "morphoPerformanceFeeConfig";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "router";
    }, {
        readonly type: "uint16";
        readonly name: "feeBps";
    }, {
        readonly type: "uint16";
        readonly name: "operatorShareBps";
    }];
}, {
    readonly name: "MorphoIntegrationInitialized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "morpho";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "usdStx";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "syncBountyBps";
    }];
}, {
    readonly name: "MorphoMarketRegistered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "collateralToken";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "kind";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }];
}, {
    readonly name: "MorphoMarketModeChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "previousMode";
    }, {
        readonly type: "uint8";
        readonly name: "newMode";
    }];
}, {
    readonly name: "MorphoAccountDeployed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "account";
        readonly indexed: true;
    }];
}, {
    readonly name: "MorphoCollateralDeployed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }];
}, {
    readonly name: "MorphoCollateralRecalled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }];
}, {
    readonly name: "MorphoSurplusWithdrawn";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }];
}, {
    readonly name: "MorphoBorrowed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "MorphoRepaid";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assets";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "MorphoSynchronized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "keeper";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "previousTracked";
    }, {
        readonly type: "uint256";
        readonly name: "actualCollateral";
    }, {
        readonly type: "uint256";
        readonly name: "trackedLoss";
    }];
}, {
    readonly name: "MorphoLiquidatedAndSynchronized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "liquidator";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "assetsSeized";
    }, {
        readonly type: "uint256";
        readonly name: "assetsRepaid";
    }];
}, {
    readonly name: "MorphoSyncBountyUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "previousBps";
    }, {
        readonly type: "uint16";
        readonly name: "newBps";
    }];
}, {
    readonly name: "MorphoSyncBountyClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "keeper";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "MorphoAccountTokenRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "token";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "MorphoPerformanceFeeConfigured";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "router";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "feeBps";
    }, {
        readonly type: "uint16";
        readonly name: "operatorShareBps";
    }, {
        readonly type: "address";
        readonly name: "rewardAsset";
        readonly indexed: true;
    }];
}, {
    readonly name: "MorphoPerformanceFeeRouted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "router";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "realizedYield";
    }, {
        readonly type: "uint256";
        readonly name: "feeAmount";
    }, {
        readonly type: "uint256";
        readonly name: "operatorAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }];
}, {
    readonly name: "creatorRewardCredit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "partnerAccrued";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "partnerRecipient";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "partnerDistributionTipBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "protocolRevenueLiabilities";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "creator";
    }, {
        readonly type: "uint256";
        readonly name: "partner";
    }];
}, {
    readonly name: "distributePartnerRevenue";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "distributed";
    }, {
        readonly type: "uint256";
        readonly name: "tip";
    }];
}, {
    readonly name: "borrow";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "sharesIn";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }, {
        readonly type: "uint256[]";
        readonly name: "principals";
    }];
}, {
    readonly name: "repay";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "extend";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }, {
        readonly type: "uint256[]";
        readonly name: "grossAmountsIn";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "receivedAmounts";
    }];
}, {
    readonly name: "recover";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "quoteBorrow";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "sharesIn";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "feeShares";
        }, {
            readonly type: "uint256";
            readonly name: "collateralShares";
        }, {
            readonly type: "uint256";
            readonly name: "debtShares";
        }, {
            readonly type: "uint256";
            readonly name: "penaltyShares";
        }, {
            readonly type: "address[]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[]";
            readonly name: "principals";
        }];
        readonly name: "result";
    }];
}, {
    readonly name: "quoteRecovery";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "recoverableAt";
        }, {
            readonly type: "uint256";
            readonly name: "burnShares";
        }, {
            readonly type: "uint256";
            readonly name: "unlockedShares";
        }, {
            readonly type: "address[]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[]";
            readonly name: "callerAmounts";
        }, {
            readonly type: "uint256[]";
            readonly name: "protocolAmounts";
        }];
        readonly name: "result";
    }];
}, {
    readonly name: "quoteExtension";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[]";
        readonly name: "requiredFees";
    }];
}, {
    readonly name: "loan";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "positionId";
        }, {
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "uint256";
            readonly name: "collateralShares";
        }, {
            readonly type: "uint256";
            readonly name: "feeShares";
        }, {
            readonly type: "uint256";
            readonly name: "debtShares";
        }, {
            readonly type: "uint256";
            readonly name: "penaltyShares";
        }, {
            readonly type: "uint40";
            readonly name: "maturity";
        }, {
            readonly type: "address[]";
            readonly name: "assets";
        }, {
            readonly type: "uint256[]";
            readonly name: "principals";
        }];
        readonly name: "result";
    }];
}, {
    readonly name: "outstandingPrincipal";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "recoveryGracePeriod";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "flashLoan";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "bytes";
        readonly name: "data";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "quoteFlashLoan";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
    readonly outputs: readonly [{
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[]";
        readonly name: "amounts";
    }, {
        readonly type: "uint256[]";
        readonly name: "fees";
    }];
}, {
    readonly name: "flashLoanAsset";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "bytes";
        readonly name: "data";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "quoteFlashLoanAsset";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "fee";
    }];
}, {
    readonly name: "maxFlashLoan";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "singleAssetFlashFeeBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "setSingleAssetFlashFeeBps";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "newFeeBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "getApproved";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "isApprovedForAll";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "operator";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "tokenURI";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "createPosition";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "positionCreationFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "setPositionCreationFee";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "closePosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "nextPositionId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "activeLegCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "positionInitializing";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "positionCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "positionsOfOwner";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "uint256";
        readonly name: "cursor";
    }, {
        readonly type: "uint256";
        readonly name: "limit";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "positionIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "syncPositionOwnerIndex";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "positionState";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "exists";
        }, {
            readonly type: "uint256";
            readonly name: "stateNonce";
        }, {
            readonly type: "uint256";
            readonly name: "activeLegCount";
        }, {
            readonly type: "uint256";
            readonly name: "unresolvedObligationCount";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "isLegActive";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "isPositionClosable";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "positionPortfolioCounts";
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
            readonly name: "basketCount";
        }, {
            readonly type: "uint256";
            readonly name: "loanCount";
        }, {
            readonly type: "uint256";
            readonly name: "globalRewardAssetCount";
        }, {
            readonly type: "uint256";
            readonly name: "riskSeriesCount";
        }, {
            readonly type: "uint256";
            readonly name: "morphoMarketCount";
        }];
        readonly name: "counts";
    }];
}, {
    readonly name: "basketIdsOfPosition";
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
        readonly type: "uint256[]";
        readonly name: "basketIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "loanIdsOfPosition";
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
        readonly type: "uint256[]";
        readonly name: "loanIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
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
    readonly name: "riskSeriesIdsOfPosition";
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
        readonly type: "uint256[]";
        readonly name: "seriesIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "quarantineBasket";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "releaseBasketQuarantine";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "decommissionBasket";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "depositETH";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "staticsDollarReceiver";
    }, {
        readonly type: "address";
        readonly name: "shareReceiver";
    }, {
        readonly type: "uint256";
        readonly name: "minStaticsDollar";
    }, {
        readonly type: "uint256";
        readonly name: "minShares";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarMinted";
    }, {
        readonly type: "uint256";
        readonly name: "sharesMinted";
    }];
}, {
    readonly name: "depositWETH";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "wethAmount";
    }, {
        readonly type: "address";
        readonly name: "staticsDollarReceiver";
    }, {
        readonly type: "address";
        readonly name: "shareReceiver";
    }, {
        readonly type: "uint256";
        readonly name: "minStaticsDollar";
    }, {
        readonly type: "uint256";
        readonly name: "minShares";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarMinted";
    }, {
        readonly type: "uint256";
        readonly name: "sharesMinted";
    }];
}, {
    readonly name: "recombineToWETH";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maxSharesIn";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minWETHOut";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "wethOut";
    }];
}, {
    readonly name: "recombineToWETHWithPermit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maxSharesIn";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minWETHOut";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "value";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint8";
            readonly name: "v";
        }, {
            readonly type: "bytes32";
            readonly name: "r";
        }, {
            readonly type: "bytes32";
            readonly name: "s";
        }];
        readonly name: "permitSignature";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "wethOut";
    }];
}, {
    readonly name: "recombineToETH";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maxSharesIn";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minETHOut";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "ethOut";
    }];
}, {
    readonly name: "recombineToETHWithPermit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maxSharesIn";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minETHOut";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "value";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint8";
            readonly name: "v";
        }, {
            readonly type: "bytes32";
            readonly name: "r";
        }, {
            readonly type: "bytes32";
            readonly name: "s";
        }];
        readonly name: "permitSignature";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "ethOut";
    }];
}, {
    readonly name: "pool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "weth";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "staticsDollar";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "staticsDollarRisk";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "wethProfileId";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "previewPeggedMint";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "profileId";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarMinted";
        }, {
            readonly type: "uint256";
            readonly name: "principalCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "feeAmount";
        }, {
            readonly type: "uint256";
            readonly name: "totalCollateralIn";
        }, {
            readonly type: "uint256";
            readonly name: "priceWad";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "mintPegged";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maximumCollateralIn";
    }, {
        readonly type: "address";
        readonly name: "staticsDollarReceiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "collateralIn";
    }];
}, {
    readonly name: "mintPeggedWithPermit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maximumCollateralIn";
    }, {
        readonly type: "address";
        readonly name: "staticsDollarReceiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "value";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint8";
            readonly name: "v";
        }, {
            readonly type: "bytes32";
            readonly name: "r";
        }, {
            readonly type: "bytes32";
            readonly name: "s";
        }];
        readonly name: "permitSignature";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "collateralIn";
    }];
}, {
    readonly name: "quoteMintPeggedAndRecombine";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "peggedProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "volatileProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "riskAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "eligible";
        }, {
            readonly type: "uint8";
            readonly name: "exitStatus";
        }, {
            readonly type: "address";
            readonly name: "peggedCollateralToken";
        }, {
            readonly type: "address";
            readonly name: "volatileCollateralToken";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarAmount";
        }, {
            readonly type: "uint256";
            readonly name: "peggedCollateralPrincipal";
        }, {
            readonly type: "uint256";
            readonly name: "peggedMintFee";
        }, {
            readonly type: "uint256";
            readonly name: "totalPeggedCollateralIn";
        }, {
            readonly type: "uint256";
            readonly name: "volatileCollateralOut";
        }, {
            readonly type: "uint256";
            readonly name: "volatileRecombinationFee";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "mintPeggedAndRecombine";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "peggedProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "volatileProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "riskAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maximumPeggedCollateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "minimumVolatileCollateralOut";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "peggedCollateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "volatileCollateralOut";
    }];
}, {
    readonly name: "mintPeggedAndRecombineWithPermit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "peggedProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "volatileProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "riskAmount";
    }, {
        readonly type: "uint256";
        readonly name: "maximumPeggedCollateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "minimumVolatileCollateralOut";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "value";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint8";
            readonly name: "v";
        }, {
            readonly type: "bytes32";
            readonly name: "r";
        }, {
            readonly type: "bytes32";
            readonly name: "s";
        }];
        readonly name: "permitSignature";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "peggedCollateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "volatileCollateralOut";
    }];
}, {
    readonly name: "previewPeggedRedemption";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "profileId";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarBurned";
        }, {
            readonly type: "uint256";
            readonly name: "grossCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "feeAmount";
        }, {
            readonly type: "uint256";
            readonly name: "collateralOut";
        }, {
            readonly type: "uint256";
            readonly name: "priceWad";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "redeemPegged";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "minimumCollateralOut";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }];
}, {
    readonly name: "redeemPeggedWithPermit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "minimumCollateralOut";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "value";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "uint8";
            readonly name: "v";
        }, {
            readonly type: "bytes32";
            readonly name: "r";
        }, {
            readonly type: "bytes32";
            readonly name: "s";
        }];
        readonly name: "permitSignature";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }];
}, {
    readonly name: "peggedRedemptionStatus";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }, {
        readonly type: "uint256";
        readonly name: "totalSeniorDeficitWad";
    }, {
        readonly type: "uint256";
        readonly name: "recoveryAvailableAt";
    }];
}, {
    readonly name: "peggedProtocolRevenue";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "address";
        readonly name: "token";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "claimPeggedProtocolRevenue";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "spent";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "installCanonicalPoolIntegration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "poolManager";
    }, {
        readonly type: "address";
        readonly name: "hook";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "installPermissionedPoolIntegration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "hook";
    }, {
        readonly type: "address";
        readonly name: "router";
    }, {
        readonly type: "address";
        readonly name: "positionManager";
    }, {
        readonly type: "address";
        readonly name: "quoter";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "permissionedLiquidityIntegration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "hook";
    }, {
        readonly type: "address";
        readonly name: "router";
    }, {
        readonly type: "address";
        readonly name: "positionManager";
    }, {
        readonly type: "address";
        readonly name: "quoter";
    }, {
        readonly type: "bool";
        readonly name: "installed";
    }];
}, {
    readonly name: "canonicalPool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "address";
            readonly name: "basketToken";
        }, {
            readonly type: "address";
            readonly name: "asset";
        }, {
            readonly type: "address";
            readonly name: "currency0";
        }, {
            readonly type: "address";
            readonly name: "currency1";
        }, {
            readonly type: "address";
            readonly name: "hook";
        }, {
            readonly type: "uint24";
            readonly name: "lpFee";
        }, {
            readonly type: "int24";
            readonly name: "tickSpacing";
        }, {
            readonly type: "int24";
            readonly name: "spotTick";
        }];
        readonly name: "pool";
    }];
}, {
    readonly name: "quotePool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "tokenA";
        }, {
            readonly type: "address";
            readonly name: "tokenB";
        }, {
            readonly type: "uint24";
            readonly name: "lpFee";
        }, {
            readonly type: "int24";
            readonly name: "tickSpacing";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceBPerAX96";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "inputFeeBps";
            }, {
                readonly type: "uint16";
                readonly name: "outputFeeBps";
            }];
            readonly name: "initialFeeRate";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "bool";
            readonly name: "activateManagedPol";
        }, {
            readonly type: "uint256";
            readonly name: "nonce";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
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
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceX96";
        }, {
            readonly type: "uint256";
            readonly name: "creationFee";
        }, {
            readonly type: "uint256";
            readonly name: "polActivationFee";
        }, {
            readonly type: "uint256";
            readonly name: "totalNativeFee";
        }, {
            readonly type: "bytes32";
            readonly name: "authorizationDigest";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "createPool";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "tokenA";
        }, {
            readonly type: "address";
            readonly name: "tokenB";
        }, {
            readonly type: "uint24";
            readonly name: "lpFee";
        }, {
            readonly type: "int24";
            readonly name: "tickSpacing";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceBPerAX96";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "inputFeeBps";
            }, {
                readonly type: "uint16";
                readonly name: "outputFeeBps";
            }];
            readonly name: "initialFeeRate";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "bool";
            readonly name: "activateManagedPol";
        }, {
            readonly type: "uint256";
            readonly name: "nonce";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }, {
        readonly type: "bytes";
        readonly name: "creatorAuthorization";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "invalidatePoolCreationNonce";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "nonce";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setPoolCreationFee";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setDefaultProtocolPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }];
        readonly name: "feeRate";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setProtocolPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }];
        readonly name: "feeRate";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "clearProtocolPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setBasketFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setGeneralFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "beginGeneralPoolDecommission";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "finalizeGeneralPoolDecommission";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
    readonly name: "setProtocolPoolMaintenanceConfig";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "revenueTipBps";
        }];
        readonly name: "config";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "settleProtocolPoolRevenue";
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
        readonly type: "uint256";
        readonly name: "grossAmount";
    }, {
        readonly type: "uint256";
        readonly name: "callerTip";
    }];
}, {
    readonly name: "setProtocolPolOperator";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setProtocolPolActivationFee";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "activateProtocolPoolPol";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setProtocolPoolPolShare";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint16";
        readonly name: "shareBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "clearProtocolPoolPolShare";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "settleProtocolPoolPol";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "maximumAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "openProtocolPolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "increaseProtocolPolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "positionId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "decreaseProtocolPolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "positionId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "collectProtocolPolFees";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "closeProtocolPolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
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
    readonly outputs: readonly [];
}, {
    readonly name: "protocolPool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
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
            readonly type: "uint8";
            readonly name: "kind";
        }, {
            readonly type: "bool";
            readonly name: "decommissioned";
        }, {
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "address";
            readonly name: "basketAsset";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "bool";
            readonly name: "polActivated";
        }, {
            readonly type: "bool";
            readonly name: "polShareOverridden";
        }, {
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint256";
            readonly name: "activePolPositions";
        }];
        readonly name: "pool";
    }];
}, {
    readonly name: "isProtocolPool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "registered";
    }];
}, {
    readonly name: "poolCreationFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "protocolPolActivationFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "protocolPolOperator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
    }];
}, {
    readonly name: "isPoolCreationNonceUsed";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "used";
    }];
}, {
    readonly name: "basketFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
}, {
    readonly name: "generalFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
}, {
    readonly name: "defaultProtocolPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }];
        readonly name: "feeRate";
    }];
}, {
    readonly name: "protocolPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }, {
            readonly type: "bool";
            readonly name: "overridden";
        }];
        readonly name: "feeRate";
    }];
}, {
    readonly name: "protocolPoolCreator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }];
}, {
    readonly name: "protocolPoolMaintenanceConfig";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "revenueTipBps";
        }];
        readonly name: "config";
    }];
}, {
    readonly name: "protocolPolPosition";
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
            readonly name: "positionId";
        }, {
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
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
            readonly type: "bool";
            readonly name: "active";
        }];
        readonly name: "position";
    }];
}, {
    readonly name: "protocolPolPositionIds";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "positionIds";
    }];
}, {
    readonly name: "routeProtocolSwapFees";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "basketStaker";
        }, {
            readonly type: "uint256";
            readonly name: "staticsStaker";
        }, {
            readonly type: "uint256";
            readonly name: "creator";
        }, {
            readonly type: "uint256";
            readonly name: "treasury";
        }];
        readonly name: "distribution";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimCreatorRevenue";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minReceived";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "creatorRevenue";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "totalCreatorRevenue";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "canAccrueBasketRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "eligible";
    }];
}, {
    readonly name: "addRewardRestriction";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "removeRewardRestriction";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "rewardRestricted";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "restricted";
    }];
}, {
    readonly name: "quotePermissionedPool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "tokenA";
        }, {
            readonly type: "address";
            readonly name: "tokenB";
        }, {
            readonly type: "uint24";
            readonly name: "lpFee";
        }, {
            readonly type: "int24";
            readonly name: "tickSpacing";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceBPerAX96";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "address";
            readonly name: "controller";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "venueFeeBps";
            }, {
                readonly type: "uint8";
                readonly name: "additionalRewardRestrictedMask";
            }, {
                readonly type: "tuple";
                readonly components: readonly [{
                    readonly type: "uint16";
                    readonly name: "creatorShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "treasuryShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "staticsStakerShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "basketStakerShareBps";
                }];
                readonly name: "allocation";
            }];
            readonly name: "economics";
        }, {
            readonly type: "uint256";
            readonly name: "authorizationNonce";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "bytes32";
            readonly name: "agreementHash";
        }];
        readonly name: "params";
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
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceX96";
        }, {
            readonly type: "bytes32";
            readonly name: "authorizationDigest";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "createPermissionedPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "tokenA";
        }, {
            readonly type: "address";
            readonly name: "tokenB";
        }, {
            readonly type: "uint24";
            readonly name: "lpFee";
        }, {
            readonly type: "int24";
            readonly name: "tickSpacing";
        }, {
            readonly type: "uint160";
            readonly name: "sqrtPriceBPerAX96";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "address";
            readonly name: "controller";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "venueFeeBps";
            }, {
                readonly type: "uint8";
                readonly name: "additionalRewardRestrictedMask";
            }, {
                readonly type: "tuple";
                readonly components: readonly [{
                    readonly type: "uint16";
                    readonly name: "creatorShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "treasuryShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "staticsStakerShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "basketStakerShareBps";
                }];
                readonly name: "allocation";
            }];
            readonly name: "economics";
        }, {
            readonly type: "uint256";
            readonly name: "authorizationNonce";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "bytes32";
            readonly name: "agreementHash";
        }];
        readonly name: "params";
    }, {
        readonly type: "bytes";
        readonly name: "creatorAuthorization";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "invalidatePermissionedAuthorizationNonce";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "nonce";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "applyPermissionedPoolTerms";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "economics";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
    }, {
        readonly type: "bytes";
        readonly name: "creatorAuthorization";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "replacePermissionedPoolController";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "currentController";
    }, {
        readonly type: "address";
        readonly name: "newController";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
    }, {
        readonly type: "bytes";
        readonly name: "creatorAuthorization";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "invalidatePermissionedConfigurationNonce";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "decommissionPermissionedPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setPermissionedTrustedPeriphery";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "periphery";
    }, {
        readonly type: "bool";
        readonly name: "trusted";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "permissionedPool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
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
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "address";
            readonly name: "controller";
        }, {
            readonly type: "bool";
            readonly name: "decommissioned";
        }, {
            readonly type: "uint256";
            readonly name: "configurationNonce";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "venueFeeBps";
            }, {
                readonly type: "uint8";
                readonly name: "additionalRewardRestrictedMask";
            }, {
                readonly type: "tuple";
                readonly components: readonly [{
                    readonly type: "uint16";
                    readonly name: "creatorShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "treasuryShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "staticsStakerShareBps";
                }, {
                    readonly type: "uint16";
                    readonly name: "basketStakerShareBps";
                }];
                readonly name: "allocation";
            }];
            readonly name: "economics";
        }];
        readonly name: "pool";
    }];
}, {
    readonly name: "isPermissionedPool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "registered";
    }];
}, {
    readonly name: "isPermissionedAuthorizationNonceUsed";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "used";
    }];
}, {
    readonly name: "permissionedTermsDigest";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "economics";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "digest";
    }];
}, {
    readonly name: "permissionedControllerReplacementDigest";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "currentController";
    }, {
        readonly type: "address";
        readonly name: "newController";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "digest";
    }];
}, {
    readonly name: "liquidityIntegration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "poolManager";
    }, {
        readonly type: "address";
        readonly name: "hook";
    }, {
        readonly type: "bool";
        readonly name: "installed";
    }];
}, {
    readonly name: "unwindBasketLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "basketLiquidityUnwound";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "unwound";
    }];
}, {
    readonly name: "borrowAndProvideLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "sharesIn";
    }, {
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "asset";
        }, {
            readonly type: "int24";
            readonly name: "tickLower";
        }, {
            readonly type: "int24";
            readonly name: "tickUpper";
        }, {
            readonly type: "uint256";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Max";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Max";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "pools";
    }, {
        readonly type: "address";
        readonly name: "lpRecipient";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }, {
        readonly type: "uint256[]";
        readonly name: "v4TokenIds";
    }];
}, {
    readonly name: "treasury";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "creationFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PeggedMintedAndRecombined";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "peggedProfileId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "volatileProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "riskSharesBurned";
    }, {
        readonly type: "uint256";
        readonly name: "peggedCollateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarMintedAndBurned";
    }, {
        readonly type: "uint256";
        readonly name: "volatileCollateralOut";
    }];
}, {
    readonly name: "PeggedMintAndRecombineDeferred";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "peggedProfileId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "volatileProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }];
}, {
    readonly name: "BasketCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "token";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "string";
        readonly name: "name";
    }, {
        readonly type: "string";
        readonly name: "symbol";
    }];
}, {
    readonly name: "BasketConfigured";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address[]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[]";
        readonly name: "bundleAmounts";
    }, {
        readonly type: "uint16";
        readonly name: "flashFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "originationFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "extensionFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "ltvBps";
    }, {
        readonly type: "uint16";
        readonly name: "recoveryPenaltyBps";
    }, {
        readonly type: "uint40";
        readonly name: "loanDuration";
    }];
}, {
    readonly name: "BasketFeeTiersConfigured";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "mintAction";
        readonly indexed: true;
    }, {
        readonly type: "uint256[]";
        readonly name: "minActionShares";
    }, {
        readonly type: "uint256[]";
        readonly name: "feeShares";
    }];
}, {
    readonly name: "BasketLaunched";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "token";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketShares";
    }, {
        readonly type: "uint256";
        readonly name: "poolCount";
    }];
}, {
    readonly name: "BasketMinted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "BasketRedeemed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "PositionCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }];
}, {
    readonly name: "PositionClosed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }];
}, {
    readonly name: "PositionCreationFeeSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "previousAmount";
    }, {
        readonly type: "uint256";
        readonly name: "newAmount";
    }];
}, {
    readonly name: "PositionCreationFeePaid";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "treasury";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PositionOwnerIndexSynced";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }];
}, {
    readonly name: "PositionLegAttached";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "moduleAuthority";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "moduleType";
    }, {
        readonly type: "bytes32";
        readonly name: "localPositionId";
    }, {
        readonly type: "uint256";
        readonly name: "stateNonce";
    }];
}, {
    readonly name: "PositionLegDetached";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "stateNonce";
    }];
}, {
    readonly name: "PositionStateChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "stateNonce";
    }, {
        readonly type: "uint256";
        readonly name: "activeLegCount";
    }, {
        readonly type: "uint256";
        readonly name: "unresolvedObligationCount";
    }];
}, {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }];
}, {
    readonly name: "BasketCollateralDeposited";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "BasketCollateralWithdrawn";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "BasketCollateralRedeemed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "LoanOriginated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "operator";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "sharesIn";
    }, {
        readonly type: "uint256";
        readonly name: "feeShares";
    }, {
        readonly type: "uint256";
        readonly name: "collateralShares";
    }, {
        readonly type: "uint256";
        readonly name: "debtShares";
    }, {
        readonly type: "uint256";
        readonly name: "penaltyShares";
    }, {
        readonly type: "uint40";
        readonly name: "maturity";
    }];
}, {
    readonly name: "LoanRepaid";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }];
}, {
    readonly name: "LoanExtended";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "maturity";
    }];
}, {
    readonly name: "LoanExtensionFeePaid";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "requiredFee";
    }, {
        readonly type: "uint256";
        readonly name: "receivedFee";
    }];
}, {
    readonly name: "LoanRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "burnedShares";
    }, {
        readonly type: "uint256";
        readonly name: "unlockedShares";
    }];
}, {
    readonly name: "RecoveryPenaltyDistributed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "callerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "callerReceived";
    }, {
        readonly type: "uint256";
        readonly name: "protocolAmount";
    }];
}, {
    readonly name: "BasketFlashLoan";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "initiator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "uint256[]";
        readonly name: "amounts";
    }, {
        readonly type: "uint256[]";
        readonly name: "fees";
    }];
}, {
    readonly name: "AssetFlashLoan";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "initiator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "fee";
    }];
}, {
    readonly name: "SingleAssetFlashFeeBpsUpdated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "previousFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "newFeeBps";
    }];
}, {
    readonly name: "StakingPositionCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "Staked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "totalPositionStake";
    }];
}, {
    readonly name: "Unstaked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "totalPositionStake";
    }];
}, {
    readonly name: "GlobalFeeAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "grossFee";
    }, {
        readonly type: "uint256";
        readonly name: "stakerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }];
}, {
    readonly name: "SwapRewardCrystallized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "eligibleWeight";
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }, {
        readonly type: "uint256";
        readonly name: "unfundedAmount";
    }];
}, {
    readonly name: "SwapRewardFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "unfundedAmount";
    }];
}, {
    readonly name: "RewardClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "TreasuryFeesDistributed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "treasury";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "RewardAssetOptedIn";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "actualPendingStake";
    }, {
        readonly type: "uint256";
        readonly name: "effectivePendingWeight";
    }, {
        readonly type: "uint40";
        readonly name: "eligibleAt";
    }];
}, {
    readonly name: "RewardStakeScheduled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "actualPendingStake";
    }, {
        readonly type: "uint256";
        readonly name: "effectivePendingWeight";
    }, {
        readonly type: "uint40";
        readonly name: "eligibleAt";
    }];
}, {
    readonly name: "RewardBucketMatured";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "eligibleAt";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "actualStake";
    }, {
        readonly type: "uint256";
        readonly name: "effectiveWeight";
    }, {
        readonly type: "uint256";
        readonly name: "totalActualEligibleStake";
    }, {
        readonly type: "uint256";
        readonly name: "totalEffectiveEligibleWeight";
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }];
}, {
    readonly name: "PositionRewardEligibilityActivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "actualStake";
    }, {
        readonly type: "uint256";
        readonly name: "effectiveWeight";
    }, {
        readonly type: "uint40";
        readonly name: "eligibleAt";
    }, {
        readonly type: "uint256";
        readonly name: "activationIndexRay";
    }];
}, {
    readonly name: "RewardAssetOptedOut";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "removedActualEligibleStake";
    }, {
        readonly type: "uint256";
        readonly name: "removedActualPendingStake";
    }, {
        readonly type: "uint256";
        readonly name: "removedEffectiveEligibleWeight";
    }, {
        readonly type: "uint256";
        readonly name: "removedEffectivePendingWeight";
    }];
}, {
    readonly name: "PositionRewardWeightChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "previousMultiplierBps";
    }, {
        readonly type: "uint16";
        readonly name: "newMultiplierBps";
    }, {
        readonly type: "uint256";
        readonly name: "effectiveEligibleWeight";
    }, {
        readonly type: "uint256";
        readonly name: "effectivePendingWeight";
    }];
}, {
    readonly name: "RewardAssetDustRouted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "RewardBookCheckpointed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }];
}, {
    readonly name: "PositionRewardSettled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "GenesisLinked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "multiplierBps";
    }];
}, {
    readonly name: "GenesisUnlinked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "previousMultiplierBps";
    }];
}, {
    readonly name: "GenesisRegistered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "weight";
    }, {
        readonly type: "uint256";
        readonly name: "totalWeight";
    }];
}, {
    readonly name: "GenesisWeightChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "previousWeight";
    }, {
        readonly type: "uint256";
        readonly name: "newWeight";
    }, {
        readonly type: "uint256";
        readonly name: "totalWeight";
    }];
}, {
    readonly name: "GenesisRevenueAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "genesisAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }];
}, {
    readonly name: "GenesisRewardsClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "GenesisOwnerRewardsClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "GenesisTreasuryRewardsClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PartnerRevenueAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PartnerRevenueDistributed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "grossAmount";
    }, {
        readonly type: "uint256";
        readonly name: "distributedAmount";
    }, {
        readonly type: "uint256";
        readonly name: "tip";
    }];
}, {
    readonly name: "LiquidityIntegrationInstalled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "poolManager";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "hook";
        readonly indexed: true;
    }];
}, {
    readonly name: "CanonicalPoolInitialized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency0";
    }, {
        readonly type: "address";
        readonly name: "currency1";
    }, {
        readonly type: "uint160";
        readonly name: "sqrtPriceX96";
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }];
}, {
    readonly name: "ProtocolPoolCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency0";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency1";
    }, {
        readonly type: "uint24";
        readonly name: "lpFee";
    }, {
        readonly type: "int24";
        readonly name: "tickSpacing";
    }, {
        readonly type: "uint160";
        readonly name: "sqrtPriceX96";
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }];
}, {
    readonly name: "PoolCreationFeeSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PoolCreationNonceInvalidated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
        readonly indexed: true;
    }];
}, {
    readonly name: "DefaultProtocolPoolFeeRateSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
}, {
    readonly name: "ProtocolPoolFeeRateSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
}, {
    readonly name: "ProtocolPoolFeeRateCleared";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "BasketFeeAllocationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "polShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "basketStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}, {
    readonly name: "GeneralFeeAllocationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "polShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}, {
    readonly name: "GeneralPoolDecommissionStarted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "GeneralPoolDecommissionFinalized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency0";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency1";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ProtocolPoolMaintenanceConfigSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "revenueTipBps";
    }];
}, {
    readonly name: "ProtocolPoolRevenueSettled";
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
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "grossAmount";
    }, {
        readonly type: "uint256";
        readonly name: "callerTip";
    }];
}, {
    readonly name: "ProtocolPolOperatorSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
        readonly indexed: true;
    }];
}, {
    readonly name: "ProtocolPolActivationFeeSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "ProtocolPolActivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "feePaid";
    }];
}, {
    readonly name: "ProtocolPolShareSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "shareBps";
    }, {
        readonly type: "bool";
        readonly name: "overridden";
    }];
}, {
    readonly name: "ProtocolPolInventorySettled";
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
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "ProtocolPolPositionOpened";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "manager";
        readonly indexed: true;
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
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ProtocolPolPositionIncreased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint128";
        readonly name: "liquidityAdded";
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ProtocolPolPositionDecreased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint128";
        readonly name: "liquidityRemoved";
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ProtocolPolFeesCollected";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ProtocolPolPositionClosed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "CreatorRevenueAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "CreatorRevenueClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "RewardRestrictionAdded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }];
}, {
    readonly name: "RewardRestrictionRemoved";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }];
}, {
    readonly name: "PermissionedLiquidityIntegrationInstalled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "hook";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "router";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "positionManager";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "quoter";
    }];
}, {
    readonly name: "PermissionedPoolCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "controller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency0";
    }, {
        readonly type: "address";
        readonly name: "currency1";
    }, {
        readonly type: "uint24";
        readonly name: "lpFee";
    }, {
        readonly type: "int24";
        readonly name: "tickSpacing";
    }, {
        readonly type: "uint160";
        readonly name: "sqrtPriceX96";
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
    }];
}, {
    readonly name: "PermissionedAuthorizationNonceInvalidated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
        readonly indexed: true;
    }];
}, {
    readonly name: "PermissionedConfigurationNonceInvalidated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldNonce";
    }, {
        readonly type: "uint256";
        readonly name: "newNonce";
    }];
}, {
    readonly name: "PermissionedPoolTermsChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
        readonly indexed: true;
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "oldEconomics";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "newEconomics";
    }];
}, {
    readonly name: "PermissionedPoolControllerReplaced";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "oldController";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "newController";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }, {
        readonly type: "bytes32";
        readonly name: "agreementHash";
    }];
}, {
    readonly name: "PermissionedPoolDecommissioned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "PermissionedTrustedPeripherySet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "periphery";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "trusted";
    }];
}, {
    readonly name: "LiquidityManagerReplaced";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "oldManager";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "newManager";
        readonly indexed: true;
    }];
}, {
    readonly name: "LiquidityManagerInstalled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
        readonly indexed: true;
    }];
}, {
    readonly name: "CanonicalPoolSyncedToManager";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "manager";
    }];
}, {
    readonly name: "ProtocolPolTreasuryAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "sourcePoolAsset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "rewardAsset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "BasketLiquidityUnwound";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "constituentReleased";
    }, {
        readonly type: "uint256";
        readonly name: "basketTokensBurned";
    }];
}, {
    readonly name: "BorrowedLiquidityPositionMinted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "v4TokenId";
    }, {
        readonly type: "address";
        readonly name: "recipient";
    }, {
        readonly type: "uint256";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "spent0";
    }, {
        readonly type: "uint256";
        readonly name: "spent1";
    }, {
        readonly type: "uint256";
        readonly name: "refund0";
    }, {
        readonly type: "uint256";
        readonly name: "refund1";
    }];
}, {
    readonly name: "BorrowedLiquidityProvided";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "operator";
    }, {
        readonly type: "address";
        readonly name: "lpRecipient";
    }, {
        readonly type: "uint256";
        readonly name: "sharesIn";
    }, {
        readonly type: "uint256";
        readonly name: "basketSharesMinted";
    }, {
        readonly type: "uint256[]";
        readonly name: "v4TokenIds";
    }];
}, {
    readonly name: "BasketRewardAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }];
}, {
    readonly name: "BasketRewardSettled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "BasketRewardClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "BasketRewardDustRouted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "asset";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
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
        readonly type: "uint128";
        readonly name: "liquidity";
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
        readonly type: "uint128";
        readonly name: "liquidity";
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
        readonly type: "uint128";
        readonly name: "liquidity";
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
}, {
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
}, {
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
}, {
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
export declare const staticsFlashAssetBorrowerAbi: readonly [{
    readonly name: "onStaticsFlashLoanAsset";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "initiator";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "fee";
    }, {
        readonly type: "bytes";
        readonly name: "data";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}];
export declare const staticsPositionPortfolioAbi: readonly [{
    readonly name: "positionPortfolioCounts";
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
            readonly name: "basketCount";
        }, {
            readonly type: "uint256";
            readonly name: "loanCount";
        }, {
            readonly type: "uint256";
            readonly name: "globalRewardAssetCount";
        }, {
            readonly type: "uint256";
            readonly name: "riskSeriesCount";
        }, {
            readonly type: "uint256";
            readonly name: "morphoMarketCount";
        }];
        readonly name: "counts";
    }];
}, {
    readonly name: "basketIdsOfPosition";
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
        readonly type: "uint256[]";
        readonly name: "basketIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "loanIdsOfPosition";
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
        readonly type: "uint256[]";
        readonly name: "loanIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
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
    readonly name: "riskSeriesIdsOfPosition";
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
        readonly type: "uint256[]";
        readonly name: "seriesIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}, {
    readonly name: "morphoMarketIdsOfPosition";
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
        readonly type: "bytes32[]";
        readonly name: "marketIds";
    }, {
        readonly type: "uint256";
        readonly name: "nextCursor";
    }];
}];
export declare const staticsPositionPortfolioErrorAbi: readonly [{
    readonly name: "InvalidPortfolioPageSize";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}];
export declare const staticsMorphoErrorAbi: readonly [{
    readonly name: "InvalidAmount";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "InsufficientUntrackedCollateral";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "IncompatibleTokenTransfer";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }];
}, {
    readonly name: "MorphoAccountNotDeployed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "MinimumRecoveryNotMet";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }];
}, {
    readonly name: "MorphoNotInitialized";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidMarket";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "marketId";
    }];
}, {
    readonly name: "NotMorphoRecoveryBeneficiary";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "beneficiary";
    }];
}];
export declare const staticsSwapFeeHookAbi: readonly [{
    readonly name: "staticsDiamond";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "defaultFeeRate";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
}, {
    readonly name: "setDefaultFeeRate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "clearPoolFeeRate";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "poolFeeRate";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }, {
            readonly type: "bool";
            readonly name: "overridden";
        }];
        readonly name: "rate";
    }];
}, {
    readonly name: "basketFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
}, {
    readonly name: "generalFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
}, {
    readonly name: "setBasketFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setGeneralFeeAllocation";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "polShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "allocation";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "registerPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
        readonly type: "uint8";
        readonly name: "kind";
    }, {
        readonly type: "address";
        readonly name: "creator";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "decommissionPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "poolDecommissioned";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "decommissioned";
    }];
}, {
    readonly name: "poolRegistration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "currency0";
        }, {
            readonly type: "address";
            readonly name: "currency1";
        }, {
            readonly type: "uint8";
            readonly name: "kind";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "bool";
            readonly name: "registered";
        }];
        readonly name: "registration";
    }];
}, {
    readonly name: "pendingProtocolPol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "currency";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "pendingFeeDistribution";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "currency";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "basketStaker";
        }, {
            readonly type: "uint256";
            readonly name: "staticsStaker";
        }, {
            readonly type: "uint256";
            readonly name: "creator";
        }, {
            readonly type: "uint256";
            readonly name: "treasury";
        }];
        readonly name: "distribution";
    }];
}, {
    readonly name: "claimLiability";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "currency";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "settleFeeDistribution";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
        readonly type: "address";
        readonly name: "currency";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "basketStaker";
        }, {
            readonly type: "uint256";
            readonly name: "staticsStaker";
        }, {
            readonly type: "uint256";
            readonly name: "creator";
        }, {
            readonly type: "uint256";
            readonly name: "treasury";
        }];
        readonly name: "distribution";
    }];
}, {
    readonly name: "settleProtocolPol";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
        readonly type: "address";
        readonly name: "currency";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "maximumAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PoolRegistered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency0";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency1";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "kind";
    }, {
        readonly type: "address";
        readonly name: "creator";
    }];
}, {
    readonly name: "SwapLegFeeAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "specifiedLeg";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "realizedAmount";
    }, {
        readonly type: "uint256";
        readonly name: "chargedAmount";
    }, {
        readonly type: "uint256";
        readonly name: "polAmount";
    }, {
        readonly type: "uint256";
        readonly name: "basketStakerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsStakerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "creatorAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }];
}, {
    readonly name: "PendingFeeDistributionReallocated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "basketStakerToPol";
    }, {
        readonly type: "uint256";
        readonly name: "staticsStakerToTreasury";
    }];
}, {
    readonly name: "ProtocolPolSettled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PoolDecommissioned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "PoolFeeRateSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }, {
        readonly type: "bool";
        readonly name: "overridden";
    }];
}, {
    readonly name: "DefaultFeeRateSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
}, {
    readonly name: "BasketFeeAllocationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "polShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "basketStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}, {
    readonly name: "GeneralFeeAllocationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "polShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}];
export declare const staticsPermissionedSwapFeeHookAbi: readonly [{
    readonly name: "staticsDiamond";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "registerPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
        readonly type: "address";
        readonly name: "controller";
    }, {
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "economics";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "setPoolEconomics";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "economics";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setPoolController";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "controller";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "decommissionPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setTrustedPeriphery";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "periphery";
    }, {
        readonly type: "bool";
        readonly name: "trusted";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "poolRegistration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "currency0";
        }, {
            readonly type: "address";
            readonly name: "currency1";
        }, {
            readonly type: "address";
            readonly name: "controller";
        }, {
            readonly type: "address";
            readonly name: "creator";
        }, {
            readonly type: "bool";
            readonly name: "registered";
        }, {
            readonly type: "bool";
            readonly name: "decommissioned";
        }];
        readonly name: "registration";
    }];
}, {
    readonly name: "poolEconomics";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "economics";
    }];
}, {
    readonly name: "trustedPeriphery";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "periphery";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "trusted";
    }];
}, {
    readonly name: "PermissionedPoolRegistered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency0";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "currency1";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "controller";
    }, {
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "economics";
    }];
}, {
    readonly name: "PermissionedPoolEconomicsSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "oldEconomics";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "venueFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "additionalRewardRestrictedMask";
        }, {
            readonly type: "tuple";
            readonly components: readonly [{
                readonly type: "uint16";
                readonly name: "creatorShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "treasuryShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "staticsStakerShareBps";
            }, {
                readonly type: "uint16";
                readonly name: "basketStakerShareBps";
            }];
            readonly name: "allocation";
        }];
        readonly name: "newEconomics";
    }];
}, {
    readonly name: "PermissionedPoolControllerSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "oldController";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "newController";
        readonly indexed: true;
    }];
}, {
    readonly name: "PermissionedVenueFeeCharged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "outputCurrency";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "grossOutput";
    }, {
        readonly type: "uint256";
        readonly name: "chargedAmount";
    }, {
        readonly type: "uint256";
        readonly name: "creatorAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsStakerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "basketStakerAmount";
    }];
}, {
    readonly name: "PermissionedRewardsNormalized";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "restrictedCurrency";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "rewardCurrency";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amountIn";
    }, {
        readonly type: "uint256";
        readonly name: "amountOut";
    }];
}];
export declare const defaultVenueControllerAbi: readonly [{
    readonly name: "SWAP_ALLOWED";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "LIQUIDITY_ALLOWED";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "ALL_PERMISSIONS";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "operator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "pendingOperator";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "startOperatorTransfer";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "nextOperator";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "acceptOperator";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
}, {
    readonly name: "setPermissions";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address[]";
        readonly name: "accounts";
    }, {
        readonly type: "uint256[]";
        readonly name: "flags";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setAssetStatus";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setPoolStatus";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "permissions";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "flags";
    }];
}, {
    readonly name: "assetStatus";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }];
}, {
    readonly name: "poolStatus";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }];
}];
export declare const staticsPermissionedRouterAbi: readonly [{
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "permit2";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "permissionedHook";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "swapExactInputSingle";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
            readonly name: "poolKey";
        }, {
            readonly type: "bool";
            readonly name: "zeroForOne";
        }, {
            readonly type: "uint128";
            readonly name: "amountIn";
        }, {
            readonly type: "uint128";
            readonly name: "amountOutMinimum";
        }, {
            readonly type: "bytes";
            readonly name: "hookData";
        }];
        readonly name: "params";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amountOut";
    }];
}];
export declare const staticsPermissionedPositionManagerAbi: readonly [{
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "permit2";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "permissionedHook";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "positionClaims";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "getPositionLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint128";
        readonly name: "liquidity";
    }];
}, {
    readonly name: "modifyLiquidities";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "unlockData";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [];
}];
export declare const permissionedPositionClaimsAbi: readonly [{
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "positionManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "permissionedHook";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "forceUnwind";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "uint128";
        readonly name: "amount0Min";
    }, {
        readonly type: "uint128";
        readonly name: "amount1Min";
    }, {
        readonly type: "bytes";
        readonly name: "hookData";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claim";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "currency";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "creditOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "currency";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
export declare const staticsTokenAbi: readonly [{
    readonly name: "FIXED_SUPPLY";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "transfer";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "burn";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "nonces";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "Approval";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "spender";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
export declare const staticsLiquidityManagerAbi: readonly [{
    readonly name: "staticsDiamond";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "positionManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "permit2";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "mintUserPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
            readonly name: "poolKey";
        }, {
            readonly type: "int24";
            readonly name: "tickLower";
        }, {
            readonly type: "int24";
            readonly name: "tickUpper";
        }, {
            readonly type: "uint256";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "request";
    }, {
        readonly type: "address";
        readonly name: "recipient";
    }, {
        readonly type: "address";
        readonly name: "refundRecipient";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
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
    }, {
        readonly type: "uint256";
        readonly name: "refund0";
    }, {
        readonly type: "uint256";
        readonly name: "refund1";
    }];
}, {
    readonly name: "mintManagedPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
            readonly name: "poolKey";
        }, {
            readonly type: "int24";
            readonly name: "tickLower";
        }, {
            readonly type: "int24";
            readonly name: "tickUpper";
        }, {
            readonly type: "uint256";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "request";
    }, {
        readonly type: "address";
        readonly name: "refundRecipient";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }, {
            readonly type: "uint256";
            readonly name: "refund0";
        }, {
            readonly type: "uint256";
            readonly name: "refund1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "attachManagedPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "bytes32";
        readonly name: "expectedPoolId";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
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
            readonly name: "poolKey";
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
            readonly type: "address";
            readonly name: "owner";
        }, {
            readonly type: "address";
            readonly name: "subscriber";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "inspectManagedPosition";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
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
            readonly name: "poolKey";
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
            readonly type: "address";
            readonly name: "owner";
        }, {
            readonly type: "address";
            readonly name: "subscriber";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "increaseManagedPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }];
        readonly name: "request";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }, {
            readonly type: "uint256";
            readonly name: "refund0";
        }, {
            readonly type: "uint256";
            readonly name: "refund1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "decreaseManagedPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }];
        readonly name: "request";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }, {
            readonly type: "uint256";
            readonly name: "refund0";
        }, {
            readonly type: "uint256";
            readonly name: "refund1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "collectManagedPositionFees";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }];
        readonly name: "request";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }, {
            readonly type: "uint256";
            readonly name: "refund0";
        }, {
            readonly type: "uint256";
            readonly name: "refund1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "burnManagedPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }];
        readonly name: "request";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }, {
            readonly type: "uint256";
            readonly name: "refund0";
        }, {
            readonly type: "uint256";
            readonly name: "refund1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "exitManagedPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidity";
        }, {
            readonly type: "uint256";
            readonly name: "amount0Limit";
        }, {
            readonly type: "uint256";
            readonly name: "amount1Limit";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }, {
            readonly type: "address";
            readonly name: "receiver";
        }];
        readonly name: "request";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "tokenId";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityBefore";
        }, {
            readonly type: "uint128";
            readonly name: "liquidityAfter";
        }, {
            readonly type: "uint256";
            readonly name: "spent0";
        }, {
            readonly type: "uint256";
            readonly name: "spent1";
        }, {
            readonly type: "uint256";
            readonly name: "received0";
        }, {
            readonly type: "uint256";
            readonly name: "received1";
        }, {
            readonly type: "uint256";
            readonly name: "refund0";
        }, {
            readonly type: "uint256";
            readonly name: "refund1";
        }];
        readonly name: "movement";
    }];
}, {
    readonly name: "recoverUnboundPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "UserPositionMinted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "recipient";
    }, {
        readonly type: "address";
        readonly name: "refundRecipient";
    }, {
        readonly type: "uint256";
        readonly name: "spent0";
    }, {
        readonly type: "uint256";
        readonly name: "spent1";
    }, {
        readonly type: "uint256";
        readonly name: "refund0";
    }, {
        readonly type: "uint256";
        readonly name: "refund1";
    }];
}, {
    readonly name: "ManagedPositionMinted";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint128";
        readonly name: "liquidity";
    }];
}, {
    readonly name: "ManagedPositionAttached";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "previousOwner";
        readonly indexed: true;
    }];
}, {
    readonly name: "ManagedPositionLiquidityChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint128";
        readonly name: "liquidityBefore";
    }, {
        readonly type: "uint128";
        readonly name: "liquidityAfter";
    }];
}, {
    readonly name: "ManagedPositionFeesCollected";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ManagedPositionBurned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "ManagedPositionExited";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "UnboundPositionRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }];
}];
export declare const v4PositionManagerReadAbi: readonly [{
    readonly name: "nextTokenId";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "ownerOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "getApproved";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "modifyLiquidities";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "unlockData";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getPositionLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint128";
        readonly name: "liquidity";
    }];
}, {
    readonly name: "getPoolAndPositionInfo";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
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
        readonly name: "poolKey";
    }, {
        readonly type: "uint256";
        readonly name: "info";
    }];
}, {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }];
}];
export declare const v4StateViewReadAbi: readonly [{
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "getSlot0";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint160";
        readonly name: "sqrtPriceX96";
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }, {
        readonly type: "uint24";
        readonly name: "protocolFee";
    }, {
        readonly type: "uint24";
        readonly name: "lpFee";
    }];
}, {
    readonly name: "getLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint128";
        readonly name: "liquidity";
    }];
}, {
    readonly name: "getPositionInfo";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "int24";
        readonly name: "tickLower";
    }, {
        readonly type: "int24";
        readonly name: "tickUpper";
    }, {
        readonly type: "bytes32";
        readonly name: "salt";
    }];
    readonly outputs: readonly [{
        readonly type: "uint128";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "feeGrowthInside0LastX128";
    }, {
        readonly type: "uint256";
        readonly name: "feeGrowthInside1LastX128";
    }];
}, {
    readonly name: "getFeeGrowthInside";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "int24";
        readonly name: "tickLower";
    }, {
        readonly type: "int24";
        readonly name: "tickUpper";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "feeGrowthInside0X128";
    }, {
        readonly type: "uint256";
        readonly name: "feeGrowthInside1X128";
    }];
}];
export declare const v4QuoterAbi: readonly [{
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "quoteExactInputSingle";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
            readonly name: "poolKey";
        }, {
            readonly type: "bool";
            readonly name: "zeroForOne";
        }, {
            readonly type: "uint128";
            readonly name: "exactAmount";
        }, {
            readonly type: "bytes";
            readonly name: "hookData";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amountOut";
    }, {
        readonly type: "uint256";
        readonly name: "gasEstimate";
    }];
}];
export declare const universalRouterAbi: readonly [{
    readonly name: "poolManager";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "execute";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "bytes";
        readonly name: "commands";
    }, {
        readonly type: "bytes[]";
        readonly name: "inputs";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }];
    readonly outputs: readonly [];
}];
export declare const permit2AllowanceAbi: readonly [{
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint160";
        readonly name: "amount";
    }, {
        readonly type: "uint48";
        readonly name: "expiration";
    }, {
        readonly type: "uint48";
        readonly name: "nonce";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint160";
        readonly name: "amount";
    }, {
        readonly type: "uint48";
        readonly name: "expiration";
    }];
    readonly outputs: readonly [];
}];
export declare const staticsTestnetFaucetAbi: readonly [{
    readonly name: "ASSET_COUNT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "COOLDOWN";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "USDG_AMOUNT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "USDSTX_AMOUNT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "STATICS_AMOUNT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "STOCK_AMOUNT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "asset";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "index";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "lastClaimAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint64";
    }];
}, {
    readonly name: "nextClaimAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "claim";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
}, {
    readonly name: "Claimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
        readonly indexed: true;
    }, {
        readonly type: "uint64";
        readonly name: "claimedAt";
    }, {
        readonly type: "address[6]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[6]";
        readonly name: "amounts";
    }];
}];
export type StaticsLiquidityEventName = "StakingPositionCreated" | "Staked" | "Unstaked" | "GlobalFeeAccrued" | "SwapRewardCrystallized" | "SwapRewardFunded" | "RewardClaimed" | "TreasuryFeesDistributed" | "RewardAssetOptedIn" | "RewardStakeScheduled" | "RewardBucketMatured" | "PositionRewardEligibilityActivated" | "RewardAssetOptedOut" | "RewardAssetDustRouted" | "PositionRewardSettled" | "LiquidityIntegrationInstalled" | "CanonicalPoolInitialized" | "ProtocolPoolCreated" | "PoolCreationFeeSet" | "PoolCreationNonceInvalidated" | "DefaultProtocolPoolFeeRateSet" | "ProtocolPoolFeeRateSet" | "ProtocolPoolFeeRateCleared" | "BasketFeeAllocationSet" | "GeneralFeeAllocationSet" | "GeneralPoolDecommissionStarted" | "GeneralPoolDecommissionFinalized" | "ProtocolPoolMaintenanceConfigSet" | "ProtocolPoolRevenueSettled" | "ProtocolPolOperatorSet" | "ProtocolPolActivationFeeSet" | "ProtocolPolActivated" | "ProtocolPolShareSet" | "ProtocolPolInventorySettled" | "ProtocolPolPositionOpened" | "ProtocolPolPositionIncreased" | "ProtocolPolPositionDecreased" | "ProtocolPolFeesCollected" | "ProtocolPolPositionClosed" | "CreatorRevenueAccrued" | "CreatorRevenueClaimed" | "LiquidityManagerReplaced" | "LiquidityManagerInstalled" | "CanonicalPoolSyncedToManager" | "ProtocolPolTreasuryAccrued" | "BasketLiquidityUnwound" | "BorrowedLiquidityPositionMinted" | "BorrowedLiquidityProvided" | "BasketRewardAccrued" | "BasketRewardSettled" | "BasketRewardClaimed" | "BasketRewardDustRouted";
export type StaticsLiquidityEventArgs<Name extends StaticsLiquidityEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsPositionEventName = "PositionCreated" | "PositionClosed" | "PositionCreationFeeSet" | "PositionCreationFeePaid" | "PositionLegAttached" | "PositionLegDetached" | "PositionStateChanged" | "Transfer" | "BasketCollateralDeposited" | "BasketCollateralWithdrawn" | "BasketCollateralRedeemed" | "BasketRewardSettled" | "BasketRewardClaimed" | "StakingPositionCreated" | "Staked" | "Unstaked" | "RewardAssetOptedIn" | "RewardStakeScheduled" | "PositionRewardEligibilityActivated" | "RewardAssetOptedOut" | "PositionRewardSettled";
export type StaticsPositionEventArgs<Name extends StaticsPositionEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsLendingEventName = "LoanOriginated" | "LoanRepaid" | "LoanExtended" | "LoanExtensionFeePaid" | "LoanRecovered" | "RecoveryPenaltyDistributed";
export type StaticsLendingEventArgs<Name extends StaticsLendingEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsHookEventName = "PoolRegistered" | "SwapLegFeeAccrued" | "PendingFeeDistributionReallocated" | "ProtocolPolSettled" | "PoolDecommissioned" | "PoolFeeRateSet" | "DefaultFeeRateSet" | "BasketFeeAllocationSet" | "GeneralFeeAllocationSet";
export type StaticsHookEventArgs<Name extends StaticsHookEventName> = ContractEventArgs<typeof staticsSwapFeeHookAbi, Name>;
export type StaticsLiquidityManagerEventName = "UserPositionMinted" | "ManagedPositionMinted" | "ManagedPositionAttached" | "ManagedPositionLiquidityChanged" | "ManagedPositionFeesCollected" | "ManagedPositionBurned" | "ManagedPositionExited" | "UnboundPositionRecovered";
export type StaticsLiquidityManagerEventArgs<Name extends StaticsLiquidityManagerEventName> = ContractEventArgs<typeof staticsLiquidityManagerAbi, Name>;
export declare const basketTokenAbi: readonly [{
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "permit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "uint8";
        readonly name: "v";
    }, {
        readonly type: "bytes32";
        readonly name: "r";
    }, {
        readonly type: "bytes32";
        readonly name: "s";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "nonces";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "DOMAIN_SEPARATOR";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}];
export declare const staticsDollarTokenAbi: readonly [{
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "permit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "uint8";
        readonly name: "v";
    }, {
        readonly type: "bytes32";
        readonly name: "r";
    }, {
        readonly type: "bytes32";
        readonly name: "s";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "nonces";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "DOMAIN_SEPARATOR";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "coreTokenKind";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "pool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "NotMinter";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "NotBurner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}];
export declare const staticsBasketErrorAbi: readonly [{
    readonly name: "BasketNotFound";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
}, {
    readonly name: "InvalidBasketDefinition";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "FeeExceedsCap";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "feeBps";
    }];
}, {
    readonly name: "LtvExceedsMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "ltvBps";
    }];
}, {
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidShares";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidAmountsLength";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "MaximumInputExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "MinimumOutputNotMet";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "ActionPaused";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "action";
    }];
}, {
    readonly name: "InsufficientVaultBalance";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "IncorrectCreationFee";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }];
}, {
    readonly name: "CreationFeeTransferFailed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "treasury";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PermissionlessBasketCreationDisabled";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "LiquidityIntegrationNotInstalled";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "LiquidityManagerNotInstalled";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidPoolLaunchParameters";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidPoolLaunchLpFee";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint24";
        readonly name: "lpFee";
    }];
}, {
    readonly name: "InvalidPoolLaunchTickSpacing";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "int24";
        readonly name: "tickSpacing";
    }];
}, {
    readonly name: "InvalidPoolLaunchPrice";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint160";
        readonly name: "sqrtPriceAssetPerBasketX96";
    }];
}, {
    readonly name: "InvalidPoolLaunchLiquidity";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "pairedAssetAmount";
    }];
}, {
    readonly name: "CanonicalPoolAlreadyAssociated";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "LaunchInputExceedsMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "InsufficientLaunchAssetReceived";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "LaunchDebitExceedsMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "actualDebit";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "LaunchDeadlineExpired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "uint256";
        readonly name: "timestamp";
    }];
}, {
    readonly name: "InsufficientTransferReceived";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "BasketNotActive";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }];
}];
export declare const staticsProtocolPoolErrorAbi: readonly [{
    readonly name: "LiquidityIntegrationNotInstalled";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidToken";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }];
}, {
    readonly name: "IdenticalTokens";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }];
}, {
    readonly name: "DeadlineExpired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "deadline";
    }];
}, {
    readonly name: "InvalidTickSpacing";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "int24";
        readonly name: "tickSpacing";
    }];
}, {
    readonly name: "InvalidPoolPrice";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint160";
        readonly name: "sqrtPriceBPerAX96";
    }];
}, {
    readonly name: "InvalidFeeRate";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }];
}, {
    readonly name: "PoolAlreadyInitialized";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "PoolAlreadyRegisteredInHook";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "ActionPaused";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "action";
    }];
}, {
    readonly name: "IncorrectCreationFee";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "provided";
    }];
}, {
    readonly name: "CreationFeeTransferFailed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "treasury";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "InvalidCreator";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }];
}, {
    readonly name: "InvalidCreatorAuthorization";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }];
}, {
    readonly name: "PoolCreationNonceAlreadyUsed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "uint256";
        readonly name: "nonce";
    }];
}, {
    readonly name: "PoolAlreadyDecommissioned";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "IncompatibleTokenTransfer";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "observed";
    }];
}, {
    readonly name: "InvalidLiquidityManager";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }];
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
    readonly name: "LiquidityManagerUnchanged";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }];
}, {
    readonly name: "InvalidMaintenanceConfig";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InsufficientMarketHistory";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "target";
    }];
}, {
    readonly name: "ExcessiveSpotTickDeviation";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "int24";
        readonly name: "spotTick";
    }, {
        readonly type: "int24";
        readonly name: "twapTick";
    }, {
        readonly type: "uint24";
        readonly name: "maximum";
    }];
}, {
    readonly name: "EmptyMaintenanceResult";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "LiquidityManagerApprovalMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }, {
        readonly type: "bool";
        readonly name: "expected";
    }];
}, {
    readonly name: "OnlySwapFeeHook";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "expected";
    }];
}, {
    readonly name: "InvalidRewardAsset";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "GeneralPoolBasketReward";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "IncompatibleRevenueAsset";
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
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NoCreatorRevenue";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "MinimumOutputNotMet";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "ProtocolPoolNotRegistered";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}, {
    readonly name: "ProtocolPoolAlreadyRegistered";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "kind";
    }];
}, {
    readonly name: "GeneralPoolNotRegistered";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
}];
export declare const staticsPositionErrorAbi: readonly [{
    readonly name: "OnlyDiamondSelf";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "IncorrectPositionCreationFee";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "provided";
    }];
}, {
    readonly name: "PositionCreationFeeTransferFailed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "treasury";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "PositionInitializing";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "PositionHasActiveLegs";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "activeLegCount";
    }];
}, {
    readonly name: "PositionHasUnresolvedObligations";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "unresolvedObligationCount";
    }];
}, {
    readonly name: "PositionLocked";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "AlreadyInitialized";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NotInitialized";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NotPositionOwnerOrApproved";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "InvalidModuleAuthority";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidModuleType";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "PositionLegAlreadyActive";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
    }];
}, {
    readonly name: "PositionLegNotActive";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
    }];
}, {
    readonly name: "NoUnresolvedPositionObligation";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "ERC721InvalidOwner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
}, {
    readonly name: "ERC721NonexistentToken";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
}, {
    readonly name: "ERC721IncorrectOwner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "sender";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }];
}, {
    readonly name: "ERC721InvalidSender";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "sender";
    }];
}, {
    readonly name: "ERC721InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "ERC721InsufficientApproval";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
}, {
    readonly name: "ERC721InvalidApprover";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "approver";
    }];
}, {
    readonly name: "ERC721InvalidOperator";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
    }];
}];
export declare const staticsCollateralErrorAbi: readonly [{
    readonly name: "BasketNotFound";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
}, {
    readonly name: "BasketNotActive";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }];
}, {
    readonly name: "InvalidShares";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InsufficientTransferReceived";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "InsufficientPositionShares";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "PositionSharesLocked";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "unlocked";
    }];
}, {
    readonly name: "InsufficientLockedShares";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "locked";
    }];
}];
export declare const staticsLendingErrorAbi: readonly [{
    readonly name: "BasketNotFound";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }];
}, {
    readonly name: "LoanNotFound";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }];
}, {
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidShares";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "ZeroPrincipal";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "ActionPaused";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "action";
    }];
}, {
    readonly name: "InsufficientVaultBalance";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "LoanExpired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }, {
        readonly type: "uint40";
        readonly name: "maturity";
    }];
}, {
    readonly name: "LoanNotRecoverable";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }, {
        readonly type: "uint256";
        readonly name: "recoverableAt";
    }];
}, {
    readonly name: "MaturityOverflow";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InsufficientTransferReceived";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "InvalidExtensionInputLength";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "provided";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }];
}];
export declare const staticsRewardsErrorAbi: readonly [{
    readonly name: "InvalidAmount";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidAmountsLength";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidRewardAssets";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InsufficientStake";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "IncompatibleStakingToken";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "MinimumOutputNotMet";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "NoRewards";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "OnlySwapFeeHook";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "expected";
    }];
}, {
    readonly name: "IncompatibleRewardAsset";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "InvalidStakingToken";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidRewardAsset";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "RewardAssetAlreadyOptedIn";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "RewardAssetNotOptedIn";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "RewardAssetLimitExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "InvalidMaturitySchedule";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint40";
        readonly name: "eligibleAt";
    }];
}];
export declare const staticsGenesisErrorAbi: readonly [{
    readonly name: "GenesisIntegrationNotReady";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NotAssetOwner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }];
}, {
    readonly name: "GenesisAlreadyLinked";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "PositionAlreadyLinked";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
}, {
    readonly name: "GenesisLinkMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
}, {
    readonly name: "LinkedOwnerMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "genesisOwner";
    }, {
        readonly type: "address";
        readonly name: "positionOwner";
    }];
}, {
    readonly name: "GenesisAlreadyRegistered";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
}, {
    readonly name: "GenesisHeldByVault";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
}, {
    readonly name: "NotGenesisOwner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }];
}, {
    readonly name: "InvalidRewardAsset";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "NoRewards";
    readonly type: "error";
    readonly inputs: readonly [];
}];
export declare const staticsProtocolRevenueErrorAbi: readonly [{
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NoCreatorRevenue";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "creator";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
}, {
    readonly name: "OnlyPoolCreator";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "creator";
    }];
}, {
    readonly name: "OnlySwapFeeHook";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "expected";
    }];
}, {
    readonly name: "GeneralPoolBasketReward";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "MinimumOutputNotMet";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "actual";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "IncompatibleRevenueAsset";
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
    readonly name: "InvalidPartnerTip";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "tipBps";
    }];
}, {
    readonly name: "InvalidPartnerRecipient";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
    }];
}];
export declare const staticsTokenErrorAbi: readonly [{
    readonly name: "ERC20InsufficientBalance";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "sender";
    }, {
        readonly type: "uint256";
        readonly name: "balance";
    }, {
        readonly type: "uint256";
        readonly name: "needed";
    }];
}, {
    readonly name: "ERC20InvalidSender";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "sender";
    }];
}, {
    readonly name: "ERC20InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "ERC20InsufficientAllowance";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "allowance";
    }, {
        readonly type: "uint256";
        readonly name: "needed";
    }];
}, {
    readonly name: "ERC20InvalidApprover";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "approver";
    }];
}, {
    readonly name: "ERC20InvalidSpender";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }];
}];
export declare const staticsDollarRiskTokenAbi: readonly [{
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "uint256";
        readonly name: "id";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "isApprovedForAll";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "address";
        readonly name: "operator";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "setApprovalForAll";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
    }, {
        readonly type: "bool";
        readonly name: "approved";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "coreTokenKind";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "pool";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "transfersFrozen";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "freezeTransfers";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "ApprovalForAll";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "operator";
        readonly indexed: true;
    }, {
        readonly type: "bool";
        readonly name: "approved";
    }];
}, {
    readonly name: "TransferSingle";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "operator";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "id";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }];
}, {
    readonly name: "SeriesTransfersFrozen";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }];
}, {
    readonly name: "NotPool";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "FrozenSeriesTransfer";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}];
export declare const wethAbi: readonly [{
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "allowance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "spender";
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "deposit";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
}, {
    readonly name: "withdraw";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}];
export declare const staticsDollarCoreAbi: readonly [{
    readonly name: "staticsDollar";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "staticsDollarRisk";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "periphery";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "positionNFT";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "bootstrapFinalized";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "seniorLiabilities";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "globalImpairmentLatched";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "collateralProfile";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "uint8";
            readonly name: "decimals";
        }, {
            readonly type: "uint16";
            readonly name: "collateralRatioBps";
        }, {
            readonly type: "uint16";
            readonly name: "priceBandBps";
        }, {
            readonly type: "uint16";
            readonly name: "mintFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "redemptionFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "insuranceTargetBps";
        }, {
            readonly type: "uint16";
            readonly name: "insuranceFeeBps";
        }, {
            readonly type: "uint8";
            readonly name: "kind";
        }, {
            readonly type: "uint8";
            readonly name: "mode";
        }, {
            readonly type: "uint256";
            readonly name: "pegMinPriceWad";
        }, {
            readonly type: "uint256";
            readonly name: "pegMaxPriceWad";
        }, {
            readonly type: "uint256";
            readonly name: "activeSeriesId";
        }, {
            readonly type: "uint256";
            readonly name: "accountedCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "insuranceReserve";
        }, {
            readonly type: "uint256";
            readonly name: "seniorOutstanding";
        }, {
            readonly type: "uint256";
            readonly name: "debtCeiling";
        }];
        readonly name: "profile";
    }];
}, {
    readonly name: "riskSeries";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "profileId";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "uint256";
            readonly name: "seniorOutstanding";
        }, {
            readonly type: "uint256";
            readonly name: "riskSharesOutstanding";
        }, {
            readonly type: "uint256";
            readonly name: "accountedCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "startPriceWad";
        }, {
            readonly type: "uint256";
            readonly name: "collateralPerPairWad";
        }, {
            readonly type: "uint256";
            readonly name: "seniorCollateralPerUnitWad";
        }, {
            readonly type: "uint256";
            readonly name: "juniorCollateralPerUnitWad";
        }, {
            readonly type: "uint256";
            readonly name: "collateralRatioBps";
        }, {
            readonly type: "uint256";
            readonly name: "priceBandBps";
        }, {
            readonly type: "uint256";
            readonly name: "startedAt";
        }, {
            readonly type: "uint256";
            readonly name: "retiredAt";
        }, {
            readonly type: "uint256";
            readonly name: "successorSeriesId";
        }, {
            readonly type: "uint8";
            readonly name: "status";
        }];
        readonly name: "series";
    }];
}, {
    readonly name: "previewDeposit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "profileId";
        }, {
            readonly type: "uint256";
            readonly name: "seriesId";
        }, {
            readonly type: "uint256";
            readonly name: "collateralIn";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarMinted";
        }, {
            readonly type: "uint256";
            readonly name: "sharesMinted";
        }, {
            readonly type: "uint256";
            readonly name: "feeAmount";
        }, {
            readonly type: "uint256";
            readonly name: "insuranceContribution";
        }, {
            readonly type: "uint256";
            readonly name: "priceWad";
        }, {
            readonly type: "uint256";
            readonly name: "collateralPerPairWad";
        }, {
            readonly type: "uint256";
            readonly name: "collateralRatioBpsAfter";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "previewRecombine";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "profileId";
        }, {
            readonly type: "uint256";
            readonly name: "seriesId";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarBurned";
        }, {
            readonly type: "uint256";
            readonly name: "sharesBurned";
        }, {
            readonly type: "uint256";
            readonly name: "collateralOut";
        }, {
            readonly type: "uint256";
            readonly name: "feeAmount";
        }, {
            readonly type: "uint256";
            readonly name: "priceWad";
        }, {
            readonly type: "uint256";
            readonly name: "collateralRatioBpsAfter";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "recombine";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "shareAmount";
    }, {
        readonly type: "uint256";
        readonly name: "minimumCollateralOut";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }];
}, {
    readonly name: "returnRiskShares";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "reclaimReturnedRiskShares";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "previewReturnedRiskClaim";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "oldSeriesId";
        }, {
            readonly type: "uint256";
            readonly name: "successorSeriesId";
        }, {
            readonly type: "uint256";
            readonly name: "oldShares";
        }, {
            readonly type: "uint256";
            readonly name: "juniorCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "collateralIn";
        }, {
            readonly type: "uint256";
            readonly name: "collateralOut";
        }, {
            readonly type: "uint256";
            readonly name: "successorPairs";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "claimReturnedRisk";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }, {
        readonly type: "uint256";
        readonly name: "maximumCollateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "minimumSharesOut";
    }, {
        readonly type: "uint256";
        readonly name: "minimumCollateralOut";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "successorPairs";
    }, {
        readonly type: "uint256";
        readonly name: "collateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }];
}, {
    readonly name: "previewExpiredRiskRecovery";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "oldSeriesId";
        }, {
            readonly type: "uint256";
            readonly name: "successorSeriesId";
        }, {
            readonly type: "uint256";
            readonly name: "sharesBurned";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarBurned";
        }, {
            readonly type: "uint256";
            readonly name: "seniorCollateralOut";
        }, {
            readonly type: "uint256";
            readonly name: "juniorCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "keeperBounty";
        }, {
            readonly type: "uint256";
            readonly name: "holderCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "holderPairs";
        }, {
            readonly type: "uint256";
            readonly name: "holderCollateralDust";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "recoverExpiredRisk";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }, {
        readonly type: "uint256";
        readonly name: "minimumKeeperOut";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsDollarBurned";
    }, {
        readonly type: "uint256";
        readonly name: "keeperCollateralOut";
    }, {
        readonly type: "uint256";
        readonly name: "holderPairs";
    }];
}, {
    readonly name: "profileSolvency";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "collateralValueWad";
        }, {
            readonly type: "uint256";
            readonly name: "seniorLiabilitiesWad";
        }, {
            readonly type: "uint256";
            readonly name: "seniorDeficitWad";
        }, {
            readonly type: "bool";
            readonly name: "oracleAvailable";
        }, {
            readonly type: "bool";
            readonly name: "healthy";
        }];
        readonly name: "solvency";
    }];
}, {
    readonly name: "globalImpairment";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "phase";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }, {
        readonly type: "uint256";
        readonly name: "totalSeniorDeficitWad";
    }, {
        readonly type: "uint256";
        readonly name: "recoveryAvailableAt";
    }];
}, {
    readonly name: "peggedRedemptionStatus";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }, {
        readonly type: "uint256";
        readonly name: "totalSeniorDeficitWad";
    }, {
        readonly type: "uint256";
        readonly name: "recoveryAvailableAt";
    }];
}, {
    readonly name: "profileOperationPaused";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "operation";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "paused";
    }];
}, {
    readonly name: "pausedProfileOperations";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "operations";
    }];
}, {
    readonly name: "collateralUsdPriceWad";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "priceWad";
    }];
}, {
    readonly name: "profileSeriesCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "count";
    }];
}, {
    readonly name: "profileSeriesAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "index";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "Recombined";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarBurned";
    }, {
        readonly type: "uint256";
        readonly name: "sharesBurned";
    }, {
        readonly type: "address";
        readonly name: "collateralToken";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }, {
        readonly type: "uint256";
        readonly name: "collateralRatioBpsAfter";
    }];
}, {
    readonly name: "CollateralExitDeferred";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }];
}, {
    readonly name: "RiskSharesReturned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "ReturnedRiskSharesReclaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "shares";
    }];
}, {
    readonly name: "ReturnedRiskClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldShares";
    }, {
        readonly type: "uint256";
        readonly name: "successorPairs";
    }, {
        readonly type: "uint256";
        readonly name: "collateralIn";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }];
}, {
    readonly name: "ExpiredRiskRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "keeper";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "holder";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "sharesBurned";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarBurned";
    }, {
        readonly type: "uint256";
        readonly name: "seniorCollateralOut";
    }, {
        readonly type: "uint256";
        readonly name: "keeperBounty";
    }, {
        readonly type: "uint256";
        readonly name: "holderPairs";
    }, {
        readonly type: "uint256";
        readonly name: "holderCollateralDust";
    }];
}, {
    readonly name: "SeriesClosed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }];
}];
/**
 * Periphery diamond: consumable Risk Share liquidity and the Dollar-only exit
 * it backs.
 *
 * These live at a different address from the core pool. Read it from
 * `staticsDollarCoreAbi`'s `periphery()` rather than configuring it separately,
 * so the two can never disagree about which periphery is in use.
 *
 * The pairing vault is the reason `recombineManaged` is restricted to the
 * periphery: it burns a redeemer's Dollar against Risk Shares supplied through
 * a PositionNFT, which lets a holder exit without sourcing the junior tranche.
 * Ordinary `recombine` still requires both legs.
 */
export declare const staticsDollarPeripheryAbi: readonly [{
    readonly name: "createAndStakeRiskShares";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "stakeRiskShares";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "unstakeRiskShares";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "principalOut";
    }];
}, {
    readonly name: "claimRiskProceeds";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }];
}, {
    readonly name: "fundRiskCollateralIncentives";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "fundRiskDollarIncentives";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "fundRiskStaticsIncentives";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "riskIncentives";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "staticsToken";
        }, {
            readonly type: "uint256";
            readonly name: "collateralReserve";
        }, {
            readonly type: "uint256";
            readonly name: "staticsDollarReserve";
        }, {
            readonly type: "uint256";
            readonly name: "staticsReserve";
        }, {
            readonly type: "uint256";
            readonly name: "destinationSeriesId";
        }, {
            readonly type: "bool";
            readonly name: "routedGlobal";
        }, {
            readonly type: "bool";
            readonly name: "finalized";
        }];
        readonly name: "view_";
    }];
}, {
    readonly name: "finalizeRiskIncentives";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "destinationSeriesId";
    }, {
        readonly type: "bool";
        readonly name: "routedGlobal";
    }];
}, {
    readonly name: "processSeriesTransition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "oldSeriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "newSeriesId";
    }, {
        readonly type: "uint256";
        readonly name: "newPrincipal";
    }];
}, {
    readonly name: "settleSeriesMigration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "oldSeriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "newSeriesId";
    }, {
        readonly type: "uint256";
        readonly name: "newPrincipal";
    }];
}, {
    readonly name: "closeRiskLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "riskLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "effectiveShares";
        }, {
            readonly type: "uint256";
            readonly name: "claimableCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "claimableStaticsDollar";
        }, {
            readonly type: "uint256";
            readonly name: "claimableStatics";
        }, {
            readonly type: "uint64";
            readonly name: "epoch";
        }, {
            readonly type: "bool";
            readonly name: "exists";
        }];
        readonly name: "view_";
    }];
}, {
    readonly name: "totalRiskLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "effectiveShares";
    }];
}, {
    readonly name: "riskLiquidityScaleRay";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "scaleRay";
    }];
}, {
    readonly name: "positionSeriesCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "count";
    }];
}, {
    readonly name: "positionSeriesAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "index";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "seriesMigration";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "oldSeriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "newSeriesId";
        }, {
            readonly type: "uint256";
            readonly name: "oldPrincipal";
        }, {
            readonly type: "uint256";
            readonly name: "remainingOldPrincipal";
        }, {
            readonly type: "uint256";
            readonly name: "remainingNewPrincipal";
        }, {
            readonly type: "uint256";
            readonly name: "remainingStaticsDollar";
        }, {
            readonly type: "uint256";
            readonly name: "remainingCollateral";
        }, {
            readonly type: "bool";
            readonly name: "returned";
        }, {
            readonly type: "bool";
            readonly name: "claimed";
        }];
        readonly name: "migration";
    }];
}, {
    readonly name: "reservedBalance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "RiskSharesStaked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "supplier";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "RiskSharesUnstaked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "RiskLiquidityClosed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }];
}, {
    readonly name: "RiskLiquidityDustCleared";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "storedUnits";
    }];
}, {
    readonly name: "RiskProceedsClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "collateralToken";
    }, {
        readonly type: "address";
        readonly name: "staticsToken";
    }, {
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }];
}, {
    readonly name: "RiskProceedsAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint64";
        readonly name: "epoch";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "token";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "bytes32";
        readonly name: "source";
    }];
}, {
    readonly name: "RiskProceedsSettled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "collateralAdded";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAdded";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAdded";
    }, {
        readonly type: "uint256";
        readonly name: "accruedCollateral";
    }, {
        readonly type: "uint256";
        readonly name: "accruedStaticsDollar";
    }, {
        readonly type: "uint256";
        readonly name: "accruedStatics";
    }];
}, {
    readonly name: "RiskProceedsResidueAssigned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint64";
        readonly name: "epoch";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }];
}, {
    readonly name: "RiskIncentivesFunded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "token";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "funder";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "requestedAmount";
    }, {
        readonly type: "uint256";
        readonly name: "receivedAmount";
    }];
}, {
    readonly name: "RiskIncentivesReleased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint64";
        readonly name: "epoch";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "riskSharesConsumed";
    }, {
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }];
}, {
    readonly name: "RiskIncentivesRolledOver";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "destinationSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }];
}, {
    readonly name: "RiskIncentivesRoutedGlobal";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "collateralAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsAmount";
    }];
}, {
    readonly name: "SeriesTransitionProcessed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "oldSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "newSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldPrincipal";
    }, {
        readonly type: "uint256";
        readonly name: "newPrincipal";
    }, {
        readonly type: "bool";
        readonly name: "returnedDuringWindow";
    }];
}, {
    readonly name: "PositionMigrationSettled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "newSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldPrincipal";
    }, {
        readonly type: "uint256";
        readonly name: "newPrincipal";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarCredit";
    }, {
        readonly type: "uint256";
        readonly name: "collateralCredit";
    }];
}, {
    readonly name: "MigrationRoundingWrittenOff";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "oldSeriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "nominalPrincipal";
    }, {
        readonly type: "uint256";
        readonly name: "settledPrincipal";
    }];
}, {
    readonly name: "redeem";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "minStaticsDollarRedeemed";
    }, {
        readonly type: "uint256";
        readonly name: "minCollateralPerStaticsDollarWad";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarRedeemed";
    }, {
        readonly type: "uint256";
        readonly name: "collateralOut";
    }];
}, {
    readonly name: "redeemToETH";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }, {
        readonly type: "uint256";
        readonly name: "minStaticsDollarRedeemed";
    }, {
        readonly type: "uint256";
        readonly name: "minCollateralPerStaticsDollarWad";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarRedeemed";
    }, {
        readonly type: "uint256";
        readonly name: "ethOut";
    }];
}, {
    readonly name: "previewRedeem";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "staticsDollarRedeemed";
        }, {
            readonly type: "uint256";
            readonly name: "grossCollateral";
        }, {
            readonly type: "uint256";
            readonly name: "collateralToRedeemer";
        }, {
            readonly type: "uint256";
            readonly name: "collateralToRiskSuppliers";
        }, {
            readonly type: "uint256";
            readonly name: "collateralToInsurance";
        }, {
            readonly type: "uint256";
            readonly name: "seniorCollateralPerUnitWad";
        }];
        readonly name: "preview";
    }];
}, {
    readonly name: "redeemableLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsDollarAmount";
    }];
}, {
    readonly name: "redemptionParams";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
        readonly name: "redemptionFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "supplierShareBps";
    }];
}, {
    readonly name: "setRedemptionParams";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "redemptionFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "supplierShareBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "Redeemed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "staticsDollarRedeemed";
    }, {
        readonly type: "uint256";
        readonly name: "collateralToRedeemer";
    }, {
        readonly type: "uint256";
        readonly name: "collateralToRiskSuppliers";
    }, {
        readonly type: "uint256";
        readonly name: "collateralToInsurance";
    }];
}, {
    readonly name: "RedemptionDeferred";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
        readonly indexed: true;
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }];
}, {
    readonly name: "RedemptionParamsSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "redemptionFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "supplierShareBps";
    }];
}, {
    readonly name: "CustodyReserved";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "account";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "token";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}];
/**
 * Reverts unique to the periphery facets above.
 *
 * Shared names -- ZeroAmount, ZeroAddress, SeriesNotActive,
 * ProfileOperationPaused, InsufficientTransferReceived, UnexpectedExitStatus,
 * NativeTransferFailed -- are already in `staticsDollarErrorAbi` with identical
 * signatures and are deliberately not repeated, because a duplicate selector in
 * one array makes the decode ambiguous. Decode against both.
 */
export declare const staticsDollarPeripheryErrorAbi: readonly [{
    readonly name: "NotPositionOwnerOrApproved";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "UnknownRiskLiquidity";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "InsufficientRiskLiquidity";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "NoRiskProceeds";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "SeriesNotIncentiveEligible";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "SeriesIncentivesNotFinalizable";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "RiskLiquidityHasValue";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "RiskLiquidityAmountTooSmall";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }];
}, {
    readonly name: "NoRiskLiquidity";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "FillBelowMinimum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "fill";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "RateBelowMinimum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "rateWad";
    }, {
        readonly type: "uint256";
        readonly name: "minimumRateWad";
    }];
}, {
    readonly name: "InvalidRedemptionParams";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "feeBps";
    }, {
        readonly type: "uint16";
        readonly name: "supplierShareBps";
    }];
}, {
    readonly name: "SeriesTransitionPending";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "NotWETHCollateral";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "DeadlineExpired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "deadline";
    }, {
        readonly type: "uint256";
        readonly name: "currentTimestamp";
    }];
}, {
    readonly name: "FixedAllocationExceedsGross";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "fixedSeniorCollateral";
    }, {
        readonly type: "uint256";
        readonly name: "grossCollateral";
    }];
}, {
    readonly name: "RiskLiquidityScaleExhausted";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "storedUnits";
    }];
}, {
    readonly name: "ConsumeExceedsLiquidity";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "InvalidEpochSettlement";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint64";
        readonly name: "epoch";
    }, {
        readonly type: "uint256";
        readonly name: "stored";
    }, {
        readonly type: "uint256";
        readonly name: "remainingStored";
    }];
}, {
    readonly name: "InsufficientUnreserved";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "requested";
    }, {
        readonly type: "uint256";
        readonly name: "available";
    }];
}, {
    readonly name: "GlobalReservationShortfall";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "reserved";
    }, {
        readonly type: "uint256";
        readonly name: "balance";
    }];
}, {
    readonly name: "InvalidTransferReceiver";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "DebitBelowRequested";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "spent";
    }, {
        readonly type: "uint256";
        readonly name: "requested";
    }];
}, {
    readonly name: "DebitExceedsAuthorization";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "spent";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "BalanceDecreasedDuringPull";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "beforeBalance";
    }, {
        readonly type: "uint256";
        readonly name: "afterBalance";
    }];
}, {
    readonly name: "SeriesMigrationNotReady";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "SeriesMigrationAlreadyProcessed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "SeriesMigrationReclaimPending";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "UnexpectedRiskIngress";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "address";
        readonly name: "operator";
    }, {
        readonly type: "address";
        readonly name: "from";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "RiskBatchIngressUnsupported";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NotContractOwner";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }, {
        readonly type: "address";
        readonly name: "owner";
    }];
}, {
    readonly name: "SafeERC20FailedOperation";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }];
}, {
    readonly name: "ReentrancyGuardReentrantCall";
    readonly type: "error";
    readonly inputs: readonly [];
}];
export declare const staticsDollarErrorAbi: readonly [{
    readonly name: "ZeroAddress";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "ZeroAmount";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "InvalidShareAmount";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "provided";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }];
}, {
    readonly name: "InvalidProfile";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }];
}, {
    readonly name: "InvalidSeries";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "InvalidSeriesGeometry";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "priceWad";
    }, {
        readonly type: "uint256";
        readonly name: "collateralRatioBps";
    }];
}, {
    readonly name: "InvalidProfileKind";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint8";
        readonly name: "expected";
    }, {
        readonly type: "uint8";
        readonly name: "actual";
    }];
}, {
    readonly name: "InvalidProfileMode";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint8";
        readonly name: "mode";
    }];
}, {
    readonly name: "ProfileOperationPaused";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "operation";
    }];
}, {
    readonly name: "ProfileImpaired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "seniorDeficitWad";
    }];
}, {
    readonly name: "OutputBelowMinimum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "actual";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "SharesAboveMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "CollateralAboveMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
    }];
}, {
    readonly name: "DepositTooSmall";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "RedemptionTooSmall";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "DebtCeilingExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "attemptedSeniorOutstanding";
    }, {
        readonly type: "uint256";
        readonly name: "debtCeiling";
    }];
}, {
    readonly name: "SeriesNotActive";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "EmptyPool";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "SeriesNotPending";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "ReturnWindowClosed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "NoReturnedShares";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "address";
        readonly name: "holder";
    }];
}, {
    readonly name: "SeriesNotRecoverable";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }];
}, {
    readonly name: "SlippageExceeded";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "actual";
    }, {
        readonly type: "uint256";
        readonly name: "minimum";
    }];
}, {
    readonly name: "InvalidRecoveryMode";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "mode";
    }];
}, {
    readonly name: "TransitionRequired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint256";
        readonly name: "currentPriceWad";
    }];
}, {
    readonly name: "CollateralExitUnavailable";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }, {
        readonly type: "uint256";
        readonly name: "unhealthyProfileBitmap";
    }];
}, {
    readonly name: "CollateralExitWorsensHealth";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "profileId";
    }, {
        readonly type: "uint8";
        readonly name: "projectedPhase";
    }, {
        readonly type: "uint256";
        readonly name: "baselineDeficitWad";
    }, {
        readonly type: "uint256";
        readonly name: "projectedDeficitWad";
    }];
}, {
    readonly name: "UnexpectedCollateralProfile";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "expectedProfileId";
    }, {
        readonly type: "uint256";
        readonly name: "actualProfileId";
    }];
}, {
    readonly name: "InsufficientTransferReceived";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "UnexpectedOutputAmount";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "expected";
    }, {
        readonly type: "uint256";
        readonly name: "observed";
    }];
}, {
    readonly name: "SeriesUnavailableForOrdinaryRecombination";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "seriesId";
    }, {
        readonly type: "uint8";
        readonly name: "status";
    }];
}, {
    readonly name: "UnexpectedExitStatus";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "status";
    }];
}, {
    readonly name: "UnexpectedRiskIngressState";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NativeTransferFailed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "Unauthorized";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "PartialRecoveryNotAllowed";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "holder";
    }, {
        readonly type: "uint256";
        readonly name: "provided";
    }, {
        readonly type: "uint256";
        readonly name: "fullBalance";
    }];
}];
export declare function buildBuyGenesisTransaction(tokenId: bigint, receiver: Address, maxNativeValue: bigint): PreparedTransaction;
export declare function buildDonateGenesisReserveTransaction(nativeAmount: bigint): PreparedTransaction;
export declare function buildRedeemGenesisCall(tokenId: bigint, receiver: Address): Hex;
export declare function buildReleaseTreasuryStaticsCall(beneficiary: Address): Hex;
export declare function buildSweepTreasuryStaticsSurplusCall(): Hex;
export declare function buildReleaseTreasuryGenesisCall(maxCount: bigint): Hex;
export declare function buildSetTreasuryWithdrawalRecipientCall(newRecipient: Address): Hex;
export declare function buildActivateGenesisCall(genesisId: bigint, targetTier: number): Hex;
export declare function buildRegisterGenesisCall(genesisId: bigint): Hex;
export declare function buildClaimGenesisLaunchRewardsCall(genesisId: bigint, asset: Address, receiver: Address): Hex;
export declare function buildClaimOwnerGenesisLaunchRewardsCall(asset: Address, receiver: Address): Hex;
export declare function buildClaimAllGenesisLaunchRewardsCall(genesisIds: readonly bigint[], receiver: Address): Hex;
export declare function buildClaimAllGenesisLaunchTreasuryRewardsCall(receiver: Address): Hex;
export declare function buildAccrueGenesisLaunchRewardsCall(): Hex;
export declare function buildRegisterGenesisRewardsCall(genesisId: bigint): Hex;
export declare function buildAccrueGenesisRewardsCall(): Hex;
export declare function buildClaimGenesisRewardsCall(genesisId: bigint, asset: Address, receiver: Address): Hex;
export declare function buildClaimGenesisOwnerRewardsCall(asset: Address, receiver: Address): Hex;
export declare function buildClaimGenesisTreasuryRewardsCall(asset: Address, receiver: Address): Hex;
export declare function buildClaimAllGenesisRewardsCall(genesisIds: readonly bigint[], receiver: Address): Hex;
export declare function buildClaimAllGenesisTreasuryRewardsCall(receiver: Address): Hex;
export declare function buildSetGenesisRewardShareBpsCall(newShareBps: number): Hex;
export declare function cumulativeGenesisActivationCost(tierCosts: readonly bigint[], currentTier: number, targetTier: number): bigint;
export declare function buildCreateBasketTransaction(params: CreateBasketParams, pools: readonly PoolLaunchParams[], maxAmountsIn: readonly bigint[], launchDeadline: bigint, creationFee: bigint): PreparedTransaction;
export declare function buildTestnetFaucetClaimCall(): Hex;
export declare function buildApproveV4PositionCall(operator: Address, tokenId: bigint): Hex;
export declare function buildPermit2ApproveCall(token: Address, spender: Address, amount: bigint, expiration: number): Hex;
export declare function buildPermit2PermitTypedData(chainId: number, permit2: Address, permitSingle: Permit2PermitSingle): {
    readonly domain: {
        readonly name: "Permit2";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly PermitDetails: readonly [{
            readonly name: "token";
            readonly type: "address";
        }, {
            readonly name: "amount";
            readonly type: "uint160";
        }, {
            readonly name: "expiration";
            readonly type: "uint48";
        }, {
            readonly name: "nonce";
            readonly type: "uint48";
        }];
        readonly PermitSingle: readonly [{
            readonly name: "details";
            readonly type: "PermitDetails";
        }, {
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly name: "sigDeadline";
            readonly type: "uint256";
        }];
    };
    readonly primaryType: "PermitSingle";
    readonly message: Permit2PermitSingle;
};
export declare function buildErc20PermitTypedData(params: Erc20PermitTypedDataParams): {
    readonly domain: {
        readonly name: string;
        readonly version: "1";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly Permit: readonly [{
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly name: "value";
            readonly type: "uint256";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }, {
            readonly name: "deadline";
            readonly type: "uint256";
        }];
    };
    readonly primaryType: "Permit";
    readonly message: {
        readonly owner: `0x${string}`;
        readonly spender: `0x${string}`;
        readonly value: bigint;
        readonly nonce: bigint;
        readonly deadline: bigint;
    };
};
export declare function buildQuoteV4ExactInputSingleCall(poolKey: V4PoolKey, zeroForOne: boolean, exactAmount: bigint, hookData?: Hex): Hex;
export declare function v4PoolId(poolKey: V4PoolKey): Hex;
export declare function buildV4ExactInputSingleSwap(request: V4ExactInputSingleRequest): SwapExecution;
export declare function buildMintV4PositionCall(request: V4MintPositionRequest): Hex;
export declare function buildMintCall(basketId: bigint, shares: bigint, receiver: Address, maxAmountsIn: readonly bigint[]): Hex;
export declare function buildRedeemCall(basketId: bigint, shares: bigint, receiver: Address, minAmountsOut: readonly bigint[]): Hex;
export declare function buildCreateAndDepositBasketCollateralCall(basketId: bigint, shares: bigint, receiver: Address): Hex;
export declare function buildDepositBasketCollateralCall(positionId: bigint, basketId: bigint, shares: bigint): Hex;
export declare function buildWithdrawBasketCollateralCall(positionId: bigint, basketId: bigint, shares: bigint, receiver: Address): Hex;
export declare function buildCreateAndMintBasketCollateralCall(basketId: bigint, shares: bigint, receiver: Address, maxAmountsIn: readonly bigint[]): Hex;
export declare function buildMintBasketCollateralCall(positionId: bigint, basketId: bigint, shares: bigint, maxAmountsIn: readonly bigint[]): Hex;
export declare function buildRedeemBasketCollateralCall(positionId: bigint, basketId: bigint, shares: bigint, receiver: Address, minAmountsOut: readonly bigint[]): Hex;
export declare function buildClaimRewardsCall(positionId: bigint, assets: readonly Address[], receiver: Address, minAmountsOut: readonly bigint[]): Hex;
export declare function buildClaimBasketRewardsCall(positionId: bigint, basketId: bigint, receiver: Address): Hex;
export declare function buildCreateAndStakeCall(amount: bigint, receiver: Address, rewardAssets: readonly Address[]): Hex;
export declare function buildOptInRewardAssetsCall(positionId: bigint, assets: readonly Address[]): Hex;
export declare function buildOptOutRewardAssetsCall(positionId: bigint, assets: readonly Address[]): Hex;
export declare function buildStakeCall(positionId: bigint, amount: bigint): Hex;
export declare function buildUnstakeCall(positionId: bigint, amount: bigint, receiver: Address): Hex;
export declare function buildCheckpointRewardAssetsCall(assets: readonly Address[]): Hex;
export declare function buildSettlePublicSwapRewardsCall(asset: Address, maximumAmount: bigint): Hex;
export declare function buildLinkGenesisCall(positionId: bigint, genesisId: bigint): Hex;
export declare function buildUnlinkGenesisCall(positionId: bigint, genesisId: bigint): Hex;
export declare function buildDeployMorphoCollateralCall(positionId: bigint, marketId: Hex, assets: bigint): Hex;
export declare function buildRecallMorphoCollateralCall(positionId: bigint, marketId: Hex, assets: bigint): Hex;
export declare function buildWithdrawUntrackedMorphoCollateralCall(positionId: bigint, marketId: Hex, assets: bigint, receiver: Address): Hex;
export declare function buildBorrowMorphoUsdCall(positionId: bigint, marketId: Hex, assets: bigint, maxBorrowShares: bigint, receiver: Address): Hex;
export declare function buildRepayMorphoUsdCall(positionId: bigint, marketId: Hex, assets: bigint, shares: bigint, maxAssets: bigint): Hex;
export declare function buildSyncMorphoCall(positionId: bigint, marketId: Hex): Hex;
export declare function buildClaimMorphoSyncBountiesCall(assets: readonly Address[], receiver: Address): Hex;
/**
 * Builds PositionNFT-authorized recovery of a raw ERC-20 balance held directly
 * by its StaticsMorphoAccount. This does not recall collateral supplied to Morpho.
 */
export declare function buildRecoverMorphoAccountTokenCall(positionId: bigint, token: Address, amount: bigint, receiver: Address, minReceived: bigint): Hex;
export declare function buildMorphoSupplyCall(marketParams: MorphoMarketParams, assets: bigint, shares: bigint, onBehalf: Address): Hex;
export declare function buildMorphoWithdrawCall(marketParams: MorphoMarketParams, assets: bigint, shares: bigint, onBehalf: Address, receiver: Address): Hex;
export declare function buildDistributePartnerRevenueCall(recipient: Address, asset: Address): Hex;
export declare function buildBorrowCall(positionId: bigint, basketId: bigint, sharesIn: bigint, receiver: Address): Hex;
export declare function buildRepayCall(loanId: bigint): Hex;
export declare function buildExtendCall(loanId: bigint, grossAmountsIn: readonly bigint[]): Hex;
export declare function buildRecoverCall(loanId: bigint): Hex;
export declare function buildFlashLoanCall(basketId: bigint, shares: bigint, receiver: Address, data: Hex): Hex;
export declare function buildQuoteFlashLoanCall(basketId: bigint, shares: bigint): Hex;
export declare function buildFlashLoanAssetCall(asset: Address, amount: bigint, receiver: Address, data: Hex): Hex;
export declare function buildQuoteFlashLoanAssetCall(asset: Address, amount: bigint): Hex;
export declare function buildMaxFlashLoanCall(asset: Address): Hex;
export declare function buildSetSingleAssetFlashFeeBpsCall(newFeeBps: number): Hex;
export declare function buildCreatePositionCall(receiver: Address): Hex;
export declare function buildSetPositionCreationFeeCall(amount: bigint): Hex;
export declare function buildClosePositionCall(positionId: bigint): Hex;
export declare function buildQuarantineBasketCall(basketId: bigint): Hex;
export declare function buildReleaseBasketQuarantineCall(basketId: bigint): Hex;
export declare function buildDecommissionBasketCall(basketId: bigint): Hex;
export declare const MIN_SQRT_PRICE = 4295128739n;
export declare const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;
export declare const MAX_STATIC_LP_FEE_PIPS = 999999;
export declare const MIN_TICK_SPACING = 1;
export declare const MAX_TICK_SPACING = 32767;
export declare const MAX_COMBINED_FEE_BPS = 200n;
export declare const CONFIGURABLE_SHARE_BPS = 9500n;
export declare const CREATOR_SHARE_BPS = 500n;
export declare const MAX_REVENUE_MAINTENANCE_TIP_BPS = 2000n;
export declare const PROTOCOL_POOLS_DOMAIN_NAME = "Statics Protocol Pools";
export declare const PROTOCOL_POOLS_DOMAIN_VERSION = "4";
export declare const PERMISSIONED_POOLS_DOMAIN_NAME = "Statics Permissioned Pools";
export declare const PERMISSIONED_POOLS_DOMAIN_VERSION = "1";
export declare const DEFAULT_PERMISSIONED_CREATOR_SHARE_BPS = 8000n;
export declare const DEFAULT_PERMISSIONED_TREASURY_SHARE_BPS = 1000n;
export declare const DEFAULT_PERMISSIONED_STATICS_STAKER_SHARE_BPS = 1000n;
export declare function sortPoolCurrencies(tokenA: Address, tokenB: Address): {
    currency0: Address;
    currency1: Address;
    tokenAIsCurrency0: boolean;
};
export declare function normalizeSqrtPriceBPerAX96(tokenA: Address, tokenB: Address, sqrtPriceBPerAX96: bigint): bigint;
export declare function buildProtocolPoolKey(tokenA: Address, tokenB: Address, tickSpacing: number, hook: Address, lpFee: number): V4PoolKey;
export declare function computePoolId(key: V4PoolKey): Hex;
export declare function defaultPermissionedGeneralEconomics(venueFeeBps: bigint, additionalRewardRestrictedMask?: number): PermissionedPoolEconomics;
export declare function computePermissionedEconomicsHash(economics: PermissionedPoolEconomics): Hex;
export declare function buildPermissionedPoolCreationTypedData(chainId: number, diamond: Address, message: {
    poolId: Hex;
    sqrtPriceX96: bigint;
    creator: Address;
    controller: Address;
    economicsHash: Hex;
    authorizationNonce: bigint;
    deadline: bigint;
    agreementHash: Hex;
}): {
    readonly domain: {
        readonly name: "Statics Permissioned Pools";
        readonly version: "1";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly CreatePermissionedPool: readonly [{
            readonly name: "poolId";
            readonly type: "bytes32";
        }, {
            readonly name: "sqrtPriceX96";
            readonly type: "uint160";
        }, {
            readonly name: "creator";
            readonly type: "address";
        }, {
            readonly name: "controller";
            readonly type: "address";
        }, {
            readonly name: "economicsHash";
            readonly type: "bytes32";
        }, {
            readonly name: "authorizationNonce";
            readonly type: "uint256";
        }, {
            readonly name: "deadline";
            readonly type: "uint256";
        }, {
            readonly name: "agreementHash";
            readonly type: "bytes32";
        }];
    };
    readonly primaryType: "CreatePermissionedPool";
    readonly message: {
        readonly authorizationNonce: bigint;
        readonly deadline: bigint;
        readonly poolId: Hex;
        readonly sqrtPriceX96: bigint;
        readonly creator: Address;
        readonly controller: Address;
        readonly economicsHash: Hex;
        readonly agreementHash: Hex;
    };
};
export declare function computePermissionedPoolCreationDigest(chainId: number, diamond: Address, message: {
    poolId: Hex;
    sqrtPriceX96: bigint;
    creator: Address;
    controller: Address;
    economicsHash: Hex;
    authorizationNonce: bigint;
    deadline: bigint;
    agreementHash: Hex;
}): Hex;
export declare function quotePermissionedProtocolPool(chainId: number, diamond: Address, permissionedHook: Address, params: CreatePermissionedPoolParams): PermissionedPoolQuote;
export declare function buildPermissionedPoolTermsTypedData(chainId: number, diamond: Address, message: {
    poolId: Hex;
    economicsHash: Hex;
    nonce: bigint;
    deadline: bigint;
    agreementHash: Hex;
}): {
    readonly domain: {
        readonly name: "Statics Permissioned Pools";
        readonly version: "1";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly PermissionedPoolTerms: readonly [{
            readonly name: "poolId";
            readonly type: "bytes32";
        }, {
            readonly name: "economicsHash";
            readonly type: "bytes32";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }, {
            readonly name: "deadline";
            readonly type: "uint256";
        }, {
            readonly name: "agreementHash";
            readonly type: "bytes32";
        }];
    };
    readonly primaryType: "PermissionedPoolTerms";
    readonly message: {
        readonly nonce: bigint;
        readonly deadline: bigint;
        readonly poolId: Hex;
        readonly economicsHash: Hex;
        readonly agreementHash: Hex;
    };
};
export declare function computePermissionedPoolTermsDigest(chainId: number, diamond: Address, message: {
    poolId: Hex;
    economicsHash: Hex;
    nonce: bigint;
    deadline: bigint;
    agreementHash: Hex;
}): Hex;
export declare function buildPermissionedControllerReplacementTypedData(chainId: number, diamond: Address, message: PermissionedControllerReplacement): {
    readonly domain: {
        readonly name: "Statics Permissioned Pools";
        readonly version: "1";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly PermissionedPoolControllerReplacement: readonly [{
            readonly name: "poolId";
            readonly type: "bytes32";
        }, {
            readonly name: "currentController";
            readonly type: "address";
        }, {
            readonly name: "newController";
            readonly type: "address";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }, {
            readonly name: "deadline";
            readonly type: "uint256";
        }, {
            readonly name: "agreementHash";
            readonly type: "bytes32";
        }];
    };
    readonly primaryType: "PermissionedPoolControllerReplacement";
    readonly message: {
        readonly nonce: bigint;
        readonly deadline: bigint;
        readonly poolId: Hex;
        readonly currentController: Address;
        readonly newController: Address;
        readonly agreementHash: Hex;
    };
};
export declare function computePermissionedControllerReplacementDigest(chainId: number, diamond: Address, message: PermissionedControllerReplacement): Hex;
export declare function buildCreatePoolAuthorizationTypedData(chainId: number, diamond: Address, message: {
    poolId: Hex;
    sqrtPriceX96: bigint;
    inputFeeBps: bigint;
    outputFeeBps: bigint;
    creator: Address;
    activateManagedPol: boolean;
    nonce: bigint;
    deadline: bigint;
}): {
    readonly domain: {
        readonly name: "Statics Protocol Pools";
        readonly version: "4";
        readonly chainId: number;
        readonly verifyingContract: `0x${string}`;
    };
    readonly types: {
        readonly CreatePool: readonly [{
            readonly name: "poolId";
            readonly type: "bytes32";
        }, {
            readonly name: "sqrtPriceX96";
            readonly type: "uint160";
        }, {
            readonly name: "inputFeeBps";
            readonly type: "uint16";
        }, {
            readonly name: "outputFeeBps";
            readonly type: "uint16";
        }, {
            readonly name: "creator";
            readonly type: "address";
        }, {
            readonly name: "activateManagedPol";
            readonly type: "bool";
        }, {
            readonly name: "nonce";
            readonly type: "uint256";
        }, {
            readonly name: "deadline";
            readonly type: "uint256";
        }];
    };
    readonly primaryType: "CreatePool";
    readonly message: {
        readonly poolId: `0x${string}`;
        readonly sqrtPriceX96: bigint;
        readonly inputFeeBps: number;
        readonly outputFeeBps: number;
        readonly creator: `0x${string}`;
        readonly activateManagedPol: boolean;
        readonly nonce: bigint;
        readonly deadline: bigint;
    };
};
export declare function computeCreatePoolAuthorizationDigest(chainId: number, diamond: Address, message: {
    poolId: Hex;
    sqrtPriceX96: bigint;
    inputFeeBps: bigint;
    outputFeeBps: bigint;
    creator: Address;
    activateManagedPol: boolean;
    nonce: bigint;
    deadline: bigint;
}): Hex;
export declare function quoteProtocolPool(chainId: number, diamond: Address, hook: Address, params: CreatePoolParams, creationFee?: bigint, polActivationFee?: bigint): GeneralPoolQuote;
export declare function buildQuotePoolCall(params: CreatePoolParams): Hex;
export declare function buildCreatePoolTransaction(params: CreatePoolParams, totalNativeFee: bigint, creatorAuthorization?: Hex): PreparedTransaction;
export declare function buildInvalidatePoolCreationNonceCall(nonce: bigint): Hex;
export declare function buildQuotePermissionedPoolCall(params: CreatePermissionedPoolParams): Hex;
export declare function buildCreatePermissionedPoolCall(params: CreatePermissionedPoolParams, creatorAuthorization: Hex): Hex;
export declare function buildInvalidatePermissionedAuthorizationNonceCall(nonce: bigint): Hex;
export declare function buildApplyPermissionedPoolTermsCall(poolId: Hex, economics: PermissionedPoolEconomics, nonce: bigint, deadline: bigint, agreementHash: Hex, creatorAuthorization: Hex): Hex;
export declare function buildReplacePermissionedPoolControllerCall(replacement: PermissionedControllerReplacement, creatorAuthorization: Hex): Hex;
export declare function buildInvalidatePermissionedConfigurationNonceCall(poolId: Hex, nonce: bigint): Hex;
export declare function buildDecommissionPermissionedPoolCall(poolId: Hex): Hex;
export declare function buildSetPermissionedTrustedPeripheryCall(periphery: Address, trusted: boolean): Hex;
export declare function buildAddRewardRestrictionCall(asset: Address): Hex;
export declare function buildRemoveRewardRestrictionCall(asset: Address): Hex;
export declare function buildSetPoolCreationFeeCall(amount: bigint): Hex;
export declare function buildSetProtocolPoolFeeRateCall(poolId: Hex, feeRate: PoolSwapFeeRate): Hex;
export declare function buildSetDefaultProtocolPoolFeeRateCall(feeRate: PoolSwapFeeRate): Hex;
export declare function buildClearProtocolPoolFeeRateCall(poolId: Hex): Hex;
export declare function buildSetBasketFeeAllocationCall(allocation: BasketFeeAllocation): Hex;
export declare function buildSetGeneralFeeAllocationCall(allocation: GeneralFeeAllocation): Hex;
export declare function buildBeginGeneralPoolDecommissionCall(poolId: Hex): Hex;
export declare function buildFinalizeGeneralPoolDecommissionCall(poolId: Hex): Hex;
export declare function buildSetProtocolPoolMaintenanceConfigCall(config: ProtocolPoolMaintenanceConfig): Hex;
export declare function buildSettleProtocolPoolRevenueCall(poolId: Hex, asset: Address): Hex;
export declare function buildSetProtocolPolOperatorCall(operator: Address): Hex;
export declare function buildSetProtocolPolActivationFeeCall(amount: bigint): Hex;
export declare function buildActivateProtocolPoolPolTransaction(poolId: Hex, activationFee: bigint): PreparedTransaction;
export declare function buildSetProtocolPoolPolShareCall(poolId: Hex, shareBps: bigint): Hex;
export declare function buildClearProtocolPoolPolShareCall(poolId: Hex): Hex;
export declare function buildSettleProtocolPoolPolCall(poolId: Hex, asset: Address, maximumAmount: bigint): Hex;
export declare function buildOpenProtocolPolPositionCall(params: ProtocolPolOpenParams): Hex;
export declare function buildIncreaseProtocolPolPositionCall(params: ProtocolPolLiquidityParams): Hex;
export declare function buildDecreaseProtocolPolPositionCall(params: ProtocolPolLiquidityParams): Hex;
export declare function buildCollectProtocolPolFeesCall(positionId: bigint, deadline: bigint): Hex;
export declare function buildCloseProtocolPolPositionCall(positionId: bigint, amount0Minimum: bigint, amount1Minimum: bigint, deadline: bigint): Hex;
export declare function buildClaimCreatorRevenueCall(poolId: Hex, asset: Address, receiver: Address, minReceived: bigint): Hex;
export declare function buildReplaceLiquidityManagerCall(newManager: Address): Hex;
export declare function buildUnwindBasketLiquidityCall(basketId: bigint, asset: Address): Hex;
export declare function buildBorrowAndProvideLiquidityCall(positionId: bigint, basketId: bigint, sharesIn: bigint, pools: readonly LiquidityParams[], lpRecipient: Address): Hex;
export declare function buildDollarCoreRecombineCall(seriesId: bigint, staticsDollarAmount: bigint, shareAmount: bigint, minimumCollateralOut: bigint, receiver: Address): Hex;
export declare function buildReturnRiskSharesCall(seriesId: bigint, shares: bigint): Hex;
export declare function buildReclaimReturnedRiskSharesCall(seriesId: bigint, receiver: Address): Hex;
export declare function buildPreviewReturnedRiskClaimCall(holder: Address, seriesId: bigint, mode: DollarRecoveryClaimMode): Hex;
export declare function buildClaimReturnedRiskCall(seriesId: bigint, mode: DollarRecoveryClaimMode, maximumCollateralIn: bigint, minimumSharesOut: bigint, minimumCollateralOut: bigint, receiver: Address): Hex;
export declare function buildPreviewExpiredRiskRecoveryCall(holder: Address, seriesId: bigint, shares: bigint, mode: DollarRecoveryClaimMode): Hex;
export declare function buildRecoverExpiredRiskCall(holder: Address, seriesId: bigint, shares: bigint, mode: DollarRecoveryClaimMode, minimumKeeperOut: bigint): Hex;
export declare function buildDepositETHTransaction(ethAmount: bigint, staticsDollarReceiver: Address, shareReceiver: Address, minStaticsDollar: bigint, minShares: bigint): PreparedTransaction;
export declare function buildDepositWETHCall(wethAmount: bigint, staticsDollarReceiver: Address, shareReceiver: Address, minStaticsDollar: bigint, minShares: bigint): Hex;
export declare function buildRecombineToWETHCall(seriesId: bigint, staticsDollarAmount: bigint, maxSharesIn: bigint, receiver: Address, minWETHOut: bigint): Hex;
export declare function buildRecombineToWETHWithPermitCall(seriesId: bigint, staticsDollarAmount: bigint, maxSharesIn: bigint, receiver: Address, minWETHOut: bigint, permitSignature: PermitSignature): Hex;
export declare function buildRecombineToETHCall(seriesId: bigint, staticsDollarAmount: bigint, maxSharesIn: bigint, receiver: Address, minETHOut: bigint): Hex;
export declare function buildRecombineToETHWithPermitCall(seriesId: bigint, staticsDollarAmount: bigint, maxSharesIn: bigint, receiver: Address, minETHOut: bigint, permitSignature: PermitSignature): Hex;
export declare function buildMintPeggedCall(profileId: bigint, staticsDollarAmount: bigint, maximumCollateralIn: bigint, staticsDollarReceiver: Address): Hex;
export declare function buildMintPeggedWithPermitCall(profileId: bigint, staticsDollarAmount: bigint, maximumCollateralIn: bigint, staticsDollarReceiver: Address, permitSignature: PermitSignature): Hex;
export declare function buildQuoteMintPeggedAndRecombineCall(peggedProfileId: bigint, volatileProfileId: bigint, seriesId: bigint, riskAmount: bigint): Hex;
export declare function buildMintPeggedAndRecombineCall(peggedProfileId: bigint, volatileProfileId: bigint, seriesId: bigint, riskAmount: bigint, maximumPeggedCollateralIn: bigint, minimumVolatileCollateralOut: bigint, receiver: Address): Hex;
export declare function buildMintPeggedAndRecombineWithPermitCall(peggedProfileId: bigint, volatileProfileId: bigint, seriesId: bigint, riskAmount: bigint, maximumPeggedCollateralIn: bigint, minimumVolatileCollateralOut: bigint, receiver: Address, permitSignature: PermitSignature): Hex;
export declare function buildRedeemPeggedCall(profileId: bigint, staticsDollarAmount: bigint, minimumCollateralOut: bigint, receiver: Address): Hex;
export declare function buildRedeemPeggedWithPermitCall(profileId: bigint, staticsDollarAmount: bigint, minimumCollateralOut: bigint, receiver: Address, permitSignature: PermitSignature): Hex;
export declare function buildClaimPeggedProtocolRevenueCall(profileId: bigint, amount: bigint, receiver: Address): Hex;
export type SwapExecution = {
    target: Address;
    calldata: Hex;
    value: bigint;
};
export interface UnderlyingLiquidityAdapter {
    quoteExactOutput(request: {
        tokenIn: Address;
        tokenOut: Address;
        amountOut: bigint;
    }): Promise<{
        maxAmountIn: bigint;
        execution: SwapExecution;
    }>;
    quoteExactInput(request: {
        tokenIn: Address;
        tokenOut: Address;
        amountIn: bigint;
    }): Promise<{
        minAmountOut: bigint;
        execution: SwapExecution;
    }>;
}
export type UnderlyingRoute = {
    asset: Address;
    amount: bigint;
    sourceOrDestinationAmount: bigint;
    execution?: SwapExecution;
};
export declare function planMintUnderlyingRoutes(sourceToken: Address, mintQuote: readonly MintQuoteLeg[], adapter: UnderlyingLiquidityAdapter): Promise<readonly UnderlyingRoute[]>;
export declare function planRedeemUnderlyingRoutes(destinationToken: Address, redeemQuote: readonly RedeemQuoteLeg[], adapter: UnderlyingLiquidityAdapter): Promise<readonly UnderlyingRoute[]>;
