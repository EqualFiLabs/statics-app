"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { useWalletState } from "@/providers/wallet-context";

export function WalletConnectionDialog() {
  const wallet = useWalletState();
  const t = useTranslations("walletConnection");
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (!wallet.walletPickerOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") wallet.closeWalletPicker();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [wallet]);

  if (!wallet.walletPickerOpen || typeof document === "undefined") return null;

  const hasEmbeddedWallet = wallet.walletOptions.some((option) => option.kind === "embedded");

  return createPortal(
    <div
      className="wallet-dialog-backdrop"
      role="presentation"
      onMouseDown={wallet.closeWalletPicker}
    >
      <section
        className="wallet-dialog wallet-connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="wallet-dialog-close"
          type="button"
          onClick={wallet.closeWalletPicker}
          aria-label={tCommon("close")}
        >
          ×
        </button>
        <div className="wallet-dialog-content">
          <h2 id="wallet-connection-title">{t("title")}</h2>
          <p className="wallet-connection-description">{t("description")}</p>

          {wallet.identityStatus === "degraded" && (
            <div className="wallet-service-warning" role="status">
              <strong>{t("privyUnavailableTitle")}</strong>
              <p>{t("privyUnavailableDescription")}</p>
            </div>
          )}

          <div className="wallet-option-list">
            {wallet.walletOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => void wallet.connectWalletOption(option.id)}
                disabled={wallet.walletBusyAction !== null}
              >
                <span>{option.name}</span>
                <small>{option.connected ? t("active") : t(option.kind)}</small>
              </button>
            ))}
          </div>

          {wallet.authenticated && !hasEmbeddedWallet && (
            <button
              className="wallet-secondary-action"
              type="button"
              onClick={() => void wallet.createWallet()}
              disabled={wallet.identityBusyAction !== null}
            >
              {wallet.identityBusyAction === "create" ? t("creating") : t("createEmbedded")}
            </button>
          )}

          {wallet.identityStatus === "signed-out" && (
            <button
              className="wallet-secondary-action"
              type="button"
              onClick={wallet.login}
              disabled={wallet.identityBusyAction !== null}
            >
              {t("signInForEmbedded")}
            </button>
          )}

          {wallet.error && (
            <p className="dapp-inline-error" role="alert">
              {wallet.error}
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
