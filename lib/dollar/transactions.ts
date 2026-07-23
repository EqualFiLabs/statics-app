import { BaseError, ContractFunctionRevertedError, decodeErrorResult, type Hex } from "viem";

import { staticsDollarErrorAbi } from "@statics-protocol/sdk";

export const DOLLAR_SLIPPAGE_BPS = 50n;
const BPS = 10_000n;

export function minimumWithTolerance(amount: bigint): bigint {
  return (amount * (BPS - DOLLAR_SLIPPAGE_BPS)) / BPS;
}

export function maximumWithTolerance(amount: bigint): bigint {
  return amount === 0n ? 0n : (amount * (BPS + DOLLAR_SLIPPAGE_BPS) - 1n) / BPS + 1n;
}

const errorMessages: Readonly<Record<string, string>> = {
  ZeroAmount: "Enter an amount greater than zero.",
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
      return errorMessages[decoded.errorName] ?? `Transaction reverted: ${decoded.errorName}.`;
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
