import type { Hex } from "viem";

export type PublicLiquidityWorkflowStatus =
  | "position-required"
  | "position-confirming"
  | "liquidity-ready"
  | "liquidity-confirming"
  | "complete";

export type PublicLiquidityWorkflow = Readonly<{
  version: 1;
  deploymentId: string;
  chainId: number;
  wallet: string;
  poolId: Hex;
  intentId: string;
  status: PublicLiquidityWorkflowStatus;
  positionId: string | null;
  positionTransactionHash: Hex | null;
  liquidityTransactionHash: Hex | null;
  updatedAt: number;
}>;

export function createPublicLiquidityWorkflow(input: {
  deploymentId: string;
  chainId: number;
  wallet: string;
  poolId: Hex;
  intentId: string;
  now?: number;
}): PublicLiquidityWorkflow {
  return {
    version: 1,
    deploymentId: input.deploymentId,
    chainId: input.chainId,
    wallet: input.wallet.toLowerCase(),
    poolId: input.poolId,
    intentId: input.intentId,
    status: "position-required",
    positionId: null,
    positionTransactionHash: null,
    liquidityTransactionHash: null,
    updatedAt: input.now ?? Date.now(),
  };
}

export function advancePublicLiquidityWorkflow(
  workflow: PublicLiquidityWorkflow,
  update:
    | Readonly<{ status: "position-confirming"; transactionHash: Hex }>
    | Readonly<{ status: "liquidity-ready"; positionId: bigint }>
    | Readonly<{ status: "liquidity-confirming"; transactionHash: Hex }>
    | Readonly<{ status: "complete" }>,
  now = Date.now()
): PublicLiquidityWorkflow {
  const allowed: Record<PublicLiquidityWorkflowStatus, readonly PublicLiquidityWorkflowStatus[]> = {
    "position-required": ["position-confirming", "liquidity-ready"],
    "position-confirming": ["liquidity-ready"],
    "liquidity-ready": ["liquidity-confirming"],
    "liquidity-confirming": ["complete", "liquidity-ready"],
    complete: [],
  };
  if (!allowed[workflow.status].includes(update.status)) {
    throw new Error(
      `Invalid liquidity workflow transition from ${workflow.status} to ${update.status}.`
    );
  }
  if (update.status === "position-confirming") {
    return {
      ...workflow,
      status: update.status,
      positionTransactionHash: update.transactionHash,
      updatedAt: now,
    };
  }
  if (update.status === "liquidity-ready") {
    return {
      ...workflow,
      status: update.status,
      positionId: update.positionId.toString(),
      updatedAt: now,
    };
  }
  if (update.status === "liquidity-confirming") {
    if (!workflow.positionId)
      throw new Error("A confirmed PositionNFT is required before liquidity provision.");
    return {
      ...workflow,
      status: update.status,
      liquidityTransactionHash: update.transactionHash,
      updatedAt: now,
    };
  }
  return { ...workflow, status: "complete", updatedAt: now };
}

export function publicLiquidityWorkflowStorageKey(
  workflow: Pick<PublicLiquidityWorkflow, "deploymentId" | "chainId" | "wallet" | "intentId">
): string {
  return [
    "statics",
    "phase-one-liquidity",
    workflow.deploymentId,
    workflow.chainId,
    workflow.wallet.toLowerCase(),
    workflow.intentId,
  ].join(":");
}
