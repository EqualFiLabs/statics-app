import { decodeFunctionResult, type Hex } from "viem";

import { staticsAbi } from "@statics-protocol/sdk";

export function validatePeggedMintSimulation(result: Hex | undefined) {
  if (!result) throw new Error("The pegged mint simulation returned no result.");
  const collateralIn = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "mintPegged",
    data: result,
  });
  if (collateralIn <= 0n) throw new Error("The pegged mint simulation returned zero collateral.");
  return collateralIn;
}

export function validatePeggedRedemptionSimulation(result: Hex | undefined) {
  if (!result) throw new Error("The pegged redemption simulation returned no result.");
  const [status, collateralOut] = decodeFunctionResult({
    abi: staticsAbi,
    functionName: "redeemPegged",
    data: result,
  });
  if (status !== 0) {
    throw new Error(`CollateralExitUnavailable: simulated exit status ${status.toString()}.`);
  }
  if (collateralOut <= 0n) {
    throw new Error("The pegged redemption simulation returned zero collateral.");
  }
  return collateralOut;
}
