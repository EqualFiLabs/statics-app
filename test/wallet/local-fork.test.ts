import { getAddress, keccak256, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

import { v4PoolId } from "@statics-protocol/sdk";

import { parseLaunchDeploymentManifest } from "@/lib/deployments/launch-manifest";
import { localForkWalletProvider, verifyLocalForkWalletProvider } from "@/lib/wallet/local-fork";

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

  it("rejects a mainnet wallet endpoint when the fork shares its chain ID", async () => {
    const fixture = deployment("0x6001600055");
    const fork = { ...fixture, descriptor: { ...fixture.descriptor, chainId: 4_663 } };
    const request = vi.fn().mockResolvedValueOnce("0x1237").mockResolvedValueOnce("Arbitrum/v1");
    await expect(verifyLocalForkWalletProvider({ request }, fork)).rejects.toThrow(
      "Point your wallet's Robinhood RPC"
    );
    const localRequest = vi
      .fn()
      .mockResolvedValueOnce("0x1237")
      .mockResolvedValueOnce("anvil/v1.8.2");
    await expect(
      verifyLocalForkWalletProvider({ request: localRequest }, fork)
    ).resolves.toBeUndefined();
    expect(localRequest).toHaveBeenCalledWith({ method: "web3_clientVersion" });
  });

  it("preserves Funding Portal writes on other chains", async () => {
    const fixture = deployment("0x6001600055");
    const fork = { source: fixture.source, descriptor: { ...fixture.descriptor, chainId: 4_663 } };
    const request = vi.fn();
    await expect(verifyLocalForkWalletProvider({ request }, fork, 8_453)).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("checks Phase 1-only local options using their common deployment identity", async () => {
    const fixture = deployment("0x6001600055");
    const fork = {
      source: fixture.source,
      descriptor: { ...fixture.descriptor, chainId: 4_663, stage: "phase-one" as const },
    };
    const request = vi.fn().mockResolvedValueOnce("0x1237").mockResolvedValueOnce("Arbitrum/v1");
    await expect(verifyLocalForkWalletProvider({ request }, fork, 4_663)).rejects.toThrow(
      "Point your wallet's Robinhood RPC"
    );
  });

  it("reads balances from the fork without auditing the wallet and refuses mainnet signing", async () => {
    const fixture = deployment("0x6001600055");
    const fork = { source: fixture.source, descriptor: { ...fixture.descriptor, chainId: 4_663 } };
    const request = vi.fn().mockImplementation(async ({ method }) => {
      if (method === "eth_chainId") return "0x1237";
      if (method === "web3_clientVersion") return "Arbitrum/v1";
      if (method === "eth_accounts") return [address("e")];
      throw new Error("Unexpected wallet method");
    });
    const fetch = vi.fn().mockImplementation(async (_url, init) => {
      const input = JSON.parse(init.body);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: input.id, result: "0x10" }));
    });
    vi.stubGlobal("fetch", fetch);
    try {
      const provider = localForkWalletProvider({ request }, fork, "http://127.0.0.1:8663");
      expect(
        await provider.request({ method: "eth_getBalance", params: [address("e"), "latest"] })
      ).toBe("0x10");
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8663/", expect.anything());
      expect(request).not.toHaveBeenCalled();
      expect(await provider.request({ method: "eth_accounts" })).toEqual([address("e")]);
      await expect(
        provider.request({ method: "eth_sendTransaction", params: [{ to: address("e") }] })
      ).rejects.toThrow("Point your wallet's Robinhood RPC");
      expect(request).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: "eth_sendTransaction" })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
