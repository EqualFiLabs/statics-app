import { describe, expect, it } from "vitest";
import { encodeFunctionResult } from "viem";

import { staticsAbi } from "@statics-protocol/sdk";

import {
  validatePeggedMintSimulation,
  validatePeggedRedemptionSimulation,
} from "@/lib/dollar/pegged";

describe("pegged Dollar transaction validation", () => {
  it("accepts nonzero mint collateral results", () => {
    const result = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "mintPegged",
      result: 1_005_000n,
    });
    expect(validatePeggedMintSimulation(result)).toBe(1_005_000n);
  });

  it("requires an available, nonzero redemption result", () => {
    const available = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "redeemPegged",
      result: [0, 993_000n],
    });
    expect(validatePeggedRedemptionSimulation(available)).toBe(993_000n);

    const impaired = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "redeemPegged",
      result: [1, 0n],
    });
    expect(() => validatePeggedRedemptionSimulation(impaired)).toThrow(/CollateralExitUnavailable/);
  });
});
