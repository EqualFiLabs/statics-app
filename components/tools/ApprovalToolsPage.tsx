"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";
import { useNow, useTranslations } from "next-intl";

import { EmptyState, SurfaceEmptyState } from "@/components/common/EmptyState";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { verifyDollarDeployment, verifyLiquidityDeployment } from "@/lib/dollar/deployment";
import {
  buildApprovalUpdate,
  loadApprovalInventory,
  loadLaunchApprovalInventory,
  readApprovalState,
  type ApprovalRecord,
} from "@/lib/protocol/approval-inventory";
import { approvalClockTimestamp, approvalStatusLabel } from "@/lib/protocol/approvals";
import { executeProtocolActionPlan } from "@/lib/protocol/action-plan";
import {
  actionPresentation,
  approvalPresentation,
  erc1155OperatorPermission,
  erc721OperatorPermission,
  maximumPermit2Permission,
  unlimitedTokenPermission,
} from "@/lib/protocol/presentation";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";
import { useDeployment } from "@/providers/deployment-context";
import type { StaticsDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";

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
  const { active } = useDeployment();
  if (wallet.status === "unconfigured") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject={t("title")}
        empty={{ title: t("unavailable"), description: t("noDeployment") }}
      />
    );
  }
  if (!active.deployment) {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject={t("title")}
        empty={{
          title: t("unavailable"),
          description: active.descriptor.unavailableReason ?? t("noDeployment"),
        }}
      />
    );
  }
  return <ApprovalToolsRuntime deployment={active.deployment} />;
}

function ApprovalToolsRuntime({ deployment }: { deployment: StaticsDeployment }) {
  const t = useTranslations("tools");
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
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
      deployment.descriptor.deploymentId,
      deployment.kind === "launch" ? deployment.protocolCommit : deployment.protocol.protocolCommit,
      wallet,
    ],
    enabled:
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    staleTime: APPROVAL_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!publicClient || !wallet) {
        throw new Error("No verified Statics deployment is configured.");
      }
      if (deployment.kind === "launch") {
        await verifyLaunchDeployment(publicClient, deployment);
        return loadLaunchApprovalInventory(publicClient, deployment, wallet);
      }
      await verifyDollarDeployment(publicClient, deployment.protocol);
      if (deployment.protocol.liquidity) {
        await verifyLiquidityDeployment(publicClient, deployment.protocol);
      }
      return loadApprovalInventory(publicClient, deployment.protocol, wallet);
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
    if (deployment.kind === "launch") {
      await verifyLaunchDeployment(publicClient, deployment);
    }
    const permissionPresentation =
      approval.kind === "erc20"
        ? approvalPresentation(
            unlimitedTokenPermission({
              asset: approval.tokenSymbol,
              spender: approval.spender,
              spenderName: approval.spenderLabel,
            }),
            approval.tokenName
          )
        : approval.kind === "permit2"
          ? approvalPresentation(
              maximumPermit2Permission({
                asset: approval.tokenSymbol,
                spender: approval.spender,
                spenderName: approval.spenderLabel,
              }),
              "Permit2"
            )
          : approval.kind === "operator"
            ? approvalPresentation(
                deployment.kind === "protocol" &&
                  approval.token === deployment.protocol.contracts.risk
                  ? erc1155OperatorPermission({
                      asset: approval.tokenName,
                      spender: approval.spender,
                      spenderName: approval.spenderLabel,
                    })
                  : erc721OperatorPermission({
                      asset: approval.tokenName,
                      spender: approval.spender,
                      spenderName: approval.spenderLabel,
                    }),
                approval.tokenName
              )
            : actionPresentation({
                action: `Approve ${approval.tokenSymbol}`,
                description: `Approve only ${approval.tokenSymbol} for ${approval.spenderLabel} (${approval.spender}). This does not grant collection-wide operator access.`,
                contractName: approval.tokenName,
              });
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deployment.descriptor.chainId,
      deploymentId: deployment.descriptor.deploymentId,
      kind: enabled ? "set-app-approval" : "revoke-app-approval",
      label: `${enabled ? "Set maximum" : "Revoke"} ${approval.tokenSymbol} approval`,
      amount: `${approvalKindLabel(approval.kind)} for ${approval.spenderLabel}`,
      to: transaction.target,
      data: transaction.data,
      presentation: enabled ? permissionPresentation : undefined,
      sendTransaction: walletState.sendEvmTransaction,
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
      await executeProtocolActionPlan(
        active.map((approval) => ({
          id: approval.key,
          label: `Revoke ${approval.tokenSymbol} for ${approval.spenderLabel}`,
          run: () => updateApproval(approval, false),
        })),
        ({ current, total }) => setBulkProgress({ current, total })
      );
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
                  chainId={deployment.descriptor.chainId}
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
