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
  if (request.publicClient.chain && request.publicClient.chain.id !== deployment.descriptor.chainId)
    throw new Error("Select the configured Statics network.");
  return executeProtocolTransaction({
    ...transaction,
    chainId: deployment.descriptor.chainId,
    deploymentId: deployment.descriptor.deploymentId,
  });
}
