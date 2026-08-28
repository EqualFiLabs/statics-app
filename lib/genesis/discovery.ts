import { getAddress, parseEventLogs, type Address, type PublicClient } from "viem";

import { staticsGenesisAbi, staticsGenesisVaultAbi } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  configuredIndexerUrlForDeployment,
  loadIndexerCheckpoint,
  loadWalletLaunchGenesisIds,
} from "@/lib/indexer/statics";

const GENESIS_SUPPLY = 5_555n;
const DISCOVERY_BATCH = 64n;
const MAX_INDEXER_BLOCK_LAG = 100n;

const genesisTransferEvent = staticsGenesisAbi.find(
  (entry) => entry.type === "event" && entry.name === "Transfer"
) as Extract<(typeof staticsGenesisAbi)[number], { type: "event"; name: "Transfer" }>;

async function loadIncomingGenesisIds(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint | "latest"
): Promise<bigint[]> {
  if (typeof toBlock === "bigint" && fromBlock > toBlock) return [];
  const logs = await publicClient.getLogs({
    address: deployment.contracts.genesis,
    event: genesisTransferEvent,
    args: { to: getAddress(owner) },
    fromBlock,
    toBlock,
  });
  return [
    ...new Set(
      parseEventLogs({ abi: staticsGenesisAbi, logs, eventName: "Transfer" }).map((log) =>
        String(log.args.tokenId)
      )
    ),
  ].map(BigInt);
}

export async function discoverNextAvailableGenesisId(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<bigint | null> {
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

export async function discoverWalletGenesisIds(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  owner: Address
): Promise<bigint[]> {
  let ids: bigint[] | null = null;
  const indexerUrl = configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId);
  if (indexerUrl) {
    try {
      const checkpoint = await loadIndexerCheckpoint(
        deployment.descriptor.chainId,
        deployment.descriptor.deploymentId,
        indexerUrl
      );
      const chainHead = await publicClient.getBlockNumber();
      if (
        checkpoint.blockNumber > chainHead ||
        chainHead - checkpoint.blockNumber > MAX_INDEXER_BLOCK_LAG
      ) {
        throw new Error("The Statics indexer is too far behind the selected chain.");
      }
      const [indexedIds, recentIds] = await Promise.all([
        loadWalletLaunchGenesisIds(owner, deployment.descriptor.deploymentId, indexerUrl),
        loadIncomingGenesisIds(
          publicClient,
          deployment,
          owner,
          checkpoint.blockNumber + 1n,
          chainHead
        ),
      ]);
      ids = [...new Set([...indexedIds, ...recentIds].map(String))].map(BigInt);
    } catch {
      // An unavailable, invalid, or stale indexer falls through to chain history.
    }
  }
  if (ids === null) {
    ids = await loadIncomingGenesisIds(
      publicClient,
      deployment,
      owner,
      deployment.deploymentStartBlock,
      "latest"
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
  return ids.filter(
    (_, index) =>
      current[index] !== null && String(current[index]).toLowerCase() === owner.toLowerCase()
  );
}
