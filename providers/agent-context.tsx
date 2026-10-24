"use client";
import { createContext, useContext, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { AgentClient, type SignRequest, type Workflow } from "@equalfi/agent-client";
import { getAccessToken, useSignTransaction, useSigners } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { useWalletState } from "./wallet-context";
import {
  announceProtocolTransactionConfirmed,
  protocolQueryScopes,
} from "@/lib/protocol/reconciliation";
import type { Address } from "viem";

export const agentEnabled = process.env.NEXT_PUBLIC_AGENT_ENABLED === "true";
type AgentRuntime = {
  client: AgentClient | null;
  workflows: Workflow[];
  error: string | null;
  refresh: () => Promise<unknown>;
  signNext: (action: Workflow) => Promise<unknown>;
  setupSigner: () => Promise<void>;
  removeSigner: () => Promise<void>;
};
const unavailable = async () => {
  throw new Error("Agent wallet connection is unavailable.");
};
const Context = createContext<AgentRuntime>({
  client: null,
  workflows: [],
  error: null,
  refresh: unavailable,
  signNext: unavailable,
  setupSigner: unavailable,
  removeSigner: unavailable,
});
export const useAgent = () => useContext(Context);

export function AgentRuntimeProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletState();
  const { signTransaction } = useSignTransaction();
  const { addSigners, removeSigners } = useSigners();
  const current = useRef("");
  const context = `${wallet.address}:${wallet.targetChainId}:${wallet.chainId}:${wallet.status}`;
  useLayoutEffect(() => {
    current.current = context;
    return () => {
      current.current = "";
    };
  }, [context]);
  const client = useMemo(
    () =>
      agentEnabled && wallet.status === "ready" && wallet.authenticated && wallet.address
        ? new AgentClient({
            baseUrl: "/api/agent",
            wallet: wallet.address.toLowerCase(),
            chainId: wallet.targetChainId,
            getAccessToken,
          })
        : null,
    [wallet.address, wallet.targetChainId, wallet.status, wallet.authenticated]
  );
  const activity = useQuery({
    queryKey: ["agent-activity", wallet.address, wallet.targetChainId],
    enabled: Boolean(client),
    queryFn: () => client!.activity(),
    refetchInterval: 2000,
    retry: false,
  });
  const announced = useRef(new Set<string>());
  useEffect(() => {
    for (const action of activity.data ?? []) {
      if (
        action.identity.wallet !== wallet.address?.toLowerCase() ||
        action.plan.chainId !== wallet.targetChainId
      )
        continue;
      for (const attempt of action.attempts) {
        if (
          attempt.status !== "confirmed" ||
          !attempt.blockNumber ||
          !attempt.hash ||
          announced.current.has(attempt.hash)
        )
          continue;
        announced.current.add(attempt.hash);
        const kind = attempt.stepId.startsWith("approval")
          ? "phase-one-approve-token"
          : "phase-one-stake";
        announceProtocolTransactionConfirmed({
          wallet: action.identity.wallet as Address,
          chainId: action.plan.chainId,
          deploymentId: action.plan.deploymentId,
          blockNumber: BigInt(attempt.blockNumber),
          kind,
          scopes: protocolQueryScopes(kind),
        });
      }
    }
  }, [activity.data, wallet.address, wallet.targetChainId]);
  const assertCurrent = () => {
    if (current.current !== context || !wallet.isTargetChain)
      throw new Error("Wallet or network changed. Review the action again.");
  };
  const sign = async (request: SignRequest) => {
    assertCurrent();
    if (request.chainId !== wallet.targetChainId) throw new Error("Transaction network changed.");
    const tx = {
      to: request.to as Address,
      data: request.data as `0x${string}`,
      value: BigInt(request.value),
      gas: BigInt(request.gas),
      maxFeePerGas: BigInt(request.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(request.maxPriorityFeePerGas),
      nonce: request.nonce,
      chainId: request.chainId,
      type: 2,
    };
    if (wallet.walletKind === "embedded") {
      const signed = await signTransaction(tx, {
        address: wallet.address!,
        uiOptions: { showWalletUIs: true },
      });
      assertCurrent();
      return signed.signature;
    }
    const provider = await wallet.getEthereumProvider();
    if (!provider) throw new Error("The wallet is unavailable.");
    const hex = (value: bigint | number) => `0x${BigInt(value).toString(16)}`;
    const raw = await provider.request({
      method: "eth_signTransaction",
      params: [
        {
          from: wallet.address,
          to: tx.to,
          data: tx.data,
          value: hex(tx.value),
          gas: hex(tx.gas),
          maxFeePerGas: hex(tx.maxFeePerGas),
          maxPriorityFeePerGas: hex(tx.maxPriorityFeePerGas),
          nonce: hex(tx.nonce),
          chainId: hex(tx.chainId),
          type: "0x2",
        },
      ],
    });
    assertCurrent();
    if (typeof raw !== "string")
      throw new Error("This wallet does not support signing a prepared transaction.");
    return raw;
  };
  return (
    <Context.Provider
      value={{
        client,
        workflows: activity.data ?? [],
        error: activity.error?.message ?? null,
        refresh: activity.refetch,
        signNext: async (action) => {
          if (!client) return unavailable();
          const result = await client.signNext(action, sign);
          await activity.refetch();
          return result;
        },
        setupSigner: async () => {
          assertCurrent();
          if (!client || wallet.walletKind !== "embedded")
            throw new Error("Delegation requires an embedded wallet.");
          const info = await client.capabilities();
          if (!info.signer) throw new Error("Delegation is unavailable.");
          if (!info.signer.installed)
            await addSigners({
              address: wallet.address!,
              signers: [{ signerId: info.signer.signerId, policyIds: [info.signer.policyId] }],
            });
        },
        removeSigner: async () => {
          if (!client) return unavailable();
          await client.revoke();
          await removeSigners({ address: wallet.address! });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
