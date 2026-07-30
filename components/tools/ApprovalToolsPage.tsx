"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
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
import { approvalStatusLabel } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

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
  const wallet = useWalletState();
  if (dappPreviewEnabled || wallet.status === "unconfigured") {
    return (
      <section className="approval-tools">
        <div className="approval-tools-heading">
          <p className="dapp-section-label">Account tools</p>
          <h2>App approvals</h2>
          <p>
            Connect the DApp to review and manage token, Permit2, and operator approvals for the
            verified Statics deployment.
          </p>
        </div>
      </section>
    );
  }
  return <ApprovalToolsRuntime />;
}

function ApprovalToolsRuntime() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
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
        title="Connect your wallet to manage approvals"
        description="Approval authority belongs to a specific wallet, so Statics must know which account to inspect."
        action={{
          label:
            walletState.status === "wallet-missing" ? "Create embedded wallet" : "Connect wallet",
          onClick:
            walletState.status === "wallet-missing"
              ? () => void walletState.createWallet()
              : walletState.login,
        }}
      />
    );
  }
  if (walletState.status !== "ready") {
    return (
      <EmptyState
        title="Wallet loading"
        description="Statics is waiting for the active wallet before reading approvals."
      />
    );
  }
  if (!walletState.isTargetChain) {
    return (
      <EmptyState
        title="Switch to Robinhood Chain Testnet"
        description="The Tools page only manages approvals for the verified Statics deployment."
        action={{ label: "Switch network", onClick: () => void walletState.switchNetwork() }}
      />
    );
  }
  if (deploymentState.status !== "configured") {
    return (
      <EmptyState
        title="Tools unavailable"
        description="No verified Statics deployment is configured."
      />
    );
  }

  const records = approvals.data ?? [];
  const currentTimestamp = Math.floor(approvals.dataUpdatedAt / 1_000);
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
        <p className="dapp-section-label">Account tools</p>
        <h2 id="approval-tools-title">App approvals</h2>
        <p>
          Statics uses maximum approvals so routine deposits, minting, repayment, staking, swaps,
          and liquidity management do not ask for the same authority repeatedly. Revoke any
          authority here at any time.
        </p>
      </div>

      <div className="approval-tools-summary">
        <div>
          <span>Known authorities</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>Currently active</span>
          <strong>{active.length}</strong>
        </div>
        <button
          type="button"
          onClick={() => void revokeAll()}
          disabled={busy || active.length === 0}
        >
          {bulkProgress
            ? `Revoking ${bulkProgress.current} of ${bulkProgress.total}…`
            : "Revoke all app approvals"}
        </button>
      </div>

      <p className="approval-tools-note">
        “Revoke all” submits one explicit wallet transaction per active authority. It stops if a
        transaction is rejected or fails; approvals already confirmed remain revoked.
      </p>

      {approvals.isPending && <p className="approval-tools-note">Reading current approvals…</p>}
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
                  label="Spender"
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
                      {rowPending ? "Confirming…" : "Set maximum"}
                    </button>
                  )}
                  {status !== "Revoked" && (
                    <button
                      className="is-revoke"
                      type="button"
                      onClick={() => void updateOne(approval, false)}
                      disabled={busy}
                    >
                      {rowPending ? "Confirming…" : "Revoke"}
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
