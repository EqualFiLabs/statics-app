"use client";

import type { Hex } from "viem";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  executeProtocolTransaction,
  type ProtocolTransactionRequest,
} from "@/lib/protocol/transactions";

export type PhaseOneTransactionRequest = Omit<
  ProtocolTransactionRequest,
  "chainId" | "deploymentId"
> &
  Readonly<{ deployment: PhaseOneDeployment }>;

export function executePhaseOneTransaction(request: PhaseOneTransactionRequest): Promise<Hex> {
  const { deployment, ...transaction } = request;
  return executeProtocolTransaction({
    ...transaction,
    chainId: deployment.descriptor.chainId,
    deploymentId: deployment.descriptor.deploymentId,
  });
}
