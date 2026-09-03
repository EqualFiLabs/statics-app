import type { Address, Hex } from "viem";

const deploymentIdentity = (protocolCommit: string | undefined) => protocolCommit ?? "unconfigured";

/**
 * Shared keys make a catalog update visible everywhere that consumes it.
 * Route-specific keys caused stale positions and baskets after navigating.
 */
export const protocolQueryKeys = {
  basketCatalog: (protocolCommit: string | undefined, wallet: Address | null) =>
    ["basket-catalog", deploymentIdentity(protocolCommit), wallet] as const,
  positionCatalog: (protocolCommit: string | undefined, wallet: Address | null) =>
    ["position-catalog", deploymentIdentity(protocolCommit), wallet] as const,
  morphoPosition: (deploymentId: string, positionId: bigint, marketId: Hex | undefined) =>
    ["morpho-position", deploymentId, positionId.toString(), marketId] as const,
};
