"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";
import { useNow, useTranslations } from "next-intl";

import { EmptyState, SurfaceEmptyState } from "@/components/common/EmptyState";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import {
  readClientDollarDeployment,
  verifyDollarDeployment,
  verifyLiquidityDeployment,
} from "@/lib/dollar/deployment";
import {
  buildApprovalUpdate,
  loadApprovalInventory,
  readApprovalState,
  type ApprovalRecord,
} from "@/lib/protocol/approval-inventory";
import { approvalClockTimestamp, approvalStatusLabel } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();
const APPROVAL_REFRESH_INTERVAL_MS = 60_000;

function approvalKindLabel(kind: ApprovalRecord["kind"]): string {
  if (kind === "permit2") return "Permit2 allowance";
  if (kind === "erc721-token") return "Legacy NFT approval";
  if (kind === "operator") return "Operator approval";
  return "Token allowance";
}

function describeApprovalError(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The approval update failed.";
}

export function ApprovalToolsPage() {
  const t = useTranslations("tools");
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject={t("title")}
        empty={{ title: t("unavailable"), description: t("noDeployment") }}
      />
    );
  }
  return <ApprovalToolsRuntime />;
}

function ApprovalToolsRuntime() {
  const t = useTranslations("tools");
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const now = useNow({ updateInterval: APPROVAL_REFRESH_INTERVAL_MS });
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<Readonly<{
    current: number;
    total: number;
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approvals = useQuery({
    queryKey: [
      "approval-tools",
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : "unconfigured",
      wallet,
    ],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    placeholderData: keepPreviousData,
    staleTime: APPROVAL_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      if (deploymentState.deployment.liquidity) {
        await verifyLiquidityDeployment(publicClient, deploymentState.deployment);
      }
      return loadApprovalInventory(publicClient, deploymentState.deployment, wallet);
    },
  });

  if (
    walletState.status === "signed-out" ||
    walletState.status === "error" ||
    walletState.status === "wallet-missing"
  ) {
    return (
      <EmptyState
        title={t("connectTitle")}
        description={t("connectDescription")}
        action={{
          label: walletState.status === "wallet-missing" ? t("createWallet") : t("connectWallet"),
          onClick:
            walletState.status === "wallet-missing"
              ? () => void walletState.createWallet()
              : walletState.login,
        }}
      />
    );
  }
  if (walletState.status !== "ready") {
    return <EmptyState title={t("loadingTitle")} description={t("loadingDescription")} />;
  }
  if (!walletState.isTargetChain) {
    return (
      <EmptyState
        title={t("switchTitle")}
        description={t("switchDescription")}
        action={{ label: t("switch"), onClick: () => void walletState.switchNetwork() }}
      />
    );
  }
  if (deploymentState.status !== "configured") {
    return <EmptyState title={t("unavailable")} description={t("noDeployment")} />;
  }

  const records = approvals.data ?? [];
  const currentTimestamp = approvalClockTimestamp(now);
  const active = records.filter(
    (approval) =>
      approvalStatusLabel(
        approval.kind,
        approval.allowance,
        approval.expiration,
        currentTimestamp
      ) !== "Revoked"
  );
  const busy = pendingKey !== null;

  const updateApproval = async (approval: ApprovalRecord, enabled: boolean) => {
    if (!publicClient || !walletClient.data || !wallet) {
      throw new Error("The connected wallet is unavailable.");
    }
    const transaction = buildApprovalUpdate(approval, enabled);
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deploymentState.deployment.chainId,
      kind: enabled ? "set-app-approval" : "revoke-app-approval",
      label: `${enabled ? "Set maximum" : "Revoke"} ${approval.tokenSymbol} approval`,
      amount: `${approvalKindLabel(approval.kind)} for ${approval.spenderLabel}`,
      to: transaction.target,
      data: transaction.data,
      sendTransaction: ({ to, data, value }) =>
        walletClient.data!.sendTransaction({
          account: wallet,
          chain: walletClient.data!.chain,
          to,
          data,
          value,
        }),
      describeError: describeApprovalError,
      verifyConfirmation: async () => {
        const confirmed = await readApprovalState(publicClient, wallet, approval);
        const status = approvalStatusLabel(
          approval.kind,
          confirmed.allowance,
          confirmed.expiration
        );
        if (enabled ? status !== "Maximum" : status !== "Revoked") {
          throw new Error("The confirmed approval does not match the requested state.");
        }
      },
    });
  };

  const updateOne = async (approval: ApprovalRecord, enabled: boolean) => {
    if (busy) return;
    setPendingKey(approval.key);
    setError(null);
    try {
      await updateApproval(approval, enabled);
      await approvals.refetch();
    } catch (cause) {
      setError(describeApprovalError(cause));
    } finally {
      setPendingKey(null);
    }
  };

  const revokeAll = async () => {
    if (busy || active.length === 0) return;
    setPendingKey("all");
    setError(null);
    try {
      for (let index = 0; index < active.length; index += 1) {
        setBulkProgress({ current: index + 1, total: active.length });
        await updateApproval(active[index]!, false);
      }
      await approvals.refetch();
    } catch (cause) {
      setError(
        `${describeApprovalError(cause)} Confirmed revocations remain effective; refresh and retry the rest.`
      );
      await approvals.refetch();
    } finally {
      setBulkProgress(null);
      setPendingKey(null);
    }
  };

  return (
    <section className="approval-tools" aria-labelledby="approval-tools-title">
      <div className="approval-tools-heading">
        <p className="dapp-section-label">{t("label")}</p>
        <h2 id="approval-tools-title">{t("title")}</h2>
        <p>{t("description")}</p>
      </div>

      <div className="approval-tools-summary">
        <div>
          <span>{t("known")}</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>{t("active")}</span>
          <strong>{active.length}</strong>
        </div>
        <button
          type="button"
          onClick={() => void revokeAll()}
          disabled={busy || active.length === 0}
        >
          {bulkProgress
            ? t("revoking", { current: bulkProgress.current, total: bulkProgress.total })
            : t("revokeAll")}
        </button>
      </div>

      <p className="approval-tools-note">{t("revokeNote")}</p>

      {approvals.isPending && <p className="approval-tools-note">{t("reading")}</p>}
      {approvals.error && (
        <p className="dapp-inline-error" role="alert">
          {describeApprovalError(approvals.error)}
        </p>
      )}
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}

      <div className="approval-tools-list">
        {records.map((approval) => {
          const status = approvalStatusLabel(
            approval.kind,
            approval.allowance,
            approval.expiration,
            currentTimestamp
          );
          const rowPending = pendingKey === approval.key;
          return (
            <article key={approval.key} className="approval-tools-row">
              <div className="approval-tools-token">
                <span>{approvalKindLabel(approval.kind)}</span>
                <strong>{approval.tokenSymbol}</strong>
                <small>{approval.tokenName}</small>
              </div>
              <div className="approval-tools-spender">
                <span>{approval.spenderLabel}</span>
                <AddressDisplay
                  address={approval.spender}
                  chainId={deploymentState.deployment.chainId}
                  label={t("spender")}
                />
                <small>{approval.purposes.join(" · ")}</small>
              </div>
              <div className="approval-tools-state">
                <span className={`approval-status is-${status.toLowerCase()}`}>{status}</span>
                <div>
                  {status !== "Maximum" && (
                    <button
                      type="button"
                      onClick={() => void updateOne(approval, true)}
                      disabled={busy}
                    >
                      {rowPending ? t("confirming") : t("setMaximum")}
                    </button>
                  )}
                  {status !== "Revoked" && (
                    <button
                      className="is-revoke"
                      type="button"
                      onClick={() => void updateOne(approval, false)}
                      disabled={busy}
                    >
                      {rowPending ? t("confirming") : t("revoke")}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
