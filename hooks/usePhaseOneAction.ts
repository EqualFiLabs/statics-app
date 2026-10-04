"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  executePhaseOneTransaction,
  type PhaseOneTransactionRequest,
} from "@/lib/phase-one/transactions";
import { useWalletState } from "@/providers/wallet-context";

type Transaction = Omit<
  PhaseOneTransactionRequest,
  "deployment" | "publicClient" | "wallet" | "sendTransaction" | "describeError"
>;
type Review = Readonly<{
  label: string;
  details: readonly string[];
  execute: () => Promise<void>;
  context: string;
}>;
export function phaseOneActionError(error: unknown): string {
  return error instanceof Error ? error.message : "The transaction failed.";
}

export function usePhaseOneAction(deployment: PhaseOneDeployment, selection = "") {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const ready = Boolean(
    wallet &&
    walletState.chainId === deployment.descriptor.chainId &&
    publicClient &&
    (!publicClient.chain || publicClient.chain.id === deployment.descriptor.chainId)
  );
  const context = `${deployment.descriptor.deploymentId}:${wallet}:${walletState.chainId}:${walletState.status}:${selection}`;
  const current = useRef(context);
  useLayoutEffect(() => {
    current.current = context;
    return () => {
      if (current.current === context) current.current = "";
    };
  }, [context]);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assertCurrent = () => {
    if (!ready || current.current !== context)
      throw new Error("Wallet, network, or selection changed. Review the action again.");
  };
  const send = async (transaction: Transaction) => {
    assertCurrent();
    if (!publicClient || !wallet) throw new Error("Connect a wallet on the selected network.");
    return executePhaseOneTransaction({
      ...transaction,
      deployment,
      publicClient,
      wallet,
      describeError: phaseOneActionError,
      sendTransaction: (request) => {
        assertCurrent();
        return walletState.sendEvmTransaction(request);
      },
    });
  };
  const prepare = async (build: () => Promise<Omit<Review, "context">>) => {
    setBusy(true);
    setError(null);
    setReview(null);
    try {
      assertCurrent();
      const action = await build();
      assertCurrent();
      setReview({ ...action, context });
    } catch (failure) {
      setError(phaseOneActionError(failure));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!review || review.context !== context || busy) return;
    setBusy(true);
    setError(null);
    try {
      assertCurrent();
      await review.execute();
      setReview(null);
    } catch (failure) {
      setError(phaseOneActionError(failure));
      setReview(null);
    } finally {
      setBusy(false);
    }
  };
  return {
    walletState,
    wallet,
    publicClient,
    ready,
    busy,
    error,
    send,
    prepare,
    confirm,
    review: review?.context === context ? review : null,
    cancel: () => setReview(null),
  };
}
