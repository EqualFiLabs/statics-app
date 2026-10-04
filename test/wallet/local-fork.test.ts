import { getAddress, keccak256, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

import { v4PoolId } from "@statics-protocol/sdk";

import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
import { verifyLocalForkWalletProvider } from "@/lib/wallet/local-fork";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);

function deployment(staticsCode: `0x${string}`) {
  const contracts = {
    statics: { address: address("1"), runtimeCodeHash: keccak256(staticsCode) },
    genesis: { address: address("2") },
    vault: { address: address("3") },
    activationRegistry: { address: address("4") },
    feeReceiver: { address: address("5") },
    launchDistributor: { address: address("6") },
    weth: { address: address("7") },
    poolManager: { address: address("8") },
    stateView: { address: address("9") },
    quoter: { address: address("a") },
    universalRouter: { address: address("b") },
    permit2: { address: address("c") },
  } as const;
  const poolKey = {
    currency0: contracts.statics.address,
    currency1: contracts.weth.address,
    fee: 30_000,
    tickSpacing: 100,
    hooks: zeroAddress,
  } as const;
  return parseLaunchDeploymentManifest(
    {
      schemaVersion: 1,
      deploymentId: "local-anvil-genesis",
      network: "Local Anvil",
      chainId: 31_337,
      deploymentStartBlock: "1",
      protocolCommit: "abc",
      contracts,
      market: { poolId: v4PoolId(poolKey), poolKey },
    },
    "development-fixture"
  );
}

describe("local fork wallet provider", () => {
  it("checks the selected local chain without reading bytecode", async () => {
    const code = "0x6001600055" as const;
    const request = vi.fn().mockResolvedValueOnce("0x7a69").mockResolvedValueOnce(code);
    await expect(
      verifyLocalForkWalletProvider({ request }, deployment(code))
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ method: "eth_chainId" });
  });

  it("rejects a provider connected to a different chain", async () => {
    const request = vi.fn().mockResolvedValueOnce("0x1237");
    await expect(
      verifyLocalForkWalletProvider({ request }, deployment("0x6001600055"))
    ).rejects.toThrow("not connected to Local Anvil");
  });
});
