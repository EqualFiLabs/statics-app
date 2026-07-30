"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useSolanaWalletState } from "@/providers/solana-context";
import { useWalletState } from "@/providers/wallet-context";

/**
 * The account sheet behind the address pill.
 *
 * A person has two addresses here and no reason to know that is unusual, so
 * both are shown together rather than one in the header and the other buried on
 * a panel. Each is copyable on its own, because the one you need depends
 * entirely on which chain you are being asked for.
 */

function CopyableAddress({
  label,
  address,
  hint,
}: {
  label: string;
  address: string | null;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The address stays selectable, so
      // there is still a way to take it.
      setCopied(false);
    }
  };

  return (
    <div className="account-address">
      <div>
        <span>{label}</span>
        {address ? (
          <code title={address}>{address}</code>
        ) : (
          <p className="account-address-empty">{hint}</p>
        )}
      </div>
      {address && (
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? `${label} address copied` : `Copy ${label} address`}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m5 13 4 4 10-10" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a1 1 0 0 1 1-1h9" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const wallet = useWalletState();
  const solana = useSolanaWalletState();
  const solanaAddress = solana.wallets[0]?.address ?? null;

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const disconnect = async () => {
    await wallet.logout();
    onClose();
  };
  const networkLabel =
    wallet.status === "ready" && !wallet.isTargetChain
      ? wallet.chainId === null
        ? "Unknown network"
        : `Chain ${wallet.chainId}`
      : wallet.networkName;

  // Portalled to the body because the header sets backdrop-filter, which makes
  // it a containing block for position:fixed descendants -- inset:0 would
  // otherwise resolve against the 72px header strip and centre the dialog half
  // above the viewport.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="wallet-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="wallet-dialog account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="wallet-dialog-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="wallet-dialog-content">
          <h2 id="account-dialog-title">Your account</h2>

          <dl className="account-details">
            <div>
              <dt>Wallet type</dt>
              <dd>{wallet.walletKind ?? "Connected wallet"}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{networkLabel}</dd>
            </div>
          </dl>

          <CopyableAddress
            label="Ethereum"
            address={wallet.address ?? null}
            hint="No Ethereum address yet."
          />
          <CopyableAddress
            label="Solana"
            address={solanaAddress}
            hint="No Solana wallet yet. One is created the first time you use a Solana route."
          />

          {wallet.explorerUrl && (
            <a
              className="account-explorer"
              href={wallet.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View Ethereum account on explorer ↗
            </a>
          )}

          {wallet.walletKind === "embedded" && (
            <div className="account-export-warning">
              <strong>Export embedded wallet</strong>
              <p>
                Exporting reveals recovery material that controls this wallet and every asset it
                holds. Never share it or paste it into a website, chat, or cloud note.
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

          <button
            className="account-signout"
            type="button"
            onClick={() => void disconnect()}
            disabled={wallet.busyAction !== null}
          >
            {wallet.busyAction === "logout" ? "Signing out…" : "Sign out of Statics"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
