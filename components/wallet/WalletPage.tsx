"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther } from "viem";

import { PortalWorkspace } from "@/components/portal/PortalWorkspace";
import { useWalletState } from "@/providers/wallet-context";

type WalletModal = "send" | "receive" | "portal" | null;

export function WalletPage() {
  const wallet = useWalletState();
  const [modal, setModal] = useState<WalletModal>(null);
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshBalance = async () => {
    if (!wallet.address || !wallet.fundingWalletOnSelectedChain) return;
    setRefreshing(true);
    try {
      const provider = await wallet.getEthereumProvider();
      const value = await provider?.request({
        method: "eth_getBalance",
        params: [wallet.address, "latest"],
      });
      if (typeof value === "string") setNativeBalance(formatEther(BigInt(value)));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshBalance();
    // The callback intentionally refreshes only when wallet identity or funding chain changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address, wallet.fundingChainId, wallet.fundingWalletOnSelectedChain]);

  return (
    <>
      <section className="wallet-surface">
        <div className="wallet-network-row">
          <label>
            <span>Network</span>
            <select
              value={wallet.fundingChainId}
              onChange={(event) => void wallet.selectFundingNetwork(Number(event.target.value))}
            >
              {wallet.fundingNetworks.map((network) => (
                <option key={network.chainId} value={network.chainId}>
                  {network.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void refreshBalance()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="wallet-balance-hero">
          <span>{wallet.fundingNetworkName}</span>
          <strong>{nativeBalance === null ? "--" : Number(nativeBalance).toFixed(5)}</strong>
          <small>
            {wallet.fundingNetworks.find((network) => network.chainId === wallet.fundingChainId)
              ?.nativeSymbol ?? "--"}
          </small>
        </div>

        <div className="wallet-quick-actions">
          <button type="button" onClick={() => setModal("send")}>
            <span>↑</span>Send
          </button>
          <button type="button" onClick={() => setModal("receive")}>
            <span>↓</span>Receive
          </button>
          <button type="button" onClick={() => setModal("portal")}>
            <span>⇄</span>Portal
          </button>
        </div>

        <div className="wallet-assets">
          <div className="wallet-section-heading">
            <div>
              <span>{"// Assets"}</span>
              <h2>Tokens</h2>
            </div>
            <Link href="/app/activity">Activity →</Link>
          </div>
          <div className="wallet-asset-row">
            <div className="wallet-token-mark" aria-hidden="true">
              {wallet.fundingNetworks
                .find((network) => network.chainId === wallet.fundingChainId)
                ?.nativeSymbol.slice(0, 1) ?? "—"}
            </div>
            <div>
              <strong>
                {wallet.fundingNetworks.find((network) => network.chainId === wallet.fundingChainId)
                  ?.nativeSymbol ?? "--"}
              </strong>
              <span>Native asset</span>
            </div>
            <div>
              <strong>{nativeBalance === null ? "--" : Number(nativeBalance).toFixed(5)}</strong>
              <span>--</span>
            </div>
          </div>
        </div>
      </section>

      {modal && <WalletDialog mode={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function WalletDialog({
  mode,
  onClose,
}: {
  mode: Exclude<WalletModal, null>;
  onClose: () => void;
}) {
  const wallet = useWalletState();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="wallet-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`wallet-dialog${mode === "portal" ? " is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "portal" ? "Funding Portal" : mode}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="wallet-dialog-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        {mode === "portal" ? (
          <PortalWorkspace compact />
        ) : mode === "receive" ? (
          <div className="wallet-dialog-content">
            <span>{"// Receive"}</span>
            <h2>{wallet.fundingNetworkName}</h2>
            <code>{wallet.address ?? "--"}</code>
            <button
              className="portal-primary-action"
              type="button"
              disabled={!wallet.address}
              onClick={() => void wallet.copyAddress()}
            >
              Copy address
            </button>
          </div>
        ) : (
          <div className="wallet-dialog-content">
            <span>{"// Send"}</span>
            <h2>Send asset</h2>
            <label className="portal-field">
              <span>Recipient</span>
              <input placeholder="0x…" />
            </label>
            <label className="portal-field">
              <span>Amount</span>
              <input inputMode="decimal" placeholder="0.00" />
            </label>
            <button className="portal-primary-action" type="button" disabled>
              Review send
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
