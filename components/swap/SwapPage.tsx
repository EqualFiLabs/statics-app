"use client";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { GenesisVaultSwapPanel } from "@/components/genesis/GenesisVaultSwapPanel";
import { EvmSwapPanel } from "@/components/portal/EvmSwapPanel";
import { useDeployment } from "@/providers/deployment-context";

type SwapMode = "token" | "nft";

export function SwapPage() {
  const t = useTranslations("trade");
  const { active } = useDeployment();
  const searchParams = useSearchParams();
  const requestedMode = searchParams?.get("mode");
  const requestedAction = searchParams?.get("action");
  const requestedOperatorId = searchParams?.get("operatorId");
  const routeKey = searchParams?.toString() ?? "";
  const [modeOverride, setModeOverride] = useState<{ routeKey: string; mode: SwapMode } | null>(
    null
  );
  const mode: SwapMode =
    modeOverride?.routeKey === routeKey
      ? modeOverride.mode
      : requestedMode === "nft"
        ? "nft"
        : "token";
  if (!active.launch && !active.phaseOne) {
    return (
      <EmptyState
        title={t("marketUnavailable")}
        description={
          active.descriptor.unavailableReason ??
          t("launchUnavailable", { network: active.descriptor.network })
        }
      />
    );
  }

  return (
    <div className="swap-page">
      <div className="portal-direction-tabs" role="tablist" aria-label={t("swapType")}>
        {(["token", ...(active.launch ? (["nft"] as const) : [])] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setModeOverride({ routeKey, mode: item })}
          >
            {item === "token" ? t("token") : t("operatorNft")}
          </button>
        ))}
      </div>
      {mode === "token" ? (
        <EvmSwapPanel
          staticsNetwork
          initialIn={searchParams?.get("in") ?? undefined}
          initialOut={searchParams?.get("out") ?? undefined}
        />
      ) : active.launch ? (
        <GenesisVaultSwapPanel
          key={`${active.launch.descriptor.deploymentId}-${requestedAction}-${requestedOperatorId}`}
          deployment={active.launch}
          initialDirection={requestedAction === "redeem" ? "redeem" : "acquire"}
          initialOperatorId={requestedOperatorId ?? undefined}
        />
      ) : null}
    </div>
  );
}
