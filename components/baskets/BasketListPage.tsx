"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useTranslations } from "next-intl";

import { basketStatusLabel, loadBasketCatalog } from "@/lib/baskets/baskets";
import {
  ProtocolPendingSurface,
  SurfaceBoundary,
  UnconfiguredSurface,
} from "@/components/common/EmptyState";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { useWalletState } from "@/providers/wallet-context";
import { useDeployment } from "@/providers/deployment-context";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals = 18): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 4).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

export function BasketListPage() {
  const t = useTranslations("baskets");
  const wallet = useWalletState();
  const { active } = useDeployment();
  if (active.deployment?.kind === "launch") {
    return <ProtocolPendingSurface subject="Baskets" />;
  }
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject={t("subject")} />;
  return <BasketListRuntime />;
}

function BasketListRuntime() {
  const t = useTranslations("baskets");
  const wallet = useWalletState();
  const publicClient = usePublicClient();
  const walletAddress =
    wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;
  const catalog = useQuery({
    queryKey: protocolQueryKeys.basketCatalog(
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : undefined,
      walletAddress
    ),
    enabled: deploymentState.status === "configured" && Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadBasketCatalog(publicClient, deploymentState.deployment, walletAddress);
    },
  });

  // The basket catalog is deployment-wide rather than wallet-scoped, so it
  // loads without a wallet. Only the read's own states apply here.
  const surfaceState = deriveSurfaceState({
    walletStatus: "ready",
    isTargetChain: true,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    isEmpty: (catalog.data?.baskets.length ?? 0) === 0,
    hasData: Boolean(catalog.data),
  });

  return (
    <section className="basket-catalog" aria-labelledby="basket-catalog-title">
      <div className="basket-section-heading">
        <div>
          <p className="dapp-section-label">{t("subject")}</p>
          <h2 id="basket-catalog-title">{t("title")}</h2>
        </div>
        <div className="basket-section-actions">
          <span>{t("discovered", { count: catalog.data?.baskets.length ?? 0 })}</span>
        </div>
      </div>
      {catalog.data?.warning && (
        <p className="dollar-warning" role="status">
          {catalog.data.warning}
        </p>
      )}
      {catalog.isError && catalog.data && (
        <p className="dollar-warning" role="status">
          {t("stale")}
        </p>
      )}
      <SurfaceBoundary
        state={deploymentState.status === "unavailable" ? "unconfigured" : surfaceState}
        subject={t("subject")}
        onRetry={() => void catalog.refetch()}
        empty={{
          title: t("emptyTitle"),
          description: t("emptyDescription"),
          action: { label: t("viewPolicy"), href: "/app/create" },
        }}
      >
        {catalog.data && isSurfaceReady(surfaceState) ? (
          <div className="basket-grid">
            {catalog.data.baskets.map((basket) => (
              <Link
                key={basket.basketId.toString()}
                className="basket-card"
                href={`/app/baskets/${basket.basketId.toString()}`}
              >
                <div>
                  <span className={`basket-status is-${basket.status}`}>
                    {basketStatusLabel(basket.status)}
                  </span>
                  <span>#{basket.basketId.toString()}</span>
                </div>
                <h3>{basket.name}</h3>
                <p>{basket.symbol}</p>
                <dl>
                  <div>
                    <dt>{t("underlyings")}</dt>
                    <dd>{basket.constituents.length}</dd>
                  </div>
                  <div>
                    <dt>{t("totalSupply")}</dt>
                    <dd>{displayAmount(basket.totalSupply)}</dd>
                  </div>
                  <div>
                    <dt>{t("yourBalance")}</dt>
                    <dd>{walletAddress ? displayAmount(basket.walletBalance) : t("connect")}</dd>
                  </div>
                </dl>
                <span className="basket-card-link">{t("inspect")} →</span>
              </Link>
            ))}
          </div>
        ) : null}
      </SurfaceBoundary>
    </section>
  );
}
