"use client";

import { useSyncExternalStore } from "react";
import { getAddress } from "viem";

import {
  readProtocolActivity,
  subscribeProtocolActivity,
  type ProtocolActivity,
} from "@/lib/dollar/activity";
import { ActivityPreview } from "@/components/preview/DappPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { getTransactionExplorerUrl } from "@/lib/wallet-config";
import { useWalletState } from "@/providers/wallet-context";

function statusLabel(activity: ProtocolActivity): string {
  if (activity.status === "simulating") return "Simulating";
  if (activity.status === "signing") return "Awaiting signature";
  if (activity.status === "submitted") return "Confirming";
  if (activity.status === "confirmed") {
    return activity.replacementReason === "repriced" ? "Confirmed · repriced" : "Confirmed";
  }
  if (activity.status === "confirmed-unverified") return "Confirmed · refresh required";
  if (activity.status === "rejected") return "Rejected";
  if (activity.status === "reverted") return "Reverted";
  if (activity.status === "replaced") {
    return activity.replacementReason === "cancelled" ? "Cancelled" : "Replaced";
  }
  return "Failed";
}

export function ActivityPage() {
  const wallet = useWalletState();
  const address = wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;
  const chainId = wallet.status === "ready" ? wallet.chainId : null;
  const emptyActivity: ProtocolActivity[] = [];
  const activity = useSyncExternalStore(
    (listener) => (address && chainId ? subscribeProtocolActivity(listener) : () => undefined),
    () => (address && chainId ? readProtocolActivity(address, chainId) : emptyActivity),
    () => emptyActivity
  );

  if (dappPreviewEnabled && wallet.status === "unconfigured") {
    return <ActivityPreview />;
  }
  if (wallet.status !== "ready" || !wallet.address || !wallet.chainId) {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Activity</p>
        <h2>Connect your wallet to see local Statics activity.</h2>
      </section>
    );
  }

  return (
    <section className="activity-panel" aria-labelledby="activity-title">
      <div>
        <p className="dapp-section-label">Wallet and network scoped</p>
        <h2 id="activity-title">Protocol activity</h2>
        <p>Pending and receipt-confirmed actions stored only in this browser.</p>
      </div>
      {activity.length === 0 ? (
        <p className="activity-empty">
          No Statics activity for this wallet on chain {wallet.chainId}.
        </p>
      ) : (
        <ol>
          {activity.map((item) => (
            <ActivityItem key={item.id} activity={item} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityItem({ activity }: { activity: ProtocolActivity }) {
  const displayHash = activity.confirmedHash ?? activity.replacementHash ?? activity.hash;
  const explorerUrl = displayHash ? getTransactionExplorerUrl(activity.chainId, displayHash) : null;
  const hashLabel = displayHash ? `${displayHash.slice(0, 10)}…${displayHash.slice(-8)}` : null;

  return (
    <li>
      <div>
        <strong>{activity.label}</strong>
        <span>{activity.amount}</span>
      </div>
      <div>
        <strong className={`activity-status is-${activity.status}`}>{statusLabel(activity)}</strong>
        <time dateTime={new Date(activity.createdAt).toISOString()}>
          {new Date(activity.createdAt).toLocaleString()}
        </time>
      </div>
      {displayHash &&
        (explorerUrl ? (
          <a
            className="activity-hash"
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            title={displayHash}
          >
            {hashLabel} ↗
          </a>
        ) : (
          <code title={displayHash}>{hashLabel}</code>
        ))}
      {activity.replacementHash && activity.hash && (
        <p>
          Original transaction {activity.hash.slice(0, 10)}…{activity.hash.slice(-8)}
        </p>
      )}
      {activity.error && <p>{activity.error}</p>}
    </li>
  );
}
