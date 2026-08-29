import { encodeFunctionData, parseAbi } from "viem";
export const GENESIS_MAX_CREDIT_PRINCIPAL = 171000n * 10n ** 18n;
export const GENESIS_RECOVERY_RESIDUAL = 9000n * 10n ** 18n;
export const GENESIS_CREDIT_TERM = 30n * 24n * 60n * 60n;
export const GENESIS_CREDIT_RECOVERY_GRACE = 60n * 60n;
export const staticsGenesisCreditAbi = parseAbi([
    "function openGenesisCredit(uint256 genesisId, uint256 principal) payable",
    "function drawGenesisCredit(uint256 genesisId, uint256 amount) payable",
    "function extendGenesisCredit(uint256 genesisId) payable",
    "function repayGenesisCredit(uint256 genesisId, uint256 amount)",
    "function recoverGenesisCredit(uint256 genesisId)",
    "function epochActive() view returns (bool)",
    "function creditLimit(uint256 genesisId) view returns (uint256)",
    "function creditAvailable(uint256 genesisId) view returns (uint256)",
    "function credit(uint256 genesisId) view returns ((address owner, uint256 principal, uint40 maturity, uint40 recoverableAt, bool active) state)",
    "function creditActive(uint256 genesisId) view returns (bool)",
    "function creditRecoverableAt(uint256 genesisId) view returns (uint40)",
    "function quoteGenesisCredit(uint256 principal) view returns ((uint256 totalNativeFee, uint16 reserveShareBps, uint16 treasuryShareBps, uint256 reservePortion, uint256 treasuryPortion) quote)",
    "function quoteGenesisCreditExtension(uint256 genesisId) view returns ((uint256 totalNativeFee, uint16 reserveShareBps, uint16 treasuryShareBps, uint256 reservePortion, uint256 treasuryPortion) quote)",
    "function quoteGenesisCreditRecovery(uint256 genesisId) view returns ((uint256 unusedCredit, uint256 recoveryResidual, uint256 callerIncentive, uint256 genesisDistribution, uint40 recoverableAt) quote)",
    "function totalOutstandingGenesisCredit() view returns (uint256)",
    "function creditOriginationFee() view returns (uint256)",
    "function creditExtensionFee() view returns (uint256)",
    "function recoveryCallerShareBps() view returns (uint16)",
    "function creditServiceReserveShareBps() view returns (uint16)",
    "function creditServiceTreasuryShareBps() view returns (uint16)",
    "function creditIncreasesPaused() view returns (bool)",
    "function setCreditIncreasesPaused(bool paused)",
    "event CreditIncreasesPausedSet(bool paused)",
    "event GenesisCreditOpened(uint256 indexed genesisId, address indexed owner, uint256 principal, uint40 maturity, uint256 nativeFee)",
    "event GenesisCreditExtended(uint256 indexed genesisId, address indexed owner, uint40 previousMaturity, uint40 newMaturity, uint256 nativeFee)",
    "event GenesisCreditDrawn(uint256 indexed genesisId, address indexed owner, uint256 amount, uint256 newPrincipal, uint256 nativeFee)",
    "event GenesisCreditRepaid(uint256 indexed genesisId, address indexed payer, address indexed owner, uint256 amount, uint256 remainingPrincipal)",
    "event GenesisCreditRecovered(uint256 indexed genesisId, address indexed formerOwner, address indexed caller, uint256 principal, uint256 unusedCredit, uint256 callerIncentive, uint256 genesisDistribution)",
]);
export function buildOpenGenesisCreditTransaction(genesisId, principal, nativeFee) {
    return {
        data: encodeFunctionData({
            abi: staticsGenesisCreditAbi,
            functionName: "openGenesisCredit",
            args: [genesisId, principal],
        }),
        value: nativeFee,
    };
}
export function buildDrawGenesisCreditTransaction(genesisId, amount, nativeFee) {
    return {
        data: encodeFunctionData({
            abi: staticsGenesisCreditAbi,
            functionName: "drawGenesisCredit",
            args: [genesisId, amount],
        }),
        value: nativeFee,
    };
}
export function buildExtendGenesisCreditTransaction(genesisId, nativeFee) {
    return {
        data: encodeFunctionData({
            abi: staticsGenesisCreditAbi,
            functionName: "extendGenesisCredit",
            args: [genesisId],
        }),
        value: nativeFee,
    };
}
export function buildRepayGenesisCreditCall(genesisId, amount) {
    return encodeFunctionData({
        abi: staticsGenesisCreditAbi,
        functionName: "repayGenesisCredit",
        args: [genesisId, amount],
    });
}
export function buildRecoverGenesisCreditCall(genesisId) {
    return encodeFunctionData({
        abi: staticsGenesisCreditAbi,
        functionName: "recoverGenesisCredit",
        args: [genesisId],
    });
}
