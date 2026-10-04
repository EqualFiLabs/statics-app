import type { Address } from "viem";

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
  phaseOnePools: (deploymentId: string) => ["phase-one-pools", deploymentId] as const,
  phaseOnePool: (deploymentId: string, poolId: string) =>
    ["phase-one-pool", deploymentId, poolId] as const,
  phaseOnePositions: (deploymentId: string, wallet: Address | null) =>
    ["phase-one-positions", deploymentId, wallet] as const,
  phaseOnePosition: (deploymentId: string, wallet: Address | null, positionId: bigint) =>
    ["phase-one-position", deploymentId, wallet, positionId.toString()] as const,
  phaseOneLiquidity: (
    deploymentId: string,
    wallet: Address | null,
    positionId: bigint,
    poolId: string
  ) => ["phase-one-liquidity", deploymentId, wallet, positionId.toString(), poolId] as const,
  phaseOneRewards: (
    deploymentId: string,
    wallet: Address | null,
    positionId: bigint,
    poolId: string
  ) => ["phase-one-rewards", deploymentId, wallet, positionId.toString(), poolId] as const,
  phaseOneGauges: (deploymentId: string, wallet: Address | null, positionId: bigint) =>
    ["phase-one-gauges", deploymentId, wallet, positionId.toString()] as const,
};
