import { describe, expect, it } from "vitest";

import { readDollarDeployment } from "@/lib/dollar/deployment";

const address = "0x0000000000000000000000000000000000000001";
const hash = `0x${"11".repeat(32)}`;

function localDeploymentEnvironment() {
  return {
    NEXT_PUBLIC_APP_ENV: "development",
    NEXT_PUBLIC_STATICS_CHAIN_ID: "31337",
    NEXT_PUBLIC_STATICS_DEPLOYMENT_START_BLOCK: "1",
    NEXT_PUBLIC_STATICS_DIAMOND_ADDRESS: address,
    NEXT_PUBLIC_STATICS_DOLLAR_CORE_ADDRESS: address,
    NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_ADDRESS: address,
    NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_ADDRESS: address,
    NEXT_PUBLIC_STATICS_DOLLAR_RISK_ADDRESS: address,
    NEXT_PUBLIC_STATICS_WETH_ADDRESS: address,
    NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_ADDRESS: address,
    NEXT_PUBLIC_STATICS_WETH_PROFILE_ID: "1",
    NEXT_PUBLIC_STATICS_PROTOCOL_COMMIT: "a".repeat(40),
    NEXT_PUBLIC_STATICS_DIAMOND_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_DOLLAR_CORE_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_DOLLAR_RISK_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_WETH_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_CODE_HASH: hash,
  };
}

describe("Dollar deployment configuration", () => {
  it("is honestly unavailable when no deployment exists", () => {
    expect(readDollarDeployment({})).toEqual({
      status: "unavailable",
      reason: "No verified Statics Dollar deployment is configured.",
    });
  });

  it("accepts complete code-bound Anvil configuration", () => {
    const state = readDollarDeployment(localDeploymentEnvironment());
    expect(state.status).toBe("configured");
    if (state.status === "configured") {
      expect(state.deployment.chainId).toBe(31_337);
      expect(state.deployment.deploymentStartBlock).toBe(1n);
      expect(state.deployment.wethProfileId).toBe(1n);
      expect(state.deployment.runtimeCodeHashes.gateway).toBe(hash);
    }
  });

  it("rejects environment-generated public deployments", () => {
    expect(() =>
      readDollarDeployment({
        ...localDeploymentEnvironment(),
        NEXT_PUBLIC_STATICS_CHAIN_ID: "46630",
      })
    ).toThrow("restricted to local Anvil");
  });

  it("requires a checked-in manifest outside development", () => {
    expect(() =>
      readDollarDeployment({
        ...localDeploymentEnvironment(),
        NEXT_PUBLIC_APP_ENV: "production",
      })
    ).toThrow("checked-in verified manifest");
  });
});
