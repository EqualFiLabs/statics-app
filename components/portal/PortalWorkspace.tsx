"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AcrossBridgePanel } from "@/components/portal/AcrossBridgePanel";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import { SlippageSettingsDialog } from "@/components/portal/SlippageSettingsDialog";
import { SolanaSwapPanel } from "@/components/portal/SolanaSwapPanel";
import { usePortalSlippage } from "@/hooks/usePortalSlippage";
import { writePortalSlippage } from "@/lib/portal/slippage";
import { useWalletState } from "@/providers/wallet-context";
import { useDeployment } from "@/providers/deployment-context";

export type PortalMode = "swap" | "bridge";

export function PortalWorkspace({
  initialMode = "swap",
  initialSwapRuntime = "evm",
  compact = false,
}: {
  initialMode?: PortalMode;
  initialSwapRuntime?: "evm" | "solana";
  compact?: boolean;
}) {
  const t = useTranslations("portal");
  const wallet = useWalletState();
  const { active } = useDeployment();
  const localFork =
    active.deployment?.kind === "launch" && active.deployment.source === "development-fixture";
  const [mode, setMode] = useState<PortalMode>(initialMode);
  const [swapRuntime, setSwapRuntime] = useState<"evm" | "solana">(initialSwapRuntime);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const slippage = usePortalSlippage();

  if (localFork) {
    return (
      <section className={`portal-workspace${compact ? " is-compact" : ""}`}>
        <div className="portal-panel" role="status">
          <p className="dapp-section-label">Local fork funding</p>
          <h2>Use fork-only test funds</h2>
          <p>
            External swaps and bridges are disabled in this isolated Robinhood fork. Fund a
            connected address from this terminal, then use the canonical Trade page.
          </p>
          <code>npm run launch-fork:fund-wallet -- 0xYourWallet --eth 10 --statics 100000</code>
          <Link className="portal-primary-action" href="/app/trade">
            Open canonical Trade →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`portal-workspace${compact ? " is-compact" : ""}`}>
      <div className="portal-header">
        <div className="portal-mode-tabs" role="tablist" aria-label={t("mode")}>
          {(["swap", "bridge"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
            >
              {t(item)}
            </button>
          ))}
        </div>
        <button
          className="portal-settings-button"
          type="button"
          aria-label={t("settings", { slippage })}
          onClick={() => setSettingsOpen(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
          </svg>
        </button>
      </div>

      {settingsOpen && (
        <SlippageSettingsDialog
          value={slippage}
          onApply={writePortalSlippage}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {mode === "swap" && (
        <>
          <div className="portal-chain-tabs" aria-label={t("chainType")}>
            <button
              type="button"
              aria-pressed={swapRuntime === "evm"}
              onClick={() => setSwapRuntime("evm")}
            >
              EVM
            </button>
            <button
              type="button"
              aria-pressed={swapRuntime === "solana"}
              onClick={() => setSwapRuntime("solana")}
            >
              Solana
            </button>
          </div>
          {swapRuntime === "evm" ? <EvmSwapPanel /> : <SolanaSwapPanel />}
        </>
      )}

      {mode === "bridge" && <AcrossBridgePanel />}

      <div className="portal-dollar-route">
        <span>{t("dollarPrompt")}</span>
        <Link href="/app/dollar?profile=USDG">{t("openDollar")} →</Link>
      </div>

      <p className="portal-runtime-state" aria-live="polite">
        {wallet.status === "ready" ? wallet.fundingNetworkName : "--"}
      </p>
    </section>
  );
}
