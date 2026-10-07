"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { useEarnPortfolio, mergeEarnRewardSources } from "@/hooks/useEarnPortfolio";
import { portfolioRewardAmounts } from "@/lib/phase-one/reward-portfolio";
import {
  earnViews,
  earnHref,
  readEarnFilters,
  rewardRowKey,
  rewardDisplay,
  rewardPoolName,
  rewardToken,
  scopeRewardAmounts,
  sourceForView,
  type EarnView,
  type RewardClaimScope,
  type EarnFilters,
  claimScopeIncomplete,
} from "@/lib/rewards/earn";
import { BatchRewardClaim } from "./BatchRewardClaim";
import { RewardAmounts } from "./RewardAmounts";
import { EarnPositionManagement } from "./EarnPositionManagement";
import { EarnPositionsTable } from "./EarnPositionsTable";
import { BribeSchedule } from "./BribeSchedule";
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
  const sources = sourceForView(view, filters.share),
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
  const context = `${view}:${params}:${action.wallet}:${deployment.descriptor.deploymentId}:${positions.items.map((position) => position.positionId).join(",")}`;
  const [selection, setSelection] = useState<{ context: string; rows: string[] }>({
    context,
    rows: [],
  });
  const selected = selection.context === context ? selection.rows : [];
  const [paging, setPaging] = useState({ context, page: 0 });
  const page = paging.context === context ? paging.page : 0;
  const [funding, setFunding] = useState<{ context: string; poolId: Hex } | null>(null);
  const poolIds = [
    ...new Map(
      [
        ...deployment.supportedPools.map((pool) => pool.poolId),
        ...rows.flatMap((row) => row.pools.map((pool) => pool.poolId)),
        ...data.allocations.flatMap(
          (query) => query.data?.allocations.map((entry) => entry.poolId) ?? []
        ),
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
  const unknownPool =
    !loading &&
    !data.ownershipLoading &&
    !data.allocations.some((query) => query.isPending || query.isError) &&
    filters.poolId &&
    !poolIds.some((pool) => pool.toLowerCase() === filters.poolId?.toLowerCase());
  const unknownAsset =
    !loading &&
    !data.ownershipLoading &&
    filters.asset &&
    !assets.some((asset) => asset.toLowerCase() === filters.asset?.toLowerCase());
  const invalid = filters.invalid || missingPosition || unknownPool || unknownAsset;
  const ownedFilteredPositions = positions.items.filter(
    (position) => filters.positionId === undefined || position.positionId === filters.positionId
  );
  const visiblePositions = ownedFilteredPositions.filter(
    (position) =>
      !filters.asset ||
      !rows.find((row) => row.positionId === position.positionId)?.global ||
      rows
        .find((row) => row.positionId === position.positionId)
        ?.global?.claimAssets.some((asset) => asset.toLowerCase() === filters.asset?.toLowerCase())
  );
  const poolRows = [
    ...new Map(
      rows
        .flatMap((row) =>
          row.pools
            .filter((pool) => (sources.includes("allocator") ? pool.hasAllocator : pool.hasLp))
            .map((pool) => [pool.poolId.toLowerCase(), pool.poolId] as const)
        )
        .filter(
          ([, pool]) => !filters.poolId || pool.toLowerCase() === filters.poolId.toLowerCase()
        )
    ).values(),
  ]
    .map((poolId) => ({
      poolId,
      positions: rows.filter((row) =>
        row.pools.some(
          (pool) =>
            pool.poolId.toLowerCase() === poolId.toLowerCase() &&
            (sources.includes("allocator") ? pool.hasAllocator : pool.hasLp) &&
            (!filters.asset ||
              !pool.rewards ||
              sources.some((source) =>
                portfolioRewardAmounts(row, source, pool.poolId).some(
                  (entry) => entry.asset.toLowerCase() === filters.asset?.toLowerCase()
                )
              ))
        )
      ),
    }))
    .filter((pool) => pool.positions.length > 0);
  const filteredKeys =
    view === "staking"
      ? visiblePositions.map((position) => rewardRowKey(position.positionId))
      : poolRows.flatMap((pool) =>
          pool.positions.map((position) => rewardRowKey(position.positionId, pool.poolId))
        );
  const select = (keys: string[], checked: boolean) =>
    setSelection({
      context,
      rows: [
        ...new Set(
          checked ? [...selected, ...keys] : selected.filter((key) => !keys.includes(key))
        ),
      ],
    });
  const navigateFilter = (key: keyof EarnFilters, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/app/rewards/${view}${next.size ? `?${next}` : ""}`);
  };
  const allocationLoading = data.allocations.some((query) => query.isPending);
  const allocationIncomplete =
    data.ownershipIncomplete || data.allocations.some((query) => query.isError);
  const staked = positions.items.reduce((total, position) => total + position.stakedBalance, 0n);
  const allocated = data.allocations.reduce(
    (total, query) => total + (query.data?.totalAllocated ?? 0n),
    0n
  );
  const unallocated = data.allocations.reduce((total, query, index) => {
    const stake = positions.items[index]?.stakedBalance ?? 0n;
    return (
      total +
      (query.data && stake > query.data.totalAllocated ? stake - query.data.totalAllocated : 0n)
    );
  }, 0n);
  const managementPosition =
    filters.positionId !== undefined
      ? ownedFilteredPositions[0]
      : [...positions.items].sort((a, b) => (a.positionId < b.positionId ? -1 : 1))[0];
  const allocationValue = (amount: bigint) =>
    !action.wallet
      ? t(action.walletState.status === "loading" ? "loading" : "unavailable")
      : !data.allocations.some((query) => query.data) && (allocationLoading || allocationIncomplete)
        ? t(allocationLoading ? "loading" : "unavailable")
        : `${rewardDisplay(amount, 18).display} STATICS`;
  const scopeKey = `${context}:${invalid}`;
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
  const managementPanel =
    (view === "staking" || view === "allocations") && managementPosition ? (
      <section className={styles.manager} aria-label={t("positionManagement")}>
        <h2>
          {view === "staking"
            ? t("manageStake")
            : t("position", { id: String(managementPosition.positionId) })}
        </h2>
        <EarnPositionManagement
          key={`${context}:${managementPosition.positionId}`}
          deployment={deployment}
          positionId={managementPosition.positionId}
          initialPoolId={filters.poolId ?? null}
          feature={view}
          onPoolChange={(poolId) => navigateFilter("poolId", poolId)}
        />
      </section>
    ) : null;
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
      ) : (
        !invalid && (
          <>
            {view === "bribes" && (
              <div className={styles.nav} role="group" aria-label={t("bribeShare")}>
                <Link
                  href={earnHref("bribes", { ...filters, share: "lp" })}
                  aria-current={filters.share === "lp" ? "page" : undefined}
                >
                  {t("lpShare")}
                </Link>
                <Link
                  href={earnHref("bribes", { ...filters, share: "allocator" })}
                  aria-current={filters.share === "allocator" ? "page" : undefined}
                >
                  {t("allocatorShare")}
                </Link>
              </div>
            )}
            <div className={styles.filters}>
              <label>
                {t("positionFilter")}
                <select
                  value={filters.positionId === undefined ? "" : String(filters.positionId)}
                  onChange={(event) => navigateFilter("positionId", event.target.value)}
                >
                  <option value="">{t("allPositions")}</option>
                  {positions.items.map((position) => (
                    <option key={String(position.positionId)} value={String(position.positionId)}>
                      {t("position", { id: String(position.positionId) })}
                    </option>
                  ))}
                </select>
              </label>
              {view !== "staking" && view !== "allocations" && (
                <label>
                  {t("poolFilter")}
                  <select
                    value={filters.poolId ?? ""}
                    onChange={(event) => navigateFilter("poolId", event.target.value)}
                  >
                    <option value="">{t("allPools")}</option>
                    {poolIds.map((pool) => (
                      <option key={pool} value={pool}>
                        {rewardPoolName(deployment, pool)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {view !== "allocations" && (
                <label>
                  {t("assetFilter")}
                  <select
                    value={filters.asset ?? ""}
                    onChange={(event) => navigateFilter("asset", event.target.value)}
                  >
                    <option value="">{t("allAssets")}</option>
                    {assets.map((asset) => (
                      <option key={asset} value={asset}>
                        {rewardToken(deployment, asset)?.symbol ?? asset}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {view === "allocations" ? (
              <>
                <div className={styles.summary}>
                  <div>
                    <p>{t("staked")}</p>
                    <strong>{rewardDisplay(staked, 18).display} STATICS</strong>
                  </div>
                  <div>
                    <p>{t("allocated")}</p>
                    <strong>{allocationValue(allocated)}</strong>
                  </div>
                  <div>
                    <p>{t("unallocated")}</p>
                    <strong>{allocationValue(unallocated)}</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.toolbar}>
                  <SelectionCheckbox
                    keys={filteredKeys}
                    selected={selected}
                    onChange={select}
                    label={t("selectAll")}
                  />
                  <div className={styles.assets}>
                    <span className={styles.muted}>
                      {t("selected", { count: selected.length })}
                    </span>
                    {selected.length > 0 && (
                      <BatchRewardClaim
                        deployment={deployment}
                        rows={rows}
                        loading={loading || data.ownershipLoading}
                        incomplete={
                          data.ownershipIncomplete ||
                          data.rewards.some((query) => query.isError) ||
                          claimScopeIncomplete(rows, { ...scope, selectedRows: selected })
                        }
                        scope={{ ...scope, selectedRows: selected }}
                        scopeKey={scopeKey}
                        label={t("claimSelected")}
                      />
                    )}
                    <BatchRewardClaim
                      deployment={deployment}
                      rows={rows}
                      loading={loading || data.ownershipLoading}
                      incomplete={incomplete}
                      scope={scope}
                      scopeKey={scopeKey}
                      label={t("claimDisplayed")}
                    />
                  </div>
                </div>
                <div className={view === "staking" ? styles.stakingLayout : undefined}>
                  <div className={styles.list} aria-label={t("rewardList")}>
                    {view === "staking"
                      ? visiblePositions.map((position) => (
                          <article className={styles.row} key={String(position.positionId)}>
                            <div className={styles.rowHeading}>
                              <div>
                                <SelectionCheckbox
                                  keys={[rewardRowKey(position.positionId)]}
                                  selected={selected}
                                  onChange={select}
                                  label={t("position", { id: String(position.positionId) })}
                                />
                                <p className={styles.muted}>
                                  {rewardDisplay(position.stakedBalance, 18).display} STATICS{" "}
                                  {t("staked")}
                                </p>
                              </div>
                              <RewardAmounts
                                deployment={deployment}
                                amounts={scopeRewardAmounts(rows, {
                                  ...scope,
                                  positionId: position.positionId,
                                })}
                                empty={!loading && !incomplete}
                              />
                            </div>
                            <div className={styles.links}>
                              <Link
                                href={earnHref("staking", {
                                  ...filters,
                                  positionId: position.positionId,
                                })}
                              >
                                {t("manageStake")}
                              </Link>
                            </div>
                          </article>
                        ))
                      : poolRows.slice(page * 10, (page + 1) * 10).map((pool) => {
                          const keys = pool.positions.map((position) =>
                            rewardRowKey(position.positionId, pool.poolId)
                          );
                          return (
                            <article className={styles.row} key={pool.poolId}>
                              <div className={styles.rowHeading}>
                                <div>
                                  <SelectionCheckbox
                                    keys={keys}
                                    selected={selected}
                                    onChange={select}
                                    label={rewardPoolName(deployment, pool.poolId)}
                                  />
                                  <p className={styles.muted}>
                                    {t("positionCount", { count: pool.positions.length })}
                                  </p>
                                </div>
                                <RewardAmounts
                                  deployment={deployment}
                                  amounts={scopeRewardAmounts(rows, {
                                    ...scope,
                                    poolId: pool.poolId,
                                  })}
                                  empty={!loading && !incomplete}
                                />
                              </div>
                              <details className={styles.breakdown}>
                                <summary>{t("positionBreakdown")}</summary>
                                {pool.positions.map((position) => (
                                  <div className={styles.child} key={String(position.positionId)}>
                                    <SelectionCheckbox
                                      keys={[rewardRowKey(position.positionId, pool.poolId)]}
                                      selected={selected}
                                      onChange={select}
                                      label={t("position", { id: String(position.positionId) })}
                                    />
                                    <RewardAmounts
                                      deployment={deployment}
                                      amounts={scopeRewardAmounts(rows, {
                                        ...scope,
                                        positionId: position.positionId,
                                        poolId: pool.poolId,
                                      })}
                                    />
                                  </div>
                                ))}
                              </details>
                              <div className={styles.links}>
                                <Link
                                  href={
                                    view === "bribes" && filters.share === "allocator"
                                      ? earnHref("allocations", {
                                          positionId:
                                            filters.positionId ?? pool.positions[0].positionId,
                                          poolId: pool.poolId,
                                        })
                                      : `/app/liquidity?positionId=${filters.positionId ?? pool.positions[0].positionId}&poolId=${pool.poolId}`
                                  }
                                >
                                  {t(
                                    view === "bribes" && filters.share === "allocator"
                                      ? "viewAllocations"
                                      : "manageLiquidity"
                                  )}
                                </Link>
                                <Link
                                  href={earnHref(view === "gauge" ? "bribes" : "gauge", {
                                    ...filters,
                                    poolId: pool.poolId,
                                  })}
                                >
                                  {t(view === "gauge" ? "bribes" : "gauge")}
                                </Link>
                                {view === "bribes" && (
                                  <button
                                    className="ui-button ui-button--ghost ui-button--sm"
                                    type="button"
                                    onClick={() =>
                                      setFunding(
                                        funding?.context === context &&
                                          funding.poolId === pool.poolId
                                          ? null
                                          : { context, poolId: pool.poolId }
                                      )
                                    }
                                  >
                                    {t("funding")}
                                  </button>
                                )}
                              </div>
                              {funding?.context === context && funding.poolId === pool.poolId && (
                                <BribeSchedule
                                  deployment={deployment}
                                  poolId={pool.poolId}
                                  share={filters.share}
                                />
                              )}
                            </article>
                          );
                        })}
                    {!loading &&
                      !(view === "staking" ? visiblePositions.length : poolRows.length) && (
                        <p className={styles.empty}>{t("noMatching")}</p>
                      )}
                  </div>
                  {view === "staking" && managementPanel}
                </div>
                {view !== "staking" && poolRows.length > 10 && (
                  <div className={styles.pagination}>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      disabled={page === 0}
                      onClick={() => setPaging({ context, page: page - 1 })}
                    >
                      {t("previous")}
                    </button>
                    <span>
                      {t("page", { current: page + 1, total: Math.ceil(poolRows.length / 10) })}
                    </span>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      disabled={(page + 1) * 10 >= poolRows.length}
                      onClick={() => setPaging({ context, page: page + 1 })}
                    >
                      {t("next")}
                    </button>
                  </div>
                )}
              </>
            )}
            {view === "allocations" && managementPanel}
            {!data.ownershipLoading && !positions.items.length && (
              <div className={styles.empty}>
                <p>{t("noPositions")}</p>
                <Link className="ui-button ui-button--secondary" href="/app/positions">
                  {t("createPosition")}
                </Link>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
function SelectionCheckbox({
  keys,
  selected,
  onChange,
  label,
}: {
  keys: string[];
  selected: readonly string[];
  onChange: (keys: string[], checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null),
    count = keys.filter((key) => selected.includes(key)).length;
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < keys.length;
  }, [count, keys.length]);
  return (
    <label>
      <input
        ref={ref}
        type="checkbox"
        checked={keys.length > 0 && count === keys.length}
        disabled={!keys.length}
        onChange={(event) => onChange(keys, event.target.checked)}
      />
      {label}
    </label>
  );
}
