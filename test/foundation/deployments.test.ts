import { getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";

import { v4PoolId } from "@statics-protocol/sdk";

import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
import {
  LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID,
  ROBINHOOD_GENESIS_DEPLOYMENT_ID,
  ROBINHOOD_TESTNET_PROTOCOL_DEPLOYMENT_ID,
  defaultDeploymentId,
  deploymentRegistry,
  hasCapability,
} from "@/lib/deployments/registry";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

function launchManifest() {
  const contracts = {
    statics: { address: address("1"), runtimeCodeHash: hash("1") },
    genesis: { address: address("2"), runtimeCodeHash: hash("2") },
    vault: { address: address("3"), runtimeCodeHash: hash("3") },
    activationRegistry: { address: address("4"), runtimeCodeHash: hash("4") },
    feeReceiver: { address: address("5"), runtimeCodeHash: hash("5") },
    launchDistributor: { address: address("6"), runtimeCodeHash: hash("6") },
    weth: { address: address("7"), runtimeCodeHash: hash("7") },
    poolManager: { address: address("8"), runtimeCodeHash: hash("8") },
    stateView: { address: address("9"), runtimeCodeHash: hash("9") },
    quoter: { address: address("a"), runtimeCodeHash: hash("a") },
    universalRouter: { address: address("b"), runtimeCodeHash: hash("b") },
    permit2: { address: address("c"), runtimeCodeHash: hash("c") },
  } as const;
  const poolKey = {
    currency0: contracts.statics.address,
    currency1: contracts.weth.address,
    fee: 10_000,
    tickSpacing: 8,
    hooks: zeroAddress,
  } as const;
  return {
    schemaVersion: 1 as const,
    deploymentId: ROBINHOOD_GENESIS_DEPLOYMENT_ID,
    network: "Robinhood Chain",
    chainId: 4_663,
    deploymentStartBlock: "123",
    protocolCommit: "abc",
    contracts,
    market: {
      poolId: v4PoolId(poolKey),
      poolKey,
    },
  };
}

describe("deployment registry", () => {
  it("defaults production to Genesis and local development to the testnet protocol", () => {
    expect(defaultDeploymentId("production")).toBe(ROBINHOOD_GENESIS_DEPLOYMENT_ID);
    expect(defaultDeploymentId("development")).toBe(ROBINHOOD_TESTNET_PROTOCOL_DEPLOYMENT_ID);
    expect(defaultDeploymentId("development", "robinhood-fork")).toBe(
      LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID
    );
  });

  it("loads a complete local launch manifest only in explicit development fork mode", () => {
    const local = {
      ...launchManifest(),
      deploymentId: LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID,
      network: "Local Robinhood fork",
    };
    const environment = {
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_APP_NETWORK: "robinhood-fork",
      NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST: JSON.stringify(local),
    };
    const [fixture, mainnet, testnet] = deploymentRegistry(environment);
    expect(fixture?.deployment?.kind).toBe("launch");
    if (fixture?.deployment?.kind !== "launch") throw new Error("Expected a launch fixture.");
    expect(fixture.deployment.source).toBe("development-fixture");
    expect(fixture?.descriptor.deploymentId).toBe(LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID);
    expect(mainnet?.descriptor.available).toBe(false);
    expect(testnet?.descriptor.chainId).toBe(46_630);

    expect(() => deploymentRegistry({ ...environment, NEXT_PUBLIC_APP_ENV: "production" })).toThrow(
      "only allowed in development"
    );
  });

  it("rejects incomplete local runtime identity", () => {
    const local = launchManifest();
    const incomplete = {
      ...local,
      deploymentId: LOCAL_ROBINHOOD_GENESIS_DEPLOYMENT_ID,
      contracts: {
        ...local.contracts,
        statics: { address: local.contracts.statics.address },
      },
    };
    expect(() =>
      deploymentRegistry({
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_NETWORK: "robinhood-fork",
        NEXT_PUBLIC_STATICS_LOCAL_LAUNCH_MANIFEST: JSON.stringify(incomplete),
      })
    ).toThrow("Every local launch contract requires a runtime code hash");
  });

  it("keeps mainnet unavailable until a reviewed manifest is checked in", () => {
    const [mainnet, testnet] = deploymentRegistry();
    expect(mainnet?.descriptor.available).toBe(false);
    expect(mainnet?.deployment).toBeNull();
    expect(testnet?.descriptor.chainId).toBe(46_630);
    expect(hasCapability(testnet!.descriptor, "faucet")).toBe(true);
  });

  it("parses a canonical launch market and rejects a mismatched pair", () => {
    const deployment = parseLaunchDeploymentManifest(launchManifest(), "development-fixture");
    expect(deployment.kind).toBe("launch");
    expect(deployment.market.poolKey.currency0).toBe(deployment.contracts.statics);
    expect(hasCapability(deployment, "genesis-launch-rewards")).toBe(true);

    const invalid = launchManifest();
    expect(() =>
      parseLaunchDeploymentManifest({
        ...invalid,
        market: {
          ...invalid.market,
          poolKey: { ...invalid.market.poolKey, currency1: address("e") },
        },
      })
    ).toThrow("STATICS/WETH");
  });
});
