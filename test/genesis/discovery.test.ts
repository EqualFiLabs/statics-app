import { getAddress, zeroAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { discoverNextAvailableGenesisId, discoverWalletGenesisIds } from "@/lib/genesis/discovery";

const deploymentId = "local-robinhood-genesis";
const owner = getAddress("0x1111111111111111111111111111111111111111");
const genesis = getAddress("0x2222222222222222222222222222222222222222");
const vault = getAddress("0x3333333333333333333333333333333333333333");
const deployment = {
  kind: "launch",
  descriptor: {
    deploymentId,
    label: "Genesis",
    network: "Local fork",
    chainId: 4_663,
    stage: "launch",
    capabilities: [],
    available: true,
  },
  deploymentStartBlock: 1n,
  protocolCommit: "fixture",
  source: "development-fixture",
  contracts: {
    statics: zeroAddress,
    genesis,
    vault,
    activationRegistry: zeroAddress,
    feeReceiver: zeroAddress,
    launchDistributor: zeroAddress,
    weth: zeroAddress,
    poolManager: zeroAddress,
    stateView: zeroAddress,
    quoter: zeroAddress,
    universalRouter: zeroAddress,
    permit2: zeroAddress,
  },
  runtimeCodeHashes: {},
  market: {
    poolId: `0x${"1".repeat(64)}`,
    poolKey: {
      currency0: zeroAddress,
      currency1: zeroAddress,
      fee: 0,
      tickSpacing: 1,
      hooks: zeroAddress,
    },
  },
} as const satisfies LaunchDeployment;

describe("Genesis discovery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("treats an indexed sold-out response as final", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ deploymentId, tokenId: null })))
    );
    const readContract = vi.fn();
    const publicClient = { readContract } as unknown as PublicClient;

    await expect(discoverNextAvailableGenesisId(publicClient, deployment)).resolves.toBeNull();
    expect(readContract).not.toHaveBeenCalled();
  });

  it("does not scan historical logs after a successful empty wallet response", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ deploymentId, items: [], nextCursor: null }))
        )
    );
    const getLogs = vi.fn();
    const publicClient = { getLogs, readContract: vi.fn() } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([]);
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("verifies indexed ownership directly without replaying transfer history", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ deploymentId, items: [{ id: "7" }], nextCursor: null }))
        )
    );
    const getLogs = vi.fn();
    const readContract = vi.fn().mockResolvedValue(owner);
    const publicClient = { getLogs, readContract } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([7n]);
    expect(readContract).toHaveBeenCalledOnce();
    expect(getLogs).not.toHaveBeenCalled();
  });
});
