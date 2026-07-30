"use client";

import { SurfaceEmptyState } from "@/components/common/EmptyState";
import { useWalletState } from "@/providers/wallet-context";

function formatAddress(address: string): string {
  return `${address.slice(0, 10)}…${address.slice(-8)}`;
}

export function WalletSettings() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject="wallet settings"
        empty={{ title: "Wallet unavailable", description: "No wallet is configured." }}
      />
    );
  }

  return (
    <section className="dapp-settings" aria-labelledby="wallet-settings-title">
      <div className="dapp-settings-heading">
        <p className="dapp-section-label">Account</p>
        <h2 id="wallet-settings-title">Wallet settings</h2>
      </div>

      <dl className="dapp-wallet-details">
        <div>
          <dt>Status</dt>
          <dd>{wallet.status === "ready" ? "Connected" : "Not connected"}</dd>
        </div>
        <div>
          <dt>Wallet type</dt>
          <dd>{wallet.walletKind ?? "--"}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{wallet.address ? formatAddress(wallet.address) : "--"}</dd>
        </div>
        <div>
          <dt>Target network</dt>
          <dd>{wallet.networkName}</dd>
        </div>
      </dl>

      {wallet.address && (
        <div className="dapp-settings-actions">
          <button type="button" onClick={() => void wallet.copyAddress()}>
            Copy full address
          </button>
          {wallet.explorerUrl && (
            <a href={wallet.explorerUrl} target="_blank" rel="noreferrer">
              View on explorer ↗
            </a>
          )}
        </div>
      )}

      {wallet.walletKind === "embedded" && (
        <div className="dapp-export-warning">
          <h3>Export embedded wallet</h3>
          <p>
            Exporting reveals recovery material that controls this wallet and every asset it holds.
            Never share it, paste it into a website, or store it in chat or cloud notes.
          </p>
          <button
            type="button"
            onClick={() => void wallet.exportWallet()}
            disabled={wallet.busyAction !== null}
          >
            {wallet.busyAction === "export" ? "Opening secure export…" : "Review secure export"}
          </button>
        </div>
      )}

      {wallet.authenticated && (
        <button
          className="dapp-logout"
          type="button"
          onClick={() => void wallet.logout()}
          disabled={wallet.busyAction !== null}
        >
          {wallet.busyAction === "logout" ? "Signing out…" : "Sign out of Statics"}
        </button>
      )}
    </section>
  );
}
