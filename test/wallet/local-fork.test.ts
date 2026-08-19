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
      deploymentId: "local-robinhood-genesis",
      network: "Local Robinhood fork",
      chainId: 4_663,
      deploymentStartBlock: "1",
      protocolCommit: "abc",
      contracts,
      market: { poolId: v4PoolId(poolKey), poolKey },
    },
    "development-fixture"
  );
}

describe("local fork wallet provider", () => {
  it("accepts the signer provider only when it sees the local runtime", async () => {
    const code = "0x6001600055" as const;
    const request = vi.fn().mockResolvedValueOnce("0x1237").mockResolvedValueOnce(code);
    await expect(
      verifyLocalForkWalletProvider({ request }, deployment(code))
    ).resolves.toBeUndefined();
  });

  it("rejects a same-chain provider that cannot see the fork deployment", async () => {
    const request = vi.fn().mockResolvedValueOnce("0x1237").mockResolvedValueOnce("0x");
    await expect(
      verifyLocalForkWalletProvider({ request }, deployment("0x6001600055"))
    ).rejects.toThrow("public Robinhood instead of this local fork");
  });
});
