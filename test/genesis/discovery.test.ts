import { encodeEventTopics, getAddress, zeroAddress, type PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  MAX_GENESIS_RECONCILIATION_BLOCKS,
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

function indexedResponses({
  checkpoint = 10,
  items = [],
  next = "16",
}: {
  checkpoint?: number;
  items?: readonly Record<string, unknown>[];
  next?: string | null;
} = {}) {
  return vi.fn().mockImplementation(async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith("/status")) {
      return new Response(
        JSON.stringify({ active: { id: 31_337, block: { number: checkpoint, timestamp: 100 } } })
      );
    }
    if (url.endsWith("/genesis/next-available")) {
      return new Response(JSON.stringify({ deploymentId, tokenId: next }));
    }
    if (url.includes(`/wallets/${owner}/genesis`)) {
      return new Response(JSON.stringify({ deploymentId, items, nextCursor: null }));
    }
    throw new Error(`Unexpected indexer URL ${url}`);
  });
}

function incomingTransfer(tokenId: bigint) {
  return {
    address: genesis,
    data: "0x" as const,
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
      args: { from: vault, to: owner, tokenId },
    }),
  };
}

describe("Genesis discovery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a fresh indexed inventory candidate after one Vault check", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal("fetch", indexedResponses());
    const readContract = vi.fn().mockResolvedValue(true);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      readContract,
    } as unknown as PublicClient;

    await expect(discoverNextAvailableGenesisId(publicClient, deployment)).resolves.toBe(16n);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "isVaultInventory", args: [16n] })
    );
  });

  it("does not scan Vault inventory when the indexer checkpoint is stale", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal("fetch", indexedResponses({ checkpoint: 10 }));
    const readContract = vi.fn();
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(111n),
      readContract,
    } as unknown as PublicClient;

    await expect(discoverNextAvailableGenesisId(publicClient, deployment)).rejects.toThrow(
      "inventory data is still syncing"
    );
    expect(readContract).not.toHaveBeenCalled();
  });

  it("does not claim exhaustion from a stale null inventory snapshot", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal("fetch", indexedResponses({ checkpoint: 10, next: null }));
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(111n),
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverNextAvailableGenesisId(publicClient, deployment)).rejects.toThrow(
      "inventory data is still syncing"
    );
  });

  it("does not replay history when an empty wallet snapshot is at chain head", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal("fetch", indexedResponses());
    const getLogs = vi.fn();
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisSnapshot(publicClient, deployment, owner)).resolves.toEqual({
      ids: [],
      indexed: [],
      indexedBlock: 10n,
      chainHead: 10n,
      stale: false,
    });
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("reconciles an observed 11,000-block lag with exactly one log request", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      indexedResponses({
        checkpoint: 10,
        items: [{ id: "7", updatedAtBlock: "10" }],
      })
    );
    const getLogs = vi.fn().mockResolvedValue([incomingTransfer(16n)]);
    const readContract = vi.fn().mockResolvedValue(owner);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(11_010n),
      getLogs,
      readContract,
    } as unknown as PublicClient;

    await expect(
      discoverWalletGenesisSnapshot(publicClient, deployment, owner)
    ).resolves.toMatchObject({
      ids: [7n, 16n],
      indexedBlock: 10n,
      chainHead: 11_010n,
      stale: true,
    });
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 11n, toBlock: 11_010n })
    );
  });

  it("allows exactly one 50,000-block reconciliation request", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal("fetch", indexedResponses({ checkpoint: 10 }));
    const getLogs = vi.fn().mockResolvedValue([]);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n + MAX_GENESIS_RECONCILIATION_BLOCKS),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).resolves.toEqual([]);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it("uses stale indexed holdings without log replay beyond the reconciliation bound", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      indexedResponses({ checkpoint: 10, items: [{ id: "7", updatedAtBlock: "10" }] })
    );
    const getLogs = vi.fn();
    const readContract = vi.fn().mockResolvedValue(owner);
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n + MAX_GENESIS_RECONCILIATION_BLOCKS + 1n),
      getLogs,
      readContract,
    } as unknown as PublicClient;

    await expect(
      discoverWalletGenesisSnapshot(publicClient, deployment, owner)
    ).resolves.toMatchObject({
      ids: [7n],
      indexedBlock: 10n,
      stale: true,
    });
    expect(getLogs).not.toHaveBeenCalled();
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("keeps an indexed snapshot stale when recent log reconciliation fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      indexedResponses({ checkpoint: 10, items: [{ id: "7", updatedAtBlock: "10" }] })
    );
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(12n),
      getLogs: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
      readContract: vi.fn().mockResolvedValue(owner),
    } as unknown as PublicClient;

    await expect(
      discoverWalletGenesisSnapshot(publicClient, deployment, owner)
    ).resolves.toMatchObject({ ids: [7n], stale: true });
  });

  it("fails instead of presenting an empty wallet when ownership cannot be revalidated", async () => {
    vi.stubEnv("NEXT_PUBLIC_STATICS_LOCAL_INDEXER_URL", "https://indexer.example");
    vi.stubGlobal(
      "fetch",
      indexedResponses({ checkpoint: 10, items: [{ id: "7", updatedAtBlock: "10" }] })
    );
    const getLogs = vi.fn();
    const publicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      getLogs,
      readContract: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).rejects.toThrow(
      "RPC unavailable"
    );
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("requires an indexer instead of scanning from the deployment block", async () => {
    const getLogs = vi.fn();
    const publicClient = {
      getBlockNumber: vi.fn(),
      getLogs,
      readContract: vi.fn(),
    } as unknown as PublicClient;

    await expect(discoverWalletGenesisIds(publicClient, deployment, owner)).rejects.toThrow(
      "ownership indexing is unavailable"
    );
    expect(getLogs).not.toHaveBeenCalled();
  });
});
