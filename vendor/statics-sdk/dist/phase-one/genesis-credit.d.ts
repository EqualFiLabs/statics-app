import { type Address, type Hex } from "viem";
export declare const GENESIS_MAX_CREDIT_PRINCIPAL: bigint;
export declare const GENESIS_RECOVERY_RESIDUAL: bigint;
export declare const GENESIS_CREDIT_TERM: bigint;
export declare const GENESIS_CREDIT_RECOVERY_GRACE: bigint;
export declare const staticsGenesisCreditAbi: readonly [{
    readonly name: "openGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "principal";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "drawGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "extendGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "repayGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "recoverGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "epochActive";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "creditLimit";
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
    readonly name: "creditAvailable";
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
    readonly name: "credit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "owner";
        }, {
            readonly type: "uint256";
            readonly name: "principal";
        }, {
            readonly type: "uint40";
            readonly name: "maturity";
        }, {
            readonly type: "uint40";
            readonly name: "recoverableAt";
        }, {
            readonly type: "bool";
            readonly name: "active";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "creditActive";
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
    readonly name: "creditRecoverableAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint40";
    }];
}, {
    readonly name: "quoteGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "principal";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "totalNativeFee";
        }, {
            readonly type: "uint16";
            readonly name: "reserveShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }, {
            readonly type: "uint256";
            readonly name: "reservePortion";
        }, {
            readonly type: "uint256";
            readonly name: "treasuryPortion";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "quoteGenesisCreditExtension";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "totalNativeFee";
        }, {
            readonly type: "uint16";
            readonly name: "reserveShareBps";
        }, {
            readonly type: "uint16";
            readonly name: "treasuryShareBps";
        }, {
            readonly type: "uint256";
            readonly name: "reservePortion";
        }, {
            readonly type: "uint256";
            readonly name: "treasuryPortion";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "quoteGenesisCreditRecovery";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "unusedCredit";
        }, {
            readonly type: "uint256";
            readonly name: "recoveryResidual";
        }, {
            readonly type: "uint256";
            readonly name: "callerIncentive";
        }, {
            readonly type: "uint256";
            readonly name: "genesisDistribution";
        }, {
            readonly type: "uint40";
            readonly name: "recoverableAt";
        }];
        readonly name: "quote";
    }];
}, {
    readonly name: "totalOutstandingGenesisCredit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "creditOriginationFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "creditExtensionFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "recoveryCallerShareBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "creditServiceReserveShareBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "creditServiceTreasuryShareBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint16";
    }];
}, {
    readonly name: "creditIncreasesPaused";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "setCreditIncreasesPaused";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "bool";
        readonly name: "paused";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "CreditIncreasesPausedSet";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bool";
        readonly name: "paused";
    }];
}, {
    readonly name: "GenesisCreditOpened";
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
        readonly type: "uint256";
        readonly name: "principal";
    }, {
        readonly type: "uint40";
        readonly name: "maturity";
    }, {
        readonly type: "uint256";
        readonly name: "nativeFee";
    }];
}, {
    readonly name: "GenesisCreditExtended";
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
        readonly type: "uint40";
        readonly name: "previousMaturity";
    }, {
        readonly type: "uint40";
        readonly name: "newMaturity";
    }, {
        readonly type: "uint256";
        readonly name: "nativeFee";
    }];
}, {
    readonly name: "GenesisCreditDrawn";
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
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "newPrincipal";
    }, {
        readonly type: "uint256";
        readonly name: "nativeFee";
    }];
}, {
    readonly name: "GenesisCreditRepaid";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "payer";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "owner";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "remainingPrincipal";
    }];
}, {
    readonly name: "GenesisCreditRecovered";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "genesisId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "formerOwner";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "caller";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "principal";
    }, {
        readonly type: "uint256";
        readonly name: "unusedCredit";
    }, {
        readonly type: "uint256";
        readonly name: "callerIncentive";
    }, {
        readonly type: "uint256";
        readonly name: "genesisDistribution";
    }];
}];
export type GenesisCreditTransaction = Readonly<{
    data: Hex;
    value: bigint;
}>;
export declare function buildOpenGenesisCreditTransaction(genesisId: bigint, principal: bigint, nativeFee: bigint): GenesisCreditTransaction;
export declare function buildDrawGenesisCreditTransaction(genesisId: bigint, amount: bigint, nativeFee: bigint): GenesisCreditTransaction;
export declare function buildExtendGenesisCreditTransaction(genesisId: bigint, nativeFee: bigint): GenesisCreditTransaction;
export declare function buildRepayGenesisCreditCall(genesisId: bigint, amount: bigint): Hex;
export declare function buildRecoverGenesisCreditCall(genesisId: bigint): Hex;
export type GenesisCreditContract = Address;
