import type { Abi, Address, Hex } from "viem";
export declare const GENESIS_MAX_CREDIT_PRINCIPAL: bigint;
export declare const GENESIS_RECOVERY_RESIDUAL: bigint;
export declare const GENESIS_CREDIT_TERM: bigint;
export declare const GENESIS_CREDIT_RECOVERY_GRACE: bigint;
export declare const staticsGenesisCreditAbi: Abi;
export type GenesisCreditTransaction = Readonly<{
    data: Hex;
    value: bigint;
}>;
export declare function buildOpenGenesisCreditTransaction(genesisId: bigint, principal: bigint, nativeFee: bigint): GenesisCreditTransaction;
export declare function buildExtendGenesisCreditTransaction(genesisId: bigint, nativeFee: bigint): GenesisCreditTransaction;
export declare function buildRepayGenesisCreditCall(genesisId: bigint): Hex;
export declare function buildRecoverGenesisCreditCall(genesisId: bigint): Hex;
export type GenesisCreditContract = Address;
