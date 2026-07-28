"use client";

import { useState } from "react";

import { AcrossBridgePanel } from "@/components/portal/AcrossBridgePanel";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import { PeggedDollarPanel } from "@/components/portal/PeggedDollarPanel";
import { SlippageSettingsDialog } from "@/components/portal/SlippageSettingsDialog";
import { SolanaSwapPanel } from "@/components/portal/SolanaSwapPanel";
import { usePortalSlippage } from "@/hooks/usePortalSlippage";
import { writePortalSlippage } from "@/lib/portal/slippage";
import { useWalletState } from "@/providers/wallet-context";

export type PortalMode = "swap" | "bridge" | "dollar";

const modeLabels: Record<PortalMode, string> = {
  swap: "Swap",
  bridge: "Bridge",
  dollar: "Statics Dollar",
};

export function PortalWorkspace({
  initialMode = "swap",
  compact = false,
}: {
  initialMode?: PortalMode;
  compact?: boolean;
}) {
  const wallet = useWalletState();
  const [mode, setMode] = useState<PortalMode>(initialMode);
  const [swapRuntime, setSwapRuntime] = useState<"evm" | "solana">("evm");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const slippage = usePortalSlippage();

  return (
    <section className={`portal-workspace${compact ? " is-compact" : ""}`}>
      <div className="portal-header">
        <div className="portal-mode-tabs" role="tablist" aria-label="Portal mode">
          {(["swap", "bridge", "dollar"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>
        <button
          className="portal-settings-button"
          type="button"
          aria-label={`Portal settings, slippage ${slippage}%`}
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
          <div className="portal-chain-tabs" aria-label="Swap chain type">
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

      {mode === "dollar" && <PeggedDollarPanel />}

      <p className="portal-runtime-state" aria-live="polite">
        {wallet.status === "ready" ? wallet.fundingNetworkName : "--"}
      </p>
    </section>
  );
}
