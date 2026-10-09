"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { useEarnPortfolio, mergeEarnRewardSources } from "@/hooks/useEarnPortfolio";
import {
  earnViews,
  earnHref,
  readEarnFilters,
  sourceForView,
  type EarnView,
  type RewardClaimScope,
} from "@/lib/rewards/earn";
import { EarnPositionsTable } from "./EarnPositionsTable";
import { EarnStakeForm } from "./EarnStakeForm";
import { LiquidityRewardsTable } from "./LiquidityRewardsTable";
import { AllocationsTable } from "./AllocationsTable";
import styles from "./earn.module.css";

export function EarnPage({
  deployment,
  view: requestedView = "overview",
  initialPositionId = null,
}: {
  deployment: PhaseOneDeployment;
  view?: EarnView;
  initialPositionId?: bigint | null;
}) {
  const cache = useQueryClient();
  const t = useTranslations("earnUx"),
    router = useRouter(),
    params = useSearchParams();
  let filters = { ...readEarnFilters(new URLSearchParams(params.toString())) };
  // Preserve older position-management deep links, without taking over other deployments.
  const view =
    requestedView === "overview" && (params.has("positionId") || initialPositionId !== null)
      ? "staking"
      : requestedView;
  if (view === "overview") filters = { share: "lp", invalid: false };
  if (filters.positionId === undefined && initialPositionId !== null && !filters.invalid)
    filters.positionId = initialPositionId;
  const redirectUrl =
    requestedView === "overview" && view === "staking"
      ? params.toString()
        ? `/app/rewards/staking?${params}`
        : earnHref("staking", filters)
      : view === "overview" && params.toString()
        ? "/app/rewards"
        : null;
  useEffect(() => {
    if (redirectUrl) router.replace(redirectUrl);
  }, [redirectUrl, router]);
  const data = useEarnPortfolio(deployment, view, filters),
    { action, positions } = data;
  const sources = sourceForView(view),
    rows = mergeEarnRewardSources(data.rewards);
  const loading =
    action.ready && positions.items.length > 0 && data.rewards.some((query) => query.isLoading);
  const incomplete =
    data.ownershipIncomplete ||
    data.rewards.some(
      (query) =>
        query.isError ||
        query.data?.some(
          (row) =>
            row.globalUnavailable ||
            row.discoveryUnavailable ||
            row.pools.some(
              (pool) => !pool.rewards || pool.lpUnavailable || pool.allocatorUnavailable
            )
        )
    );
  const scope: RewardClaimScope = {
    sources,
    positionId: filters.positionId,
    poolId: view === "staking" ? undefined : filters.poolId,
    asset: filters.asset,
  };
  // Tables keep their selection and staged edits while ownership and reward reads load; they
  // reset only when the wallet, network, deployment or filters change.
  const tableKey = `${view}:${params}:${action.wallet}:${deployment.descriptor.deploymentId}:${deployment.descriptor.chainId}:${deployment.contracts.diamond}:${action.walletState.chainId}`;
  const poolIds = [
    ...new Map(
      [
        ...deployment.supportedPools.map((pool) => pool.poolId),
        ...rows.flatMap((row) => row.pools.map((pool) => pool.poolId)),
      ].map((pool) => [pool.toLowerCase(), pool])
    ).values(),
  ];
  const assets = [
    ...new Map(
      [
        ...deployment.supportedPools.flatMap((pool) => [pool.token0.address, pool.token1.address]),
        ...rows.flatMap((row) => [
          ...(row.global?.claimAssets ?? []),
          ...row.pools.flatMap((pool) => [
            ...(pool.rewards?.lp.assets.slice(0, pool.rewards.lp.slotCount) ?? []),
            ...(pool.rewards?.allocator.map((entry) => entry.asset) ?? []),
          ]),
        ]),
      ].map((asset) => [asset.toLowerCase(), asset])
    ).values(),
  ];
  const missingPosition =
    Boolean(action.wallet) &&
    positions.isSuccess &&
    !data.ownershipLoading &&
    !data.ownershipIncomplete &&
    filters.positionId !== undefined &&
    !positions.items.some((position) => position.positionId === filters.positionId);
  // Allocations focuses pools from the indexer directory, which the manifest may not list.
  const unknownPool =
    view === "gauge" &&
    !loading &&
    !data.ownershipLoading &&
    filters.poolId &&
    !poolIds.some((pool) => pool.toLowerCase() === filters.poolId?.toLowerCase());
  const unknownAsset =
    view === "gauge" &&
    !loading &&
    !data.ownershipLoading &&
    filters.asset &&
    !assets.some((asset) => asset.toLowerCase() === filters.asset?.toLowerCase());
  const invalid = filters.invalid || missingPosition || unknownPool || unknownAsset;
  const heading = view === "overview" ? t("title") : t(view);
  const refresh = () =>
    void cache.invalidateQueries({
      predicate: (query) =>
        [
          "phase-one-positions",
          "phase-one-position",
          "phase-one-rewards",
          "phase-one-gauges",
        ].includes(String(query.queryKey[0])) &&
        query.queryKey[1] === deployment.descriptor.deploymentId &&
        query.queryKey.includes(action.wallet),
    });
  return (
    <div className={styles.page}>
      {view !== "overview" && (
        <Link className={styles.breadcrumb} href="/app/rewards">
          ← {t("title")}
        </Link>
      )}
      <header className={styles.header}>
        <div>
          <h1>{heading}</h1>
          <p>{t(`${view}Help`)}</p>
        </div>
      </header>
      <nav className={styles.nav} aria-label={t("featureNavigation")}>
        <Link href={earnHref("overview")} aria-current={view === "overview" ? "page" : undefined}>
          {t("positions")}
        </Link>
        {earnViews.map((feature) => (
          <Link
            key={feature}
            href={earnHref(feature, filters)}
            aria-current={feature === view ? "page" : undefined}
          >
            {t(feature)}
          </Link>
        ))}
      </nav>
      {!action.ready && <ActionReview action={action} />}
      {(action.walletState.status === "loading" ||
        data.ownershipLoading ||
        loading ||
        incomplete) && (
        <div className={styles.notice} role="status">
          {incomplete ? t("incomplete") : t("loadingPortfolio")}
          {incomplete && (
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={refresh}
            >
              {t("refresh")}
            </button>
          )}
        </div>
      )}
      {invalid && (
        <div className={styles.notice} role="alert">
          {missingPosition ? t("notOwned") : t("invalidFilters")}
          <Link href={earnHref(view)} className="ui-button ui-button--secondary ui-button--sm">
            {t("resetFilters")}
          </Link>
        </div>
      )}
      {view === "overview" ? (
        <EarnPositionsTable
          deployment={deployment}
          action={action}
          positions={positions.items}
          rewardRows={rows}
          rewardsLoading={loading}
          rewardsIncomplete={
            data.ownershipIncomplete || data.rewards.some((query) => query.isError)
          }
          ownershipLoading={data.ownershipLoading}
        />
      ) : view === "gauge" ? (
        !invalid && (
          <LiquidityRewardsTable
            key={tableKey}
            deployment={deployment}
            action={action}
            rows={rows}
            loading={loading || data.ownershipLoading}
            incomplete={data.ownershipIncomplete || data.rewards.some((query) => query.isError)}
            initialPoolId={filters.poolId}
            scope={scope}
          />
        )
      ) : view === "staking" ? (
        // Wait for ownership so a foreign or missing position ID never triggers reads.
        !invalid &&
        action.ready &&
        (!data.ownershipLoading || positions.items.length > 0) && (
          <EarnStakeForm
            key={`${deployment.descriptor.deploymentId}:${action.wallet}:${params}`}
            deployment={deployment}
            action={action}
            positions={positions.items}
            requestedPositionId={filters.positionId}
          />
        )
      ) : (
        !invalid && (
          <AllocationsTable
            key={tableKey}
            deployment={deployment}
            action={action}
            positions={positions.items}
            rows={rows}
            loading={loading || data.ownershipLoading}
            incomplete={data.ownershipIncomplete || data.rewards.some((query) => query.isError)}
            initialPoolId={filters.poolId}
            initialUnlock={filters.unlock}
            scope={scope}
          />
        )
      )}
    </div>
  );
}
