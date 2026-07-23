import { encodeErrorResult, encodeFunctionResult } from "viem";
import { describe, expect, it } from "vitest";

import { staticsAbi, staticsDollarErrorAbi } from "@statics-protocol/sdk";
import {
  describeDollarError,
  isOnchainRevert,
  isWalletRejection,
  maximumWithTolerance,
  minimumWithTolerance,
  validateRecombinationSimulation,
} from "@/lib/dollar/transactions";

describe("Dollar transaction bounds", () => {
  it("rounds minimum output down and maximum Risk input up at 50 bps", () => {
    expect(minimumWithTolerance(10_001n)).toBe(9_950n);
    expect(maximumWithTolerance(10_001n)).toBe(10_052n);
  });

  it("translates known technical failures without hiding the error code", () => {
    const data = encodeErrorResult({
      abi: staticsDollarErrorAbi,
      errorName: "SharesAboveMaximum",
      args: [101n, 100n],
    });
    expect(describeDollarError(new Error(`execution reverted: SharesAboveMaximum ${data}`))).toBe(
      "The required Risk shares moved above your 0.50% tolerance. Review the new quote. (SharesAboveMaximum)"
    );
  });

  it("identifies wallet rejection separately from protocol failure", () => {
    expect(describeDollarError(new Error("User rejected the request."))).toBe(
      "The wallet request was rejected."
    );
    expect(isWalletRejection(new Error("User denied transaction signature"))).toBe(true);
    expect(isOnchainRevert(new Error("The transaction reverted onchain."))).toBe(true);
  });

  it("refuses a successful no-op recombination simulation", () => {
    const unavailable = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "recombineToWETH",
      result: [2, 0n],
    });
    expect(() => validateRecombinationSimulation("recombineToWETH", unavailable)).toThrow(
      "CollateralExitUnavailable"
    );

    const available = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "recombineToWETH",
      result: [0, 100n],
    });
    expect(validateRecombinationSimulation("recombineToWETH", available)).toBe(100n);
  });
});
