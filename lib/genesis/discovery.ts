import { getAddress, parseEventLogs, type Address, type PublicClient } from "viem";

import { staticsGenesisAbi } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  configuredIndexerUrlForDeployment,
  loadWalletLaunchGenesisIds,
} from "@/lib/indexer/statics";

export async function discoverWalletGenesisIds(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  owner: Address
): Promise<bigint[]> {
  const indexed = configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId)
    ? await loadWalletLaunchGenesisIds(owner, deployment.descriptor.deploymentId).catch(() => [])
    : [];
  const logs = await publicClient.getLogs({
    address: deployment.contracts.genesis,
    event: staticsGenesisAbi.find(
      (entry) => entry.type === "event" && entry.name === "Transfer"
    ) as Extract<(typeof staticsGenesisAbi)[number], { type: "event"; name: "Transfer" }>,
    args: { to: getAddress(owner) },
    fromBlock: deployment.deploymentStartBlock,
    toBlock: "latest",
  });
  const ids = [
    ...new Set(
      [
        ...indexed,
        ...parseEventLogs({ abi: staticsGenesisAbi, logs, eventName: "Transfer" }).map(
          (log) => log.args.tokenId
        ),
      ].map(String)
    ),
  ].map(BigInt);
  const current = await publicClient.multicall({
    allowFailure: true,
    contracts: ids.map((id) => ({
      address: deployment.contracts.genesis,
      abi: staticsGenesisAbi,
      functionName: "ownerOf" as const,
      args: [id] as const,
    })),
  });
  return ids.filter(
    (_, index) =>
      current[index]?.status === "success" &&
      String(current[index].result).toLowerCase() === owner.toLowerCase()
  );
}
