import { keccak256 } from "viem";
import { describe, expect, it } from "vitest";

import { readDollarDeployment, verifyLiquidityDeployment } from "@/lib/dollar/deployment";

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

function liquidityDeploymentEnvironment() {
  return {
    NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS: address,
    NEXT_PUBLIC_STATICS_POSITION_MANAGER_ADDRESS: address,
    NEXT_PUBLIC_STATICS_PERMIT2_ADDRESS: address,
    NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_ADDRESS: address,
    NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_ADDRESS: address,
    NEXT_PUBLIC_STATICS_STATE_VIEW_ADDRESS: address,
    NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH: hash,
    NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH: hash,
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
    const state = readDollarDeployment({
      ...localDeploymentEnvironment(),
      ...liquidityDeploymentEnvironment(),
    });
    expect(state.status).toBe("configured");
    if (state.status === "configured") {
      expect(state.deployment.chainId).toBe(31_337);
      expect(state.deployment.deploymentStartBlock).toBe(1n);
      expect(state.deployment.wethProfileId).toBe(1n);
      expect(state.deployment.runtimeCodeHashes.gateway).toBe(hash);
      expect(state.deployment.liquidity?.contracts.stateView).toBe(address);
    }
  });

  it("rejects a partial liquidity deployment", () => {
    expect(() =>
      readDollarDeployment({
        ...localDeploymentEnvironment(),
        NEXT_PUBLIC_STATICS_POOL_MANAGER_ADDRESS: address,
      })
    ).toThrow("Liquidity deployment configuration must be complete or omitted.");
  });

  it("accepts only a complete code-bound pegged USDG profile", () => {
    const state = readDollarDeployment({
      ...localDeploymentEnvironment(),
      NEXT_PUBLIC_STATICS_USDG_ADDRESS: address,
      NEXT_PUBLIC_STATICS_USDG_ORACLE_ADDRESS: address,
      NEXT_PUBLIC_STATICS_USDG_PROFILE_ID: "2",
      NEXT_PUBLIC_STATICS_USDG_CODE_HASH: hash,
      NEXT_PUBLIC_STATICS_USDG_ORACLE_CODE_HASH: hash,
    });
    expect(state.status).toBe("configured");
    if (state.status === "configured") {
      expect(state.deployment.pegged?.profileId).toBe(2n);
      expect(state.deployment.pegged?.collateral).toBe(address);
    }
    expect(() =>
      readDollarDeployment({
        ...localDeploymentEnvironment(),
        NEXT_PUBLIC_STATICS_USDG_ADDRESS: address,
      })
    ).toThrow("Pegged USDG deployment configuration must be complete or omitted.");
  });

  it("verifies every liquidity runtime hash", async () => {
    const state = readDollarDeployment({
      ...localDeploymentEnvironment(),
      ...liquidityDeploymentEnvironment(),
    });
    if (state.status !== "configured") throw new Error("expected configured deployment");

    const publicClient = {
      getCode: async () => "0x6000",
    };
    await expect(
      verifyLiquidityDeployment(publicClient as never, state.deployment)
    ).rejects.toThrow("runtime code does not match");
  });

  it("rejects liquidity contracts bound to a different PoolManager", async () => {
    const runtimeCodeHash = keccak256("0x6000");
    const environment = {
      ...localDeploymentEnvironment(),
      ...liquidityDeploymentEnvironment(),
      NEXT_PUBLIC_STATICS_DIAMOND_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_DOLLAR_CORE_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_DOLLAR_GATEWAY_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_DOLLAR_TOKEN_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_DOLLAR_RISK_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_WETH_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_DOLLAR_ORACLE_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_POOL_MANAGER_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_POSITION_MANAGER_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_PERMIT2_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_SWAP_FEE_HOOK_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_LIQUIDITY_MANAGER_CODE_HASH: runtimeCodeHash,
      NEXT_PUBLIC_STATICS_STATE_VIEW_CODE_HASH: runtimeCodeHash,
    };
    const state = readDollarDeployment(environment);
    if (state.status !== "configured") throw new Error("expected configured deployment");

    const publicClient = {
      getCode: async () => "0x6000",
      readContract: async ({ functionName }: { functionName: string }) =>
        functionName === "poolManager" ? "0x0000000000000000000000000000000000000002" : address,
    };

    await expect(
      verifyLiquidityDeployment(publicClient as never, state.deployment)
    ).rejects.toThrow("bound to a different PoolManager");
  });

  it("does not let environment values replace the reviewed public deployment", () => {
    const state = readDollarDeployment({
      ...localDeploymentEnvironment(),
      NEXT_PUBLIC_STATICS_CHAIN_ID: "46630",
    });

    expect(state.status).toBe("configured");
    if (state.status === "configured") {
      expect(state.deployment.source).toBe("checked-in-manifest");
      expect(state.deployment.contracts.diamond).not.toBe(address);
    }
  });

  it("requires a checked-in manifest outside development", () => {
    const state = readDollarDeployment({
      ...localDeploymentEnvironment(),
      NEXT_PUBLIC_APP_ENV: "production",
    });

    expect(state.status).toBe("unavailable");
    expect(state.status === "unavailable" && state.reason).toMatch(/manifest/);
  });
});
