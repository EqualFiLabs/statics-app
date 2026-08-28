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

const GENESIS_SUPPLY = 5_555n;
const DISCOVERY_BATCH = 64n;
const DISCOVERY_LOG_CHUNK = 50_000n;
const MAX_INDEXER_BLOCK_LAG = 100n;

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
  if (indexerUrl) {
    try {
      const indexed = await loadNextAvailableGenesisId(
        deployment.descriptor.deploymentId,
        indexerUrl
      );
      // A null or stale indexer response must never make the UI claim that the
      // vault is exhausted. Verify the candidate and fall through to the
      // authoritative scan when the snapshot cannot prove availability.
      if (
        indexed !== null &&
        (await publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisVaultAbi,
          functionName: "isVaultInventory",
          args: [indexed],
        }))
      ) {
        return indexed;
      }
    } catch {
      // A degraded indexer is a discovery optimization only. The onchain scan
      // below remains the correctness fallback.
    }
  }
  for (let start = 1n; start <= GENESIS_SUPPLY; start += DISCOVERY_BATCH) {
    const end = start + DISCOVERY_BATCH - 1n;
    const ids = Array.from(
      { length: Number((end < GENESIS_SUPPLY ? end : GENESIS_SUPPLY) - start + 1n) },
      (_, index) => start + BigInt(index)
    );
    const results = await Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisVaultAbi,
          functionName: "isVaultInventory",
          args: [id],
        })
      )
    );
    const availableIndex = results.findIndex(Boolean);
    if (availableIndex >= 0) return ids[availableIndex]!;
  }
  return null;
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
  let ids: bigint[] | null = null;
  let indexed: readonly IndexedLaunchGenesis[] = [];
  let indexedBlock: bigint | null = null;
  let chainHead: bigint | null = null;
  let stale = false;
  const indexerUrl = configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId);
  if (indexerUrl) {
    try {
      const checkpoint = await loadIndexerCheckpoint(
        deployment.descriptor.chainId,
        deployment.descriptor.deploymentId,
        indexerUrl
      );
      chainHead = await publicClient.getBlockNumber();
      indexedBlock = checkpoint.blockNumber;
      stale =
        checkpoint.blockNumber > chainHead ||
        chainHead - checkpoint.blockNumber > MAX_INDEXER_BLOCK_LAG;
      if (stale) throw new Error("The Statics indexer is too far behind the selected chain.");
      const [indexedItems, recentIds] = await Promise.all([
        loadWalletLaunchGenesisItems(owner, deployment.descriptor.deploymentId, indexerUrl),
        loadIncomingGenesisIds(
          publicClient,
          deployment,
          owner,
          checkpoint.blockNumber + 1n,
          chainHead
        ),
      ]);
      indexed = indexedItems;
      ids = [...new Set([...indexedItems.map((item) => item.id), ...recentIds].map(String))].map(
        BigInt
      );
    } catch {
      // An unavailable, invalid, or stale indexer falls through to chain history.
      stale = true;
    }
  }
  if (ids === null) {
    chainHead ??= await publicClient.getBlockNumber();
    ids = await loadIncomingGenesisIds(
      publicClient,
      deployment,
      owner,
      deployment.deploymentStartBlock,
      chainHead
    );
  }
  const current = await Promise.all(
    ids.map((id) =>
      publicClient
        .readContract({
          address: deployment.contracts.genesis,
          abi: staticsGenesisAbi,
          functionName: "ownerOf",
          args: [id],
        })
        .catch(() => null)
    )
  );
  const ownedIds = ids.filter(
    (_, index) =>
      current[index] !== null && String(current[index]).toLowerCase() === owner.toLowerCase()
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
