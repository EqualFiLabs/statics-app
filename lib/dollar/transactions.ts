import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  decodeFunctionResult,
  type Hex,
} from "viem";

import { staticsAbi, staticsDollarErrorAbi } from "@statics-protocol/sdk";

export const DOLLAR_SLIPPAGE_BPS = 50n;
const BPS = 10_000n;

export function minimumWithTolerance(amount: bigint): bigint {
  return (amount * (BPS - DOLLAR_SLIPPAGE_BPS)) / BPS;
}

export function maximumWithTolerance(amount: bigint): bigint {
  return amount === 0n ? 0n : (amount * (BPS + DOLLAR_SLIPPAGE_BPS) - 1n) / BPS + 1n;
}

export function validateRecombinationSimulation(
  functionName: "recombineToETH" | "recombineToWETH",
  result: Hex | undefined
): bigint {
  if (!result) throw new Error("The recombination simulation returned no result.");
  const [exitStatus, collateralOut] = decodeFunctionResult({
    abi: staticsAbi,
    functionName,
    data: result,
  });
  if (exitStatus !== 0) {
    throw new Error(`CollateralExitUnavailable: simulated exit status ${exitStatus.toString()}.`);
  }
  if (collateralOut === 0n) {
    throw new Error("The recombination simulation returned zero collateral.");
  }
  return collateralOut;
}

const errorMessages: Readonly<Record<string, string>> = {
  ZeroAmount: "Enter an amount greater than zero.",
  InvalidProfile: "The configured WETH profile is unavailable.",
  InvalidProfileKind: "The configured profile is not a volatile collateral profile.",
  InvalidProfileMode: "The WETH profile is not active for this operation.",
  InvalidSeries: "The selected Risk series cannot be used for this operation.",
  EmptyPool: "The selected series does not have enough paired liquidity.",
  DepositTooSmall: "This deposit is too small to create a Dollar and Risk pair.",
  RedemptionTooSmall: "This recombination amount is too small.",
  OutputBelowMinimum: "The fresh output moved below your 0.50% tolerance. Review the new quote.",
  SharesAboveMaximum:
    "The required Risk shares moved above your 0.50% tolerance. Review the new quote.",
  DebtCeilingExceeded: "This deposit would exceed the WETH profile debt ceiling.",
  ProfileOperationPaused: "This Dollar operation is currently paused.",
  ProfileImpaired: "The WETH profile is impaired, so this operation is unavailable.",
  TransitionRequired: "The active Risk series must transition before this operation can continue.",
  CollateralExitUnavailable: "Global protocol health currently prevents collateral exits.",
  SeriesNotActive: "The quoted Risk series is no longer active. Refresh before continuing.",
  UnexpectedExitStatus: "The gateway could not complete an ordinary collateral exit.",
};

function findHexData(error: unknown): Hex | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null;
  return revert?.raw ?? null;
}

export function describeDollarError(error: unknown): string {
  const data = findHexData(error);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: staticsDollarErrorAbi, data });
      const description = errorMessages[decoded.errorName] ?? "The protocol rejected this action.";
      return `${description} (${decoded.errorName})`;
    } catch {
      // The technical message below is retained when the revert is outside the known Dollar ABI.
    }
  }

  const message = error instanceof Error ? error.message : "The wallet request failed.";
  const known = Object.entries(errorMessages).find(([name]) => message.includes(name));
  if (known) return `${known[1]} (${known[0]})`;
  if (/rejected|denied/i.test(message)) return "The wallet request was rejected.";
  return message;
}

export function isWalletRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rejected|denied|user cancelled|user canceled|4001/i.test(message);
}

export function isOnchainRevert(error: unknown): boolean {
  if (findHexData(error)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /revert(?:ed)? onchain|transaction reverted|receipt.*revert/i.test(message);
}
