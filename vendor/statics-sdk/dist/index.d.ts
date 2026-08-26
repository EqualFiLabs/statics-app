import { type Address, type ContractEventArgs, type Hex } from "viem";
export { robinhoodChain } from "./generated/robinhoodChain.js";
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
export declare const MIN_TICK = -887272;
export declare const MAX_TICK = 887272;
export declare const STATICS_MAX_SUPPLY: bigint;
export declare const STATICS_TREASURY_ALLOCATION: bigint;
export declare const STATICS_DOPPLER_INVENTORY: bigint;
export declare const DOPPLER_OWNER_FEE_SHARE: bigint;
export declare const STATICS_FEE_RECEIVER_SHARE: bigint;
export declare const GENESIS_COLLECTION_SIZE = 5555n;
export declare const GENESIS_VAULT_PRICE: bigint;
export declare const GENESIS_FULL_BACKING: bigint;
export declare const GENESIS_SUPPLY_RESIDUAL: bigint;
export type DopplerGenesisCurve = {
    name: "low" | "medium" | "high" | "filler";
    tickLower: number;
    tickUpper: number;
    numPositions: number;
    shareWad: bigint;
    staticsAmount: bigint;
};
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
    readonly name: "quoteGenesisPurchase";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "staticsPrice";
    }, {
        readonly type: "uint256";
        readonly name: "nativeFee";
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
    readonly name: "nativeFeeRecipient";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "claimableNativeFees";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "recipient";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "totalNativeFeeLiability";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
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
            readonly name: "requiredBacking";
        }, {
            readonly type: "uint256";
            readonly name: "tokenCustody";
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
        readonly name: "price";
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
        readonly name: "burned";
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
        readonly name: "staticsBurned";
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
export declare const ProtocolPoolKind: {
    readonly None: 0;
    readonly BasketCanonical: 1;
    readonly Governance: 2;
};
export type ProtocolPoolKind = typeof ProtocolPoolKind[keyof typeof ProtocolPoolKind];
export type FeeTier = {
    minActionShares: bigint;
    feeShares: bigint;
};
export type SwapFeeConfiguration = {
    inputFeeBps: bigint;
    outputFeeBps: bigint;
    lockedLiquidityShareBps: bigint;
    liquidityProviderShareBps: bigint;
    basketStakerShareBps: bigint;
    staticsStakerShareBps: bigint;
    stonkBrokersShareBps: bigint;
    indexCreatorShareBps: bigint;
    treasuryShareBps: bigint;
};
export type PoolFeeConfiguration = SwapFeeConfiguration & {
    overridden: boolean;
};
export type SwapFeeSplit = {
    lockedLiquidityAmount: bigint;
    liquidityProviderAmount: bigint;
    basketStakerAmount: bigint;
    staticsStakerAmount: bigint;
    stonkBrokersAmount: bigint;
    indexCreatorAmount: bigint;
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
    sqrtPriceAssetPerBasketX96: bigint;
    pairedAssetAmount: bigint;
};
export type CreateGovernancePoolParams = {
    tokenA: Address;
    tokenB: Address;
    sqrtPriceBPerAX96: bigint;
    amountAMax: bigint;
    amountBMax: bigint;
    minLiquidity: bigint;
    payer: Address;
    deadline: bigint;
};
export type ProtocolPool = {
    poolId: Hex;
    key: V4PoolKey;
    kind: ProtocolPoolKind;
    decommissioned: boolean;
    basketId: bigint;
    basketAsset: Address;
    permanentLiquidity: bigint;
};
export type PreparedTransaction = {
    data: Hex;
    value: bigint;
};
export type GlobalRewardAsset = {
    actualEligibleStake: bigint;
    actualPendingStake: bigint;
    effectiveEligibleWeight: bigint;
    effectivePendingWeight: bigint;
    indexRay: bigint;
    indexRemainder: bigint;
    indexedReserve: bigint;
    totalClaimable: bigint;
};
export type GlobalRewardSelection = {
    selected: boolean;
    actualEligibleStake: bigint;
    actualPendingStake: bigint;
    effectiveEligibleWeight: bigint;
    effectivePendingWeight: bigint;
    eligibleAt: bigint;
};
export type GenesisState = {
    tier: number;
    multiplierBps: number;
    linkedPositionId: bigint;
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
    liquidityPositionCount: bigint;
    globalRewardAssetCount: bigint;
    riskSeriesCount: bigint;
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
    lpFeeBps: bigint;
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
export type StakedLiquidityIncreaseRequest = {
    liquidityDelta: bigint;
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
export declare function encodeSqrtPriceAssetPerBasketX96(assetAmountRaw: bigint, basketAmountRaw: bigint): bigint;
export declare function encodeSqrtPriceBPerAX96(tokenBAmountRaw: bigint, tokenAAmountRaw: bigint): bigint;
export declare function quoteHookFee(realizedAmount: bigint, hookFeeBps: bigint): bigint;
export declare function splitSwapFee(chargedAmount: bigint, configuration: SwapFeeConfiguration, liquidityProvidersEligible: boolean, basketStakersEligible: boolean, staticsStakersEligible: boolean): SwapFeeSplit;
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
            readonly name: "withdrawableAfterBlock";
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
            readonly name: "actualEligibleStake";
        }, {
            readonly type: "uint256";
            readonly name: "actualPendingStake";
        }, {
            readonly type: "uint256";
            readonly name: "effectiveEligibleWeight";
        }, {
            readonly type: "uint256";
            readonly name: "effectivePendingWeight";
        }, {
            readonly type: "uint256";
            readonly name: "indexRay";
        }, {
            readonly type: "uint256";
            readonly name: "indexRemainder";
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
            readonly name: "actualEligibleStake";
        }, {
            readonly type: "uint256";
            readonly name: "actualPendingStake";
        }, {
            readonly type: "uint256";
            readonly name: "effectiveEligibleWeight";
        }, {
            readonly type: "uint256";
            readonly name: "effectivePendingWeight";
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
    readonly name: "genesisCollection";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "genesisState";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint8";
            readonly name: "tier";
        }, {
            readonly type: "uint16";
            readonly name: "multiplierBps";
        }, {
            readonly type: "uint256";
            readonly name: "linkedPositionId";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "genesisTier";
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
    readonly name: "genesisActivationCost";
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
    readonly name: "positionRewardMultiplierBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "linkGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "unlinkGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "activateGenesis";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint8";
        readonly name: "targetTier";
    }, {
        readonly type: "uint256";
        readonly name: "maxBurn";
    }];
    readonly outputs: readonly [];
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
    readonly name: "claimCreatorRevenue";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
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
        readonly name: "received";
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
            readonly name: "liquidityPositionCount";
        }, {
            readonly type: "uint256";
            readonly name: "globalRewardAssetCount";
        }, {
            readonly type: "uint256";
            readonly name: "riskSeriesCount";
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
    readonly name: "liquidityPositionIdsOfPosition";
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
        readonly name: "tokenIds";
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
    readonly name: "quoteGovernancePool";
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
            readonly type: "uint160";
            readonly name: "sqrtPriceBPerAX96";
        }, {
            readonly type: "uint256";
            readonly name: "amountAMax";
        }, {
            readonly type: "uint256";
            readonly name: "amountBMax";
        }, {
            readonly type: "uint128";
            readonly name: "minLiquidity";
        }, {
            readonly type: "address";
            readonly name: "payer";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
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
        readonly name: "key";
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint160";
        readonly name: "sqrtPriceX96";
    }, {
        readonly type: "uint128";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "amountA";
    }, {
        readonly type: "uint256";
        readonly name: "amountB";
    }];
}, {
    readonly name: "createGovernancePool";
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
            readonly type: "uint160";
            readonly name: "sqrtPriceBPerAX96";
        }, {
            readonly type: "uint256";
            readonly name: "amountAMax";
        }, {
            readonly type: "uint256";
            readonly name: "amountBMax";
        }, {
            readonly type: "uint128";
            readonly name: "minLiquidity";
        }, {
            readonly type: "address";
            readonly name: "payer";
        }, {
            readonly type: "uint256";
            readonly name: "deadline";
        }];
        readonly name: "params";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint128";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "amountA";
    }, {
        readonly type: "uint256";
        readonly name: "amountB";
    }];
}, {
    readonly name: "setProtocolPoolFeeConfiguration";
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
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "configuration";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "clearProtocolPoolFeeConfiguration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "protocolPoolFeeConfiguration";
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
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }, {
            readonly type: "bool";
            readonly name: "overridden";
        }];
        readonly name: "configuration";
    }];
}, {
    readonly name: "decommissionGovernancePool";
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
    readonly name: "replaceLiquidityManager";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "newManager";
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
            readonly type: "uint128";
            readonly name: "permanentLiquidity";
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
    readonly name: "installLiquidityManager";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "manager";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setSwapFeeConfiguration";
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
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "configuration";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "swapFeeConfiguration";
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
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "configuration";
    }];
}, {
    readonly name: "setCanonicalPoolFeeConfiguration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "configuration";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "clearCanonicalPoolFeeConfiguration";
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
    readonly name: "canonicalPoolFeeConfiguration";
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
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }, {
            readonly type: "bool";
            readonly name: "overridden";
        }];
        readonly name: "configuration";
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
    readonly name: "borrowAndStakeLiquidity";
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
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "loanId";
    }, {
        readonly type: "uint256[]";
        readonly name: "v4TokenIds";
    }];
}, {
    readonly name: "stakeLiquidityPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "activateLiquidityPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "increaseStakedLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "liquidityDelta";
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
        readonly name: "request";
    }, {
        readonly type: "address";
        readonly name: "refundReceiver";
    }];
    readonly outputs: readonly [{
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
    readonly name: "unstakeLiquidityPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "claimLiquidityRewards";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }, {
        readonly type: "uint256";
        readonly name: "minAmount0";
    }, {
        readonly type: "uint256";
        readonly name: "minAmount1";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "stakedLiquidityPosition";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
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
            readonly type: "address";
            readonly name: "asset";
        }, {
            readonly type: "bytes32";
            readonly name: "poolId";
        }, {
            readonly type: "address";
            readonly name: "currency0";
        }, {
            readonly type: "address";
            readonly name: "currency1";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleLiquidity";
        }, {
            readonly type: "uint256";
            readonly name: "pendingLiquidity";
        }, {
            readonly type: "uint256";
            readonly name: "eligibleAtBlock";
        }, {
            readonly type: "uint256";
            readonly name: "claimable0";
        }, {
            readonly type: "uint256";
            readonly name: "claimable1";
        }, {
            readonly type: "bool";
            readonly name: "staked";
        }];
        readonly name: "position";
    }];
}, {
    readonly name: "poolLiquidityRewards";
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
            readonly name: "totalEligibleLiquidity";
        }, {
            readonly type: "uint256";
            readonly name: "index0Ray";
        }, {
            readonly type: "uint256";
            readonly name: "index1Ray";
        }, {
            readonly type: "uint256";
            readonly name: "indexRemainder0";
        }, {
            readonly type: "uint256";
            readonly name: "indexRemainder1";
        }, {
            readonly type: "uint256";
            readonly name: "indexed0";
        }, {
            readonly type: "uint256";
            readonly name: "indexed1";
        }, {
            readonly type: "uint256";
            readonly name: "crystallized0";
        }, {
            readonly type: "uint256";
            readonly name: "crystallized1";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimable0";
        }, {
            readonly type: "uint256";
            readonly name: "totalClaimable1";
        }];
        readonly name: "pool";
    }];
}, {
    readonly name: "pendingLiquidityRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
        readonly name: "currency0";
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "address";
        readonly name: "currency1";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }];
}, {
    readonly name: "canAccrueLiquidityRewards";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
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
    readonly name: "MetadataUpdate";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
}, {
    readonly name: "BatchMetadataUpdate";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "fromTokenId";
    }, {
        readonly type: "uint256";
        readonly name: "toTokenId";
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
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }];
}, {
    readonly name: "GenesisUnlinked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
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
        readonly name: "burnedAmount";
    }, {
        readonly type: "uint16";
        readonly name: "multiplierBps";
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
        readonly name: "newOwner";
        readonly indexed: true;
    }];
}, {
    readonly name: "CreatorRevenueAccrued";
    readonly type: "event";
    readonly inputs: readonly [{
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
    readonly name: "CreatorRevenueClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
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
    readonly name: "GovernancePoolCreated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "tokenA";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "tokenB";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "payer";
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
    }, {
        readonly type: "uint128";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "amountA";
    }, {
        readonly type: "uint256";
        readonly name: "amountB";
    }];
}, {
    readonly name: "ProtocolPoolFeeConfigurationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "ProtocolPoolFeeConfigurationCleared";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "GovernancePoolDecommissioned";
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
    readonly name: "SwapFeeConfigurationChanged";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint16";
            readonly name: "inputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "outputFeeBps";
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "configuration";
    }];
}, {
    readonly name: "CanonicalPoolFeeConfigurationSet";
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
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "lockedLiquidityShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "liquidityProviderShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "basketStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "stonkBrokersShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "indexCreatorShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}, {
    readonly name: "CanonicalPoolFeeConfigurationCleared";
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
    }];
}, {
    readonly name: "PermanentLiquidityTreasuryAccrued";
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
    readonly name: "BorrowedLiquidityStaked";
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
        readonly name: "beneficiary";
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
    readonly name: "LiquidityPositionStaked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "eligibleAtBlock";
    }];
}, {
    readonly name: "LiquidityPositionActivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "liquidity";
    }];
}, {
    readonly name: "StakedLiquidityIncreased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "liquidityDelta";
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
    }, {
        readonly type: "uint256";
        readonly name: "eligibleAtBlock";
    }];
}, {
    readonly name: "LiquidityPositionUnstaked";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "LiquidityRewardAccrued";
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
    }, {
        readonly type: "uint256";
        readonly name: "indexRay";
    }];
}, {
    readonly name: "LiquidityRewardSettled";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
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
    readonly name: "LiquidityRewardClaimed";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "tokenId";
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
            readonly name: "liquidityPositionCount";
        }, {
            readonly type: "uint256";
            readonly name: "globalRewardAssetCount";
        }, {
            readonly type: "uint256";
            readonly name: "riskSeriesCount";
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
    readonly name: "liquidityPositionIdsOfPosition";
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
        readonly name: "tokenIds";
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
    readonly name: "feeConfiguration";
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
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "config";
    }];
}, {
    readonly name: "setFeeConfiguration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "lockedLiquidityShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "liquidityProviderShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "basketStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "stonkBrokersShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "indexCreatorShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "setPoolFeeConfiguration";
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
        }, {
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }];
        readonly name: "configuration";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "clearPoolFeeConfiguration";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "poolFeeConfiguration";
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
            readonly type: "uint16";
            readonly name: "lockedLiquidityShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "liquidityProviderShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "basketStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "staticsStakerShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "stonkBrokersShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "indexCreatorShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }, {
            readonly type: "bool";
            readonly name: "overridden";
        }];
        readonly name: "configuration";
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
            readonly type: "bool";
            readonly name: "registered";
        }];
        readonly name: "registration";
    }];
}, {
    readonly name: "pendingPermanentLiquidity";
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
    readonly name: "lockedLiquidity";
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
    readonly name: "compoundPermanentLiquidity";
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
    readonly outputs: readonly [{
        readonly type: "uint128";
        readonly name: "liquidityAdded";
    }];
}, {
    readonly name: "releasePermanentLiquidity";
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
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
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
        readonly name: "lockedLiquidityAmount";
    }, {
        readonly type: "uint256";
        readonly name: "liquidityProviderAmount";
    }, {
        readonly type: "uint256";
        readonly name: "basketStakerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "staticsStakerAmount";
    }, {
        readonly type: "uint256";
        readonly name: "stonkBrokersAmount";
    }, {
        readonly type: "uint256";
        readonly name: "indexCreatorAmount";
    }, {
        readonly type: "uint256";
        readonly name: "treasuryAmount";
    }];
}, {
    readonly name: "PermanentLiquidityAdded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint128";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "amount0";
    }, {
        readonly type: "uint256";
        readonly name: "amount1";
    }, {
        readonly type: "uint256";
        readonly name: "pending0";
    }, {
        readonly type: "uint256";
        readonly name: "pending1";
    }];
}, {
    readonly name: "PermanentLiquidityFeesCollected";
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
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "pendingAmount";
    }];
}, {
    readonly name: "PermanentLiquidityReleased";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
        readonly indexed: true;
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
    readonly name: "PoolDecommissioned";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }];
}, {
    readonly name: "FeeConfigurationSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint16";
        readonly name: "inputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "outputFeeBps";
    }, {
        readonly type: "uint16";
        readonly name: "lockedLiquidityShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "liquidityProviderShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "basketStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "stonkBrokersShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "indexCreatorShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}, {
    readonly name: "PoolFeeConfigurationSet";
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
        readonly type: "uint16";
        readonly name: "lockedLiquidityShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "liquidityProviderShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "basketStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "staticsStakerShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "stonkBrokersShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "indexCreatorShareBps";
    }, {
        readonly type: "uint16";
        readonly name: "treasuryShareBps";
    }];
}, {
    readonly name: "PoolFeeConfigurationCleared";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
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
    readonly name: "increaseUserPosition";
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
        readonly type: "uint256";
        readonly name: "tokenId";
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
    readonly name: "UserPositionIncreased";
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
        readonly name: "refundRecipient";
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
        readonly type: "address[5]";
        readonly name: "assets";
    }, {
        readonly type: "uint256[5]";
        readonly name: "amounts";
    }];
}];
export type StaticsLiquidityEventName = "StakingPositionCreated" | "Staked" | "Unstaked" | "GlobalFeeAccrued" | "RewardClaimed" | "TreasuryFeesDistributed" | "RewardAssetOptedIn" | "RewardStakeScheduled" | "RewardBucketMatured" | "PositionRewardEligibilityActivated" | "RewardAssetOptedOut" | "RewardAssetDustRouted" | "PositionRewardSettled" | "LiquidityIntegrationInstalled" | "CanonicalPoolInitialized" | "GovernancePoolCreated" | "ProtocolPoolFeeConfigurationSet" | "ProtocolPoolFeeConfigurationCleared" | "GovernancePoolDecommissioned" | "LiquidityManagerReplaced" | "LiquidityManagerInstalled" | "CanonicalPoolSyncedToManager" | "SwapFeeConfigurationChanged" | "CanonicalPoolFeeConfigurationSet" | "CanonicalPoolFeeConfigurationCleared" | "PermanentLiquidityTreasuryAccrued" | "BasketLiquidityUnwound" | "BorrowedLiquidityPositionMinted" | "BorrowedLiquidityProvided" | "BorrowedLiquidityStaked" | "BasketRewardAccrued" | "BasketRewardSettled" | "BasketRewardClaimed" | "BasketRewardDustRouted" | "LiquidityPositionStaked" | "LiquidityPositionActivated" | "StakedLiquidityIncreased" | "LiquidityPositionUnstaked" | "LiquidityRewardAccrued" | "LiquidityRewardSettled" | "LiquidityRewardClaimed";
export type StaticsLiquidityEventArgs<Name extends StaticsLiquidityEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsPositionEventName = "PositionCreated" | "PositionClosed" | "PositionCreationFeeSet" | "PositionCreationFeePaid" | "PositionLegAttached" | "PositionLegDetached" | "PositionStateChanged" | "Transfer" | "BasketCollateralDeposited" | "BasketCollateralWithdrawn" | "BasketCollateralRedeemed" | "BasketRewardSettled" | "BasketRewardClaimed" | "StakingPositionCreated" | "Staked" | "Unstaked" | "RewardAssetOptedIn" | "RewardStakeScheduled" | "PositionRewardEligibilityActivated" | "RewardAssetOptedOut" | "PositionRewardSettled";
export type StaticsPositionEventArgs<Name extends StaticsPositionEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsLendingEventName = "LoanOriginated" | "LoanRepaid" | "LoanExtended" | "LoanExtensionFeePaid" | "LoanRecovered" | "RecoveryPenaltyDistributed";
export type StaticsLendingEventArgs<Name extends StaticsLendingEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsHookEventName = "PoolRegistered" | "SwapLegFeeAccrued" | "PermanentLiquidityAdded" | "PermanentLiquidityFeesCollected" | "PermanentLiquidityReleased" | "PoolDecommissioned" | "FeeConfigurationSet" | "PoolFeeConfigurationSet" | "PoolFeeConfigurationCleared";
export type StaticsHookEventArgs<Name extends StaticsHookEventName> = ContractEventArgs<typeof staticsSwapFeeHookAbi, Name>;
export type StaticsLiquidityManagerEventName = "UserPositionMinted" | "UserPositionIncreased";
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
    readonly name: "InvalidPayer";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "DeadlineExpired";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "deadline";
    }];
}, {
    readonly name: "InvalidPoolPrice";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint160";
        readonly name: "sqrtPriceBPerAX96";
    }];
}, {
    readonly name: "InsufficientSeedLiquidity";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint128";
        readonly name: "calculated";
    }, {
        readonly type: "uint128";
        readonly name: "minimum";
    }];
}, {
    readonly name: "InvalidSeedAmounts";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "amountA";
    }, {
        readonly type: "uint256";
        readonly name: "amountB";
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
    readonly name: "PoolAlreadyDecommissioned";
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
    readonly name: "GovernancePoolNotRegistered";
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
}, {
    readonly name: "PositionDepositTooRecent";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "uint256";
        readonly name: "withdrawableAfterBlock";
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
    readonly name: "GenesisOwnerMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "address";
        readonly name: "expected";
    }, {
        readonly type: "address";
        readonly name: "actual";
    }];
}, {
    readonly name: "PositionOwnerMismatch";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "address";
        readonly name: "expected";
    }, {
        readonly type: "address";
        readonly name: "actual";
    }];
}, {
    readonly name: "UnauthorizedGenesisCollection";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
    }];
}, {
    readonly name: "ActivationBurnExceedsMaximum";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "required";
    }, {
        readonly type: "uint256";
        readonly name: "maximum";
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
    readonly name: "GenesisNotLinked";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
}, {
    readonly name: "GenesisLinkedOnTransfer";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }];
}, {
    readonly name: "InvalidActivationTier";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "currentTier";
    }, {
        readonly type: "uint8";
        readonly name: "targetTier";
    }];
}, {
    readonly name: "InvalidActivationCost";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "cost";
    }];
}];
export declare const staticsProtocolRevenueErrorAbi: readonly [{
    readonly name: "InvalidReceiver";
    readonly type: "error";
    readonly inputs: readonly [];
}, {
    readonly name: "NoRevenue";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
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
        readonly name: "spent";
    }, {
        readonly type: "uint256";
        readonly name: "received";
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
}];
export declare function buildBuyGenesisTransaction(tokenId: bigint, receiver: Address, nativeFee: bigint): PreparedTransaction;
export declare function buildRedeemGenesisCall(tokenId: bigint, receiver: Address): Hex;
export declare function buildActivateGenesisCall(genesisId: bigint, targetTier: number): Hex;
export declare function buildActivateGenesisCall(genesisId: bigint, targetTier: number, maxBurn: bigint): Hex;
export declare function buildRegisterGenesisCall(genesisId: bigint): Hex;
export declare function buildClaimGenesisLaunchRewardsCall(genesisId: bigint, asset: Address, receiver: Address): Hex;
export declare function buildClaimOwnerGenesisLaunchRewardsCall(asset: Address, receiver: Address): Hex;
export declare function buildAccrueGenesisLaunchRewardsCall(): Hex;
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
export declare function buildLinkGenesisCall(genesisId: bigint, positionId: bigint): Hex;
export declare function buildUnlinkGenesisCall(genesisId: bigint): Hex;
export declare function buildClaimCreatorRevenueCall(asset: Address, receiver: Address, minReceived: bigint): Hex;
export declare function buildDistributePartnerRevenueCall(recipient: Address, asset: Address): Hex;
export declare function buildBorrowCall(positionId: bigint, basketId: bigint, sharesIn: bigint, receiver: Address): Hex;
export declare function buildRepayCall(loanId: bigint): Hex;
export declare function buildExtendCall(loanId: bigint, grossAmountsIn: readonly bigint[]): Hex;
export declare function buildRecoverCall(loanId: bigint): Hex;
export declare function buildFlashLoanCall(basketId: bigint, shares: bigint, receiver: Address, data: Hex): Hex;
export declare function buildCreatePositionCall(receiver: Address): Hex;
export declare function buildSetPositionCreationFeeCall(amount: bigint): Hex;
export declare function buildClosePositionCall(positionId: bigint): Hex;
export declare function buildQuarantineBasketCall(basketId: bigint): Hex;
export declare function buildReleaseBasketQuarantineCall(basketId: bigint): Hex;
export declare function buildDecommissionBasketCall(basketId: bigint): Hex;
export declare function buildSetSwapFeeConfigurationCall(configuration: SwapFeeConfiguration): Hex;
export declare function buildSetCanonicalPoolFeeConfigurationCall(basketId: bigint, asset: Address, configuration: SwapFeeConfiguration): Hex;
export declare function buildQuoteGovernancePoolCall(params: CreateGovernancePoolParams): Hex;
export declare function buildCreateGovernancePoolCall(params: CreateGovernancePoolParams): Hex;
export declare function buildSetProtocolPoolFeeConfigurationCall(poolId: Hex, configuration: SwapFeeConfiguration): Hex;
export declare function buildClearProtocolPoolFeeConfigurationCall(poolId: Hex): Hex;
export declare function buildDecommissionGovernancePoolCall(poolId: Hex): Hex;
export declare function buildReplaceLiquidityManagerCall(newManager: Address): Hex;
export declare function buildClearCanonicalPoolFeeConfigurationCall(basketId: bigint, asset: Address): Hex;
export declare function buildUnwindBasketLiquidityCall(basketId: bigint, asset: Address): Hex;
export declare function buildBorrowAndProvideLiquidityCall(positionId: bigint, basketId: bigint, sharesIn: bigint, pools: readonly LiquidityParams[], lpRecipient: Address): Hex;
export declare function buildBorrowAndStakeLiquidityCall(positionId: bigint, basketId: bigint, sharesIn: bigint, pools: readonly LiquidityParams[]): Hex;
export declare function buildStakeLiquidityPositionCall(positionId: bigint, tokenId: bigint): Hex;
export declare function buildActivateLiquidityPositionCall(tokenId: bigint): Hex;
export declare function buildIncreaseStakedLiquidityCall(positionId: bigint, tokenId: bigint, request: StakedLiquidityIncreaseRequest, refundReceiver: Address): Hex;
export declare function buildUnstakeLiquidityPositionCall(positionId: bigint, tokenId: bigint, receiver: Address): Hex;
export declare function buildClaimLiquidityRewardsCall(positionId: bigint, tokenId: bigint, receiver: Address, minAmount0: bigint, minAmount1: bigint): Hex;
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
