import { getAddress, parseEventLogs, type Address, type PublicClient } from "viem";

import { staticsGenesisAbi, staticsGenesisVaultAbi } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  configuredIndexerUrlForDeployment,
  loadNextAvailableGenesisId,
  loadWalletLaunchGenesisIds,
} from "@/lib/indexer/statics";

const GENESIS_SUPPLY = 5_555n;
const DISCOVERY_BATCH = 64n;

export async function discoverNextAvailableGenesisId(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<bigint | null> {
  if (configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId)) {
    try {
      const indexed = await loadNextAvailableGenesisId(deployment.descriptor.deploymentId);
      if (indexed === null) return null;
      const available = await publicClient.readContract({
        address: deployment.contracts.vault,
        abi: staticsGenesisVaultAbi,
        functionName: "isVaultInventory",
        args: [indexed],
      });
      if (available) return indexed;
    } catch {
      // A missing/stale indexer falls through to bounded authoritative reads.
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
        publicClient
          .readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisVaultAbi,
            functionName: "isVaultInventory",
            args: [id],
          })
          .catch(() => false)
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
  if (configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId)) {
    try {
      ids = await loadWalletLaunchGenesisIds(owner, deployment.descriptor.deploymentId);
    } catch {
      // A failed indexer request falls through to the direct event-log path.
    }
  }
  if (ids === null) {
    const logs = await publicClient.getLogs({
      address: deployment.contracts.genesis,
      event: staticsGenesisAbi.find(
        (entry) => entry.type === "event" && entry.name === "Transfer"
      ) as Extract<(typeof staticsGenesisAbi)[number], { type: "event"; name: "Transfer" }>,
      args: { to: getAddress(owner) },
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
    });
    ids = [
      ...new Set(
        parseEventLogs({ abi: staticsGenesisAbi, logs, eventName: "Transfer" }).map((log) =>
          String(log.args.tokenId)
        )
      ),
    ].map(BigInt);
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
