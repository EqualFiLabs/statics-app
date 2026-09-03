import { getAddress, parseEventLogs, type Address, type PublicClient } from "viem";

import { staticsGenesisAbi, staticsGenesisVaultAbi } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  configuredIndexerUrlForDeployment,
  loadIndexerCheckpoint,
  loadNextAvailableGenesisId,
  loadWalletLaunchGenesisItems,
} from "@/lib/indexer/statics";
import type { IndexedLaunchGenesis } from "@/lib/indexer/statics";

const DISCOVERY_LOG_CHUNK = 5_000n;
export const MAX_GENESIS_RECONCILIATION_BLOCKS = 50_000n;

const genesisTransferEvent = staticsGenesisAbi.find(
  (entry) => entry.type === "event" && entry.name === "Transfer"
) as Extract<(typeof staticsGenesisAbi)[number], { type: "event"; name: "Transfer" }>;

async function loadIncomingGenesisIds(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  owner: Address,
  fromBlock: bigint,
  latestBlock: bigint
): Promise<bigint[]> {
  if (fromBlock > latestBlock) return [];
  if (latestBlock - fromBlock + 1n > MAX_GENESIS_RECONCILIATION_BLOCKS) {
    throw new Error("The Operator reconciliation range exceeds its browser RPC bound.");
  }
  const ids = new Set<string>();
  for (let start = fromBlock; start <= latestBlock; start += DISCOVERY_LOG_CHUNK) {
    const end = start + DISCOVERY_LOG_CHUNK - 1n;
    const logs = await publicClient.getLogs({
      address: deployment.contracts.genesis,
      event: genesisTransferEvent,
      args: { to: getAddress(owner) },
      fromBlock: start,
      toBlock: end < latestBlock ? end : latestBlock,
    });
    for (const log of parseEventLogs({ abi: staticsGenesisAbi, logs, eventName: "Transfer" })) {
      ids.add(String(log.args.tokenId));
    }
  }
  return [...ids].map(BigInt);
}

export async function discoverNextAvailableGenesisId(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<bigint | null> {
  const indexerUrl = configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId);
  if (!indexerUrl) throw new Error("Operator inventory indexing is unavailable.");
  const [indexed, checkpoint, chainHead] = await Promise.all([
    loadNextAvailableGenesisId(deployment.descriptor.deploymentId, indexerUrl),
    loadIndexerCheckpoint(
      deployment.descriptor.chainId,
      deployment.descriptor.deploymentId,
      indexerUrl
    ),
    publicClient.getBlockNumber(),
  ]);
  if (checkpoint.blockNumber > chainHead) {
    throw new Error("Operator inventory data is still syncing.");
  }
  if (indexed === null) {
    if (checkpoint.blockNumber < chainHead) {
      throw new Error("Operator inventory data is still syncing.");
    }
    return null;
  }
  const available = await publicClient.readContract({
    address: deployment.contracts.vault,
    abi: staticsGenesisVaultAbi,
    functionName: "isVaultInventory",
    args: [indexed],
  });
  if (!available) throw new Error("The indexed Operator inventory changed. Try again shortly.");
  return indexed;
}

export type GenesisDiscoverySnapshot = Readonly<{
  ids: readonly bigint[];
  indexed: readonly IndexedLaunchGenesis[];
  indexedBlock: bigint | null;
  chainHead: bigint | null;
  stale: boolean;
}>;

/**
 * Returns the wallet snapshot plus its freshness boundary. IDs are still
 * checked against current ownerOf state, while indexed fields are retained so
 * callers do not repeat reads that Ponder already materialized.
 */
export async function discoverWalletGenesisSnapshot(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  owner: Address
): Promise<GenesisDiscoverySnapshot> {
  let recentIds: readonly bigint[] = [];
  let indexedBlock: bigint | null = null;
  const indexerUrl = configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId);
  if (!indexerUrl) throw new Error("Operator ownership indexing is unavailable.");

  const [indexedResult, checkpointResult, chainHeadResult] = await Promise.allSettled([
    loadWalletLaunchGenesisItems(owner, deployment.descriptor.deploymentId, indexerUrl),
    loadIndexerCheckpoint(
      deployment.descriptor.chainId,
      deployment.descriptor.deploymentId,
      indexerUrl
    ),
    publicClient.getBlockNumber(),
  ]);
  if (indexedResult.status === "rejected") throw indexedResult.reason;
  if (chainHeadResult.status === "rejected") throw chainHeadResult.reason;

  const indexed = indexedResult.value;
  const chainHead = chainHeadResult.value;
  let stale = checkpointResult.status === "rejected";
  if (checkpointResult.status === "fulfilled") {
    const checkpoint = checkpointResult.value;
    indexedBlock = checkpoint.blockNumber;
    if (checkpoint.blockNumber > chainHead) {
      stale = true;
    } else {
      const lag = chainHead - checkpoint.blockNumber;
      stale = lag > 0n;
      if (lag > 0n && lag <= MAX_GENESIS_RECONCILIATION_BLOCKS) {
        try {
          recentIds = await loadIncomingGenesisIds(
            publicClient,
            deployment,
            owner,
            checkpoint.blockNumber + 1n,
            chainHead
          );
        } catch {
          // Keep the last indexed snapshot visible. The stale marker tells the
          // UI it may not include transfers that occurred after the checkpoint.
          stale = true;
        }
      }
    }
  }

  const ids = [...new Set([...indexed.map((item) => item.id), ...recentIds].map(String))].map(
    BigInt
  );
  const current = await Promise.all(
    ids.map((id) =>
      publicClient.readContract({
        address: deployment.contracts.genesis,
        abi: staticsGenesisAbi,
        functionName: "ownerOf",
        args: [id],
      })
    )
  );
  const ownedIds = ids.filter(
    (_, index) => String(current[index]).toLowerCase() === owner.toLowerCase()
  );
  const ownedSet = new Set(ownedIds.map(String));
  return {
    ids: ownedIds,
    indexed: indexed.filter((item) => ownedSet.has(item.id.toString())),
    indexedBlock,
    chainHead,
    stale,
  };
}

export async function discoverWalletGenesisIds(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  owner: Address
): Promise<bigint[]> {
  return [...(await discoverWalletGenesisSnapshot(publicClient, deployment, owner)).ids];
}
