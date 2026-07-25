"use client";

import { useState } from "react";

import { AcrossBridgePanel } from "@/components/portal/AcrossBridgePanel";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import { PeggedDollarPanel } from "@/components/portal/PeggedDollarPanel";
import { SolanaSwapPanel } from "@/components/portal/SolanaSwapPanel";
import { useWalletState } from "@/providers/wallet-context";

export type PortalMode = "swap" | "bridge" | "dollar";

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

  return (
    <section className={`portal-workspace${compact ? " is-compact" : ""}`}>
      <div className="portal-mode-tabs" role="tablist" aria-label="Portal mode">
        {(["swap", "bridge", "dollar"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
          >
            {item === "dollar" ? "Statics Dollar" : item}
          </button>
        ))}
      </div>

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
