"use client";
import { useSearchParams } from "next/navigation";

import { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { GenesisVaultSwapPanel } from "@/components/genesis/GenesisVaultSwapPanel";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import { useDeployment } from "@/providers/deployment-context";

type SwapMode = "token" | "nft";

export function SwapPage() {
  const { active } = useDeployment();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SwapMode>(() =>
    searchParams?.get("mode") === "nft" ? "nft" : "token"
  );
  if (!active.launch) {
    return (
      <EmptyState
        title="Launch market not deployed"
        description={
          active.descriptor.unavailableReason ??
          `The Statics launch is not available on ${active.descriptor.network} yet.`
        }
      />
    );
  }

  return (
    <div className="swap-page">
      <div className="portal-direction-tabs" role="tablist" aria-label="Swap type">
        {(["token", "nft"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
          >
            {item === "token" ? "Token" : "Operator NFT"}
          </button>
        ))}
      </div>
      {mode === "token" ? (
        <EvmSwapPanel canonicalOnly />
      ) : (
        <GenesisVaultSwapPanel deployment={active.launch} />
      )}
    </div>
  );
}
