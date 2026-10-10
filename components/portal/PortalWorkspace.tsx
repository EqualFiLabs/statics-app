"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AcrossBridgePanel } from "@/components/portal/AcrossBridgePanel";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import { SolanaSwapPanel } from "@/components/portal/SolanaSwapPanel";
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
  const [mode, setMode] = useState<PortalMode>(initialMode);
  const [swapRuntime, setSwapRuntime] = useState<"evm" | "solana">(initialSwapRuntime);

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
      </div>

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

      {active.descriptor.capabilities.includes("dollar") && (
        <div className="portal-dollar-route">
          <span>{t("dollarPrompt")}</span>
          <Link href="/app/dollar?profile=USDG">{t("openDollar")} →</Link>
        </div>
      )}

      <p className="portal-runtime-state" aria-live="polite">
        {wallet.status === "ready" ? wallet.fundingNetworkName : "--"}
      </p>
    </section>
  );
}
