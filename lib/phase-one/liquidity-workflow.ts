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

export function parsePublicLiquidityWorkflow(value: string): PublicLiquidityWorkflow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Saved liquidity workflow is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Saved liquidity workflow is invalid.");
  }
  const candidate = parsed as Record<string, unknown>;
  const statuses: readonly PublicLiquidityWorkflowStatus[] = [
    "position-required",
    "position-confirming",
    "liquidity-ready",
    "liquidity-confirming",
    "complete",
  ];
  if (
    candidate.version !== 1 ||
    typeof candidate.deploymentId !== "string" ||
    !Number.isSafeInteger(candidate.chainId) ||
    typeof candidate.wallet !== "string" ||
    typeof candidate.poolId !== "string" ||
    !/^0x[a-f0-9]{64}$/iu.test(candidate.poolId) ||
    typeof candidate.intentId !== "string" ||
    !statuses.includes(candidate.status as PublicLiquidityWorkflowStatus) ||
    !(candidate.positionId === null || /^\d+$/.test(String(candidate.positionId))) ||
    !(
      candidate.positionTransactionHash === null ||
      /^0x[a-f0-9]{64}$/iu.test(String(candidate.positionTransactionHash))
    ) ||
    !(
      candidate.liquidityTransactionHash === null ||
      /^0x[a-f0-9]{64}$/iu.test(String(candidate.liquidityTransactionHash))
    ) ||
    !Number.isSafeInteger(candidate.updatedAt)
  ) {
    throw new Error("Saved liquidity workflow is invalid.");
  }
  return candidate as unknown as PublicLiquidityWorkflow;
}

export function savePublicLiquidityWorkflow(
  storage: Pick<Storage, "setItem">,
  workflow: PublicLiquidityWorkflow
): void {
  storage.setItem(publicLiquidityWorkflowStorageKey(workflow), JSON.stringify(workflow));
}

export function loadPublicLiquidityWorkflow(
  storage: Pick<Storage, "getItem">,
  identity: Pick<PublicLiquidityWorkflow, "deploymentId" | "chainId" | "wallet" | "intentId">
): PublicLiquidityWorkflow | null {
  const value = storage.getItem(publicLiquidityWorkflowStorageKey(identity));
  return value === null ? null : parsePublicLiquidityWorkflow(value);
}
