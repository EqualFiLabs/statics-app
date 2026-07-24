"use client";

import { useState } from "react";

import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
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
  const [amount, setAmount] = useState("");
  const [dollarDirection, setDollarDirection] = useState<"mint" | "redeem">("mint");
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

      {mode === "bridge" && (
        <div className="portal-panel" role="tabpanel">
          <NetworkField />
          <AssetAmountField label="Fund from" value={amount} onChange={setAmount} />
          <div className="portal-destination">
            <span>Destination</span>
            <strong>Robinhood Chain</strong>
            <small>USDG</small>
          </div>
          <dl className="portal-quote-grid">
            <QuoteDatum label="Expected on Robinhood" />
            <QuoteDatum label="Bridge fee" />
            <QuoteDatum label="Estimated time" />
          </dl>
          <button className="portal-primary-action" type="button" disabled>
            Review bridge
          </button>
        </div>
      )}

      {mode === "dollar" && (
        <div className="portal-panel" role="tabpanel">
          <div className="portal-direction-tabs" aria-label="Statics Dollar direction">
            {(["mint", "redeem"] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                aria-pressed={dollarDirection === direction}
                onClick={() => setDollarDirection(direction)}
              >
                {direction}
              </button>
            ))}
          </div>
          <AssetAmountField
            label={
              dollarDirection === "mint" ? "Statics Dollar to receive" : "Statics Dollar to redeem"
            }
            value={amount}
            onChange={setAmount}
          />
          <dl className="portal-quote-grid">
            <QuoteDatum label={dollarDirection === "mint" ? "Maximum USDG" : "Minimum USDG"} />
            <QuoteDatum label="Protocol fee" />
            <QuoteDatum label="Profile" />
          </dl>
          <button className="portal-primary-action" type="button" disabled>
            {dollarDirection === "mint" ? "Review mint" : "Review redemption"}
          </button>
        </div>
      )}

      <p className="portal-runtime-state" aria-live="polite">
        {wallet.status === "ready" ? wallet.fundingNetworkName : "--"}
      </p>
    </section>
  );
}

function NetworkField() {
  const wallet = useWalletState();
  return (
    <label className="portal-field">
      <span>Funding network</span>
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
  );
}

function AssetAmountField({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="portal-field portal-asset-field">
      <span>{label}</span>
      <div>
        <input
          inputMode="decimal"
          value={value}
          readOnly={readOnly}
          placeholder="0.00"
          onChange={(event) => onChange?.(event.target.value)}
        />
        <button type="button">Select asset</button>
      </div>
      <small>--</small>
    </label>
  );
}

function QuoteDatum({ label }: { label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>--</dd>
    </div>
  );
}
