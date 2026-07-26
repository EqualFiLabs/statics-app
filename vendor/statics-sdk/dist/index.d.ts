import { type Address, type ContractEventArgs, type Hex } from "viem";
export { robinhoodChain } from "./generated/robinhoodChain.js";
export declare const BPS = 10000n;
export declare const SHARE_SCALE: bigint;
export declare const MAX_LTV_BPS = 9500n;
export declare const LOAN_RECOVERY_GRACE_PERIOD = 3600n;
export declare const RECOVERY_CALLER_SHARE_BPS = 2000n;
export declare const Q96: bigint;
export declare const Q128: bigint;
export declare const MAX_UINT256: bigint;
export declare const MIN_TICK = -887272;
export declare const MAX_TICK = 887272;
export declare const BasketStatus: {
    readonly Active: 0;
    readonly Quarantined: 1;
    readonly ExitOnly: 2;
};
export type BasketStatus = typeof BasketStatus[keyof typeof BasketStatus];
export declare const CanonicalPoolStatus: {
    readonly Unconfigured: 0;
    readonly Warming: 1;
    readonly Active: 2;
};
export type CanonicalPoolStatus = typeof CanonicalPoolStatus[keyof typeof CanonicalPoolStatus];
export type FeeTier = {
    minActionShares: bigint;
    feeShares: bigint;
};
export type SwapFeeConfiguration = {
    inputFeeBps: bigint;
    outputFeeBps: bigint;
    polShareBps: bigint;
    liquidityProviderShareBps: bigint;
    basketStakerShareBps: bigint;
    staticsStakerShareBps: bigint;
    treasuryShareBps: bigint;
};
export type PoolFeeConfiguration = SwapFeeConfiguration & {
    overridden: boolean;
};
export type SwapFeeSplit = {
    polAmount: bigint;
    liquidityProviderAmount: bigint;
    basketStakerAmount: bigint;
    staticsStakerAmount: bigint;
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
export type PreparedTransaction = {
    data: Hex;
    value: bigint;
};
export type GlobalRewardAsset = {
    eligibleStake: bigint;
    pendingStake: bigint;
    indexRay: bigint;
    indexedReserve: bigint;
    totalClaimable: bigint;
};
export type GlobalRewardSelection = {
    selected: boolean;
    eligibleStake: bigint;
    pendingStake: bigint;
    eligibleAt: bigint;
};
export type PermitSignature = {
    deadline: bigint;
    v: number;
    r: Hex;
    s: Hex;
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
    readonly stateMutability: "nonpayable";
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
            readonly name: "eligibleStake";
        }, {
            readonly type: "uint256";
            readonly name: "pendingStake";
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
            readonly name: "pendingStake";
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
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
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
    readonly name: "isPositionLegActive";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "positionKey";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
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
    readonly name: "initializeCanonicalPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint160";
        readonly name: "sqrtPriceX96";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }];
}, {
    readonly name: "checkpointCanonicalPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "observationStored";
    }];
}, {
    readonly name: "activateCanonicalPool";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "int24";
        readonly name: "referenceTick";
    }, {
        readonly type: "int24";
        readonly name: "spotTick";
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
            readonly type: "uint8";
            readonly name: "status";
        }, {
            readonly type: "uint40";
            readonly name: "initializedAt";
        }, {
            readonly type: "uint40";
            readonly name: "activatedAt";
        }, {
            readonly type: "int24";
            readonly name: "spotTick";
        }, {
            readonly type: "int24";
            readonly name: "referenceTick";
        }, {
            readonly type: "uint8";
            readonly name: "observationCardinality";
        }, {
            readonly type: "bool";
            readonly name: "referenceAvailable";
        }];
        readonly name: "pool";
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
    readonly name: "liquiditySafetyParameters";
    readonly type: "function";
    readonly stateMutability: "pure";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint24";
        readonly name: "lpFee";
    }, {
        readonly type: "int24";
        readonly name: "tickSpacing";
    }, {
        readonly type: "uint40";
        readonly name: "warmup";
    }, {
        readonly type: "uint32";
        readonly name: "referenceWindow";
    }, {
        readonly type: "uint16";
        readonly name: "maxDeviationBps";
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
    readonly name: "syncCanonicalPoolToManager";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "synced";
    }];
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
            readonly name: "polShareBps";
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
            readonly name: "polShareBps";
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
            readonly name: "polShareBps";
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
            readonly name: "polShareBps";
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
    readonly name: "PositionLegActivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
        readonly indexed: true;
    }];
}, {
    readonly name: "PositionLegDeactivated";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "bytes32";
        readonly name: "legKey";
        readonly indexed: true;
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
        readonly name: "pendingStake";
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
        readonly name: "pendingStake";
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
        readonly name: "amount";
    }, {
        readonly type: "uint256";
        readonly name: "eligibleStake";
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
        readonly name: "amount";
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
        readonly name: "removedEligibleStake";
    }, {
        readonly type: "uint256";
        readonly name: "removedPendingStake";
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
    readonly name: "CanonicalPoolCheckpointed";
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
        readonly type: "bool";
        readonly name: "observationStored";
    }];
}, {
    readonly name: "CanonicalPoolActivated";
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
        readonly type: "int24";
        readonly name: "referenceTick";
    }, {
        readonly type: "int24";
        readonly name: "spotTick";
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
            readonly name: "polShareBps";
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
        readonly name: "polShareBps";
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
            readonly name: "polShareBps";
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
        readonly name: "polShareBps";
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
            readonly name: "polShareBps";
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
            readonly name: "polShareBps";
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
    readonly name: "checkpoint";
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
        readonly type: "bool";
        readonly name: "observationStored";
    }];
}, {
    readonly name: "oracleState";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint40";
            readonly name: "initializedAt";
        }, {
            readonly type: "uint40";
            readonly name: "lastCheckpointAt";
        }, {
            readonly type: "uint40";
            readonly name: "latestObservationAt";
        }, {
            readonly type: "int24";
            readonly name: "lastTick";
        }, {
            readonly type: "int56";
            readonly name: "tickCumulative";
        }, {
            readonly type: "uint8";
            readonly name: "observationIndex";
        }, {
            readonly type: "uint8";
            readonly name: "observationCardinality";
        }];
        readonly name: "state";
    }];
}, {
    readonly name: "observationAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint8";
        readonly name: "index";
    }];
    readonly outputs: readonly [{
        readonly type: "uint40";
        readonly name: "timestamp";
    }, {
        readonly type: "int56";
        readonly name: "tickCumulative";
    }];
}, {
    readonly name: "consult";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
    }, {
        readonly type: "uint32";
        readonly name: "window";
    }];
    readonly outputs: readonly [{
        readonly type: "int24";
        readonly name: "referenceTick";
    }, {
        readonly type: "int24";
        readonly name: "spotTick";
    }, {
        readonly type: "uint40";
        readonly name: "oldestObservationAt";
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
        readonly name: "polAmount";
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
        readonly name: "polShareBps";
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
        readonly name: "polShareBps";
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
}, {
    readonly name: "TickObservationRecorded";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "poolId";
        readonly indexed: true;
    }, {
        readonly type: "uint40";
        readonly name: "timestamp";
        readonly indexed: true;
    }, {
        readonly type: "int24";
        readonly name: "tick";
    }, {
        readonly type: "int56";
        readonly name: "tickCumulative";
    }, {
        readonly type: "uint8";
        readonly name: "cardinality";
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
    readonly name: "registerCanonicalPool";
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
    readonly name: "creditProtocolInventory";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "mintProtocolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "address";
            readonly name: "asset";
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
    }];
}, {
    readonly name: "increaseProtocolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "address";
            readonly name: "asset";
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
    }];
}, {
    readonly name: "collectProtocolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
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
    }];
}, {
    readonly name: "removeProtocolLiquidity";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "amount0Min";
    }, {
        readonly type: "uint256";
        readonly name: "amount1Min";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
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
    }];
}, {
    readonly name: "burnProtocolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "uint256";
        readonly name: "amount0Min";
    }, {
        readonly type: "uint256";
        readonly name: "amount1Min";
    }, {
        readonly type: "uint256";
        readonly name: "deadline";
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
    }];
}, {
    readonly name: "returnProtocolInventory";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "token";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "spent";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "transferProtocolPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "asset";
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "tokenId";
    }];
}, {
    readonly name: "mintUserPosition";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "address";
            readonly name: "asset";
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
            readonly type: "uint256";
            readonly name: "basketId";
        }, {
            readonly type: "address";
            readonly name: "asset";
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
    readonly name: "canonicalPoolHash";
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
        readonly type: "bytes32";
    }];
}, {
    readonly name: "protocolInventory";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "basketId";
    }, {
        readonly type: "address";
        readonly name: "token";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "totalProtocolInventory";
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
    readonly name: "protocolPositionId";
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
        readonly name: "tokenId";
    }];
}, {
    readonly name: "CanonicalPoolRegistered";
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
        readonly name: "poolKeyHash";
        readonly indexed: true;
    }];
}, {
    readonly name: "ProtocolInventoryCredited";
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
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "ProtocolInventoryReturned";
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
        readonly type: "uint256";
        readonly name: "spent";
    }, {
        readonly type: "uint256";
        readonly name: "received";
    }];
}, {
    readonly name: "ProtocolPositionMinted";
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
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "spent0";
    }, {
        readonly type: "uint256";
        readonly name: "spent1";
    }];
}, {
    readonly name: "ProtocolPositionIncreased";
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
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
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
}, {
    readonly name: "ProtocolPositionCollected";
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
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "received0";
    }, {
        readonly type: "uint256";
        readonly name: "received1";
    }];
}, {
    readonly name: "ProtocolPositionReduced";
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
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "liquidity";
    }, {
        readonly type: "uint256";
        readonly name: "received0";
    }, {
        readonly type: "uint256";
        readonly name: "received1";
    }];
}, {
    readonly name: "ProtocolPositionTransferred";
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
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "receiver";
    }];
}, {
    readonly name: "ProtocolPositionBurned";
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
        readonly name: "tokenId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "received0";
    }, {
        readonly type: "uint256";
        readonly name: "received1";
    }];
}, {
    readonly name: "UserPositionMinted";
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
export type StaticsLiquidityEventName = "StakingPositionCreated" | "Staked" | "Unstaked" | "GlobalFeeAccrued" | "RewardClaimed" | "TreasuryFeesDistributed" | "RewardAssetOptedIn" | "RewardStakeScheduled" | "RewardBucketMatured" | "PositionRewardEligibilityActivated" | "RewardAssetOptedOut" | "RewardAssetDustRouted" | "PositionRewardSettled" | "LiquidityIntegrationInstalled" | "CanonicalPoolInitialized" | "CanonicalPoolCheckpointed" | "CanonicalPoolActivated" | "LiquidityManagerInstalled" | "CanonicalPoolSyncedToManager" | "SwapFeeConfigurationChanged" | "CanonicalPoolFeeConfigurationSet" | "CanonicalPoolFeeConfigurationCleared" | "PermanentLiquidityTreasuryAccrued" | "BasketLiquidityUnwound" | "BorrowedLiquidityPositionMinted" | "BorrowedLiquidityProvided" | "BorrowedLiquidityStaked" | "BasketRewardAccrued" | "BasketRewardSettled" | "BasketRewardClaimed" | "BasketRewardDustRouted" | "LiquidityPositionStaked" | "LiquidityPositionActivated" | "StakedLiquidityIncreased" | "LiquidityPositionUnstaked" | "LiquidityRewardAccrued" | "LiquidityRewardSettled" | "LiquidityRewardClaimed";
export type StaticsLiquidityEventArgs<Name extends StaticsLiquidityEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsPositionEventName = "PositionCreated" | "PositionClosed" | "PositionLegActivated" | "PositionLegDeactivated" | "Transfer" | "BasketCollateralDeposited" | "BasketCollateralWithdrawn" | "BasketCollateralRedeemed" | "BasketRewardSettled" | "BasketRewardClaimed" | "StakingPositionCreated" | "Staked" | "Unstaked" | "RewardAssetOptedIn" | "RewardStakeScheduled" | "PositionRewardEligibilityActivated" | "RewardAssetOptedOut" | "PositionRewardSettled";
export type StaticsPositionEventArgs<Name extends StaticsPositionEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsLendingEventName = "LoanOriginated" | "LoanRepaid" | "LoanExtended" | "LoanExtensionFeePaid" | "LoanRecovered" | "RecoveryPenaltyDistributed";
export type StaticsLendingEventArgs<Name extends StaticsLendingEventName> = ContractEventArgs<typeof staticsAbi, Name>;
export type StaticsHookEventName = "PoolRegistered" | "SwapLegFeeAccrued" | "PermanentLiquidityAdded" | "PermanentLiquidityFeesCollected" | "PermanentLiquidityReleased" | "PoolDecommissioned" | "FeeConfigurationSet" | "PoolFeeConfigurationSet" | "PoolFeeConfigurationCleared" | "TickObservationRecorded";
export type StaticsHookEventArgs<Name extends StaticsHookEventName> = ContractEventArgs<typeof staticsSwapFeeHookAbi, Name>;
export type StaticsLiquidityManagerEventName = "CanonicalPoolRegistered" | "ProtocolInventoryCredited" | "ProtocolInventoryReturned" | "ProtocolPositionMinted" | "ProtocolPositionIncreased" | "ProtocolPositionCollected" | "ProtocolPositionReduced" | "ProtocolPositionTransferred" | "ProtocolPositionBurned" | "UserPositionMinted";
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
export declare const staticsPositionErrorAbi: readonly [{
    readonly name: "OnlyDiamondSelf";
    readonly type: "error";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "caller";
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
    readonly name: "ZeroLegKey";
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
export declare function buildCreateBasketTransaction(params: CreateBasketParams, creationFee: bigint): PreparedTransaction;
export declare function buildApproveV4PositionCall(operator: Address, tokenId: bigint): Hex;
export declare function buildPermit2ApproveCall(token: Address, spender: Address, amount: bigint, expiration: number): Hex;
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
export declare function buildBorrowCall(positionId: bigint, basketId: bigint, sharesIn: bigint, receiver: Address): Hex;
export declare function buildRepayCall(loanId: bigint): Hex;
export declare function buildExtendCall(loanId: bigint, grossAmountsIn: readonly bigint[]): Hex;
export declare function buildRecoverCall(loanId: bigint): Hex;
export declare function buildFlashLoanCall(basketId: bigint, shares: bigint, receiver: Address, data: Hex): Hex;
export declare function buildCreatePositionCall(receiver: Address): Hex;
export declare function buildClosePositionCall(positionId: bigint): Hex;
export declare function buildQuarantineBasketCall(basketId: bigint): Hex;
export declare function buildReleaseBasketQuarantineCall(basketId: bigint): Hex;
export declare function buildDecommissionBasketCall(basketId: bigint): Hex;
export declare function buildInitializeCanonicalPoolCall(basketId: bigint, asset: Address, sqrtPriceX96: bigint): Hex;
export declare function buildCheckpointCanonicalPoolCall(basketId: bigint, asset: Address): Hex;
export declare function buildActivateCanonicalPoolCall(basketId: bigint, asset: Address): Hex;
export declare function buildSyncCanonicalPoolToManagerCall(basketId: bigint, asset: Address): Hex;
export declare function buildSetSwapFeeConfigurationCall(configuration: SwapFeeConfiguration): Hex;
export declare function buildSetCanonicalPoolFeeConfigurationCall(basketId: bigint, asset: Address, configuration: SwapFeeConfiguration): Hex;
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
export declare function buildQuoteMintPeggedAndRecombineCall(peggedProfileId: bigint, volatileProfileId: bigint, seriesId: bigint, riskAmount: bigint): Hex;
export declare function buildMintPeggedAndRecombineCall(peggedProfileId: bigint, volatileProfileId: bigint, seriesId: bigint, riskAmount: bigint, maximumPeggedCollateralIn: bigint, minimumVolatileCollateralOut: bigint, receiver: Address): Hex;
export declare function buildMintPeggedAndRecombineWithPermitCall(peggedProfileId: bigint, volatileProfileId: bigint, seriesId: bigint, riskAmount: bigint, maximumPeggedCollateralIn: bigint, minimumVolatileCollateralOut: bigint, receiver: Address, permitSignature: PermitSignature): Hex;
export declare function buildRedeemPeggedCall(profileId: bigint, staticsDollarAmount: bigint, minimumCollateralOut: bigint, receiver: Address): Hex;
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
