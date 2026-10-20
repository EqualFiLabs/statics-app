import { queryOptions } from "@tanstack/react-query";
import type { PublicClient } from "viem";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";

/** Every consumer of this cache key must use the same accounting shape. */
export function genesisVaultEpochQuery(
  publicClient: PublicClient | undefined,
  deployment: LaunchDeployment
) {
  return queryOptions({
    queryKey: ["genesis-vault-epoch", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("The deployment RPC is unavailable.");
      const accounting = await publicClient.readContract({
        address: deployment.contracts.vault,
        abi: currentGenesisVaultAbi,
        functionName: "vaultAccounting",
      });
      return {
        epochActive: accounting.epochActive,
        genesisEpochEnd: Number(accounting.genesisEpochEnd),
        vaultPrice: accounting.vaultPrice,
        maximumSupply: accounting.maximumSupply,
        circulatingGenesis: accounting.circulatingGenesis,
      };
    },
  });
}
