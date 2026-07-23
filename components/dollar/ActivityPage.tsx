"use client";

import { useSyncExternalStore } from "react";
import { getAddress } from "viem";

import {
  readDollarActivity,
  subscribeDollarActivity,
  type DollarActivity,
} from "@/lib/dollar/activity";
import { useWalletState } from "@/providers/wallet-context";

function statusLabel(activity: DollarActivity): string {
  if (activity.status === "signing") return "Awaiting signature";
  if (activity.status === "submitted") return "Confirming";
  if (activity.status === "confirmed") return "Confirmed";
  if (activity.status === "replaced") return "Replaced";
  return "Failed";
}

export function ActivityPage() {
  const wallet = useWalletState();
  const address = wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;
  const chainId = wallet.status === "ready" ? wallet.chainId : null;
  const emptyActivity: DollarActivity[] = [];
  const activity = useSyncExternalStore(
    (listener) => (address && chainId ? subscribeDollarActivity(listener) : () => undefined),
    () => (address && chainId ? readDollarActivity(address, chainId) : emptyActivity),
    () => emptyActivity
  );

  if (wallet.status !== "ready" || !wallet.address || !wallet.chainId) {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Activity</p>
        <h2>Connect your wallet to see local Dollar activity.</h2>
      </section>
    );
  }

  return (
    <section className="activity-panel" aria-labelledby="activity-title">
      <div>
        <p className="dapp-section-label">Wallet and network scoped</p>
        <h2 id="activity-title">Dollar activity</h2>
        <p>Pending and receipt-confirmed actions stored only in this browser.</p>
      </div>
      {activity.length === 0 ? (
        <p className="activity-empty">
          No Dollar activity for this wallet on chain {wallet.chainId}.
        </p>
      ) : (
        <ol>
          {activity.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.amount}</span>
              </div>
              <div>
                <strong className={`activity-status is-${item.status}`}>{statusLabel(item)}</strong>
                <time dateTime={new Date(item.createdAt).toISOString()}>
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </div>
              {item.hash && (
                <code title={item.hash}>
                  {item.hash.slice(0, 10)}…{item.hash.slice(-8)}
                </code>
              )}
              {item.error && <p>{item.error}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
