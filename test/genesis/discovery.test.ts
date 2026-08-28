import { encodeEventTopics, getAddress, zeroAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  discoverNextAvailableGenesisId,
  discoverWalletGenesisIds,
  discoverWalletGenesisSnapshot,
} from "@/lib/genesis/discovery";

const deploymentId = "local-anvil-genesis";
const owner = getAddress("0x1111111111111111111111111111111111111111");
const genesis = getAddress("0x2222222222222222222222222222222222222222");
const vault = getAddress("0x3333333333333333333333333333333333333333");
const deployment = {
  kind: "launch",
  descriptor: {
    deploymentId,
    label: "Genesis",
    network: "Local Anvil",
    chainId: 31_337,
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

  it("finds the lowest available Operator directly from the Vault", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    const readContract = vi.fn().mockImplementation(async ({ args }) => args[0] === 16n);
    const publicClient = { readContract } as unknown as PublicClient;

    await expect(discoverNextAvailableGenesisId(publicClient, deployment)).resolves.toBe(16n);
    expect(readContract).toHaveBeenCalledTimes(64);
  });

  it("does not treat a failed Vault read as unavailable inventory", async () => {
    const readContract = vi.fn().mockImplementation(async ({ args }) => {
      if (args[0] === 8n) throw new Error("RPC unavailable");
      return args[0] === 16n;
    });
    const publicClient = { readContract } as unknown as PublicClient;

    await expect(discoverNextAvailableGenesisId(publicClient, deployment)).rejects.toThrow(
      "RPC unavailable"
    );
  });

  it("does not replay history when an empty wallet snapshot is at chain head", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ active: { id: 31_337, block: { number: 10, timestamp: 100 } } })
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ deploymentId, items: [], nextCursor: null }))
        )
    );
    const getLogs = vi.fn();
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([]);
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("merges transfers after a healthy checkpoint before verifying ownership", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ active: { id: 31_337, block: { number: 10, timestamp: 100 } } })
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ deploymentId, items: [{ id: "7" }], nextCursor: null }))
        )
    );
    const getLogs = vi.fn().mockResolvedValue([
      {
        address: genesis,
        data: "0x",
        topics: encodeEventTopics({
          abi: [
            {
              type: "event",
              name: "Transfer",
              inputs: [
                { indexed: true, name: "from", type: "address" },
                { indexed: true, name: "to", type: "address" },
                { indexed: true, name: "tokenId", type: "uint256" },
              ],
            },
          ],
          eventName: "Transfer",
          args: { from: vault, to: owner, tokenId: 16n },
        }),
      },
    ]);
    const readContract = vi.fn().mockResolvedValue(owner);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(12n),
      getLogs,
      readContract,
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([
      7n,
      16n,
    ]);
    expect(readContract).toHaveBeenCalledTimes(2);
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 11n, toBlock: 12n }));
  });

  it("rejects a stale checkpoint and rebuilds wallet ownership from chain history", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ active: { id: 31_337, block: { number: 10, timestamp: 100 } } })
          )
        )
    );
    const getLogs = vi.fn().mockResolvedValue([]);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(111n),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([]);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: deployment.deploymentStartBlock, toBlock: 111n })
    );
  });

  it("does not mark an onchain fallback stale after an indexer failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("indexer unavailable")));
    const getLogs = vi.fn().mockResolvedValue([]);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(
      discoverWalletGenesisSnapshot(publicClient, deployment, owner)
    ).resolves.toMatchObject({
      ids: [],
      indexed: [],
      indexedBlock: null,
      chainHead: 10n,
      stale: false,
    });
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: deployment.deploymentStartBlock, toBlock: 10n })
    );
  });

  it("chunks the onchain ownership fallback for RPC providers with bounded log ranges", async () => {
    const getLogs = vi.fn().mockResolvedValue([]);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(50_002n),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([]);
    expect(getLogs).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fromBlock: 1n, toBlock: 50_000n })
    );
    expect(getLogs).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fromBlock: 50_001n, toBlock: 50_002n })
    );
  });
});
