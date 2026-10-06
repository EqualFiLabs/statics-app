"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { formatUnits, type Hex } from "viem";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { IndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import { readPositionGlobalRewards } from "@/lib/phase-one/staking";
import { readPositionGaugeRewards } from "@/lib/phase-one/gauges";
import {
  discoverPositionRewardPools,
  loadPositionRewardPortfolio,
  mapRewardReads,
  portfolioRewardAmounts,
  totalPortfolioRewards,
  type RewardAmount,
  type RewardSource,
} from "@/lib/phase-one/reward-portfolio";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import styles from "./reward-portfolio.module.css";
import { BatchRewardClaim } from "./BatchRewardClaim";

export function PhaseOneRewardPortfolio({
  deployment,
  positions,
  loadingPositions,
  incompletePositions = false,
  onManage,
}: {
  deployment: PhaseOneDeployment;
  positions: readonly IndexedPhaseOnePosition[];
  loadingPositions: boolean;
  incompletePositions?: boolean;
  onManage: (positionId: bigint, poolId: Hex | null) => void;
}) {
  const t = useTranslations("earnPortfolio");
  const e = useTranslations("earn");
  const r = useTranslations("rewards");
  const action = usePhaseOneAction(deployment);
  const cache = useQueryClient();
  const id = deployment.descriptor.deploymentId;
  const key = [
    "phase-one-rewards",
    id,
    action.wallet,
    "portfolio",
    positions.map((p) => String(p.positionId)).join(","),
  ] as const;
  const portfolio = useQuery({
    queryKey: key,
    enabled: action.ready && positions.length > 0,
    staleTime: 30_000,
    retry: false,
    queryFn: () =>
      mapRewardReads(positions, (position) => {
        const input = {
          publicClient: action.publicClient!,
          deployment,
          account: action.wallet!,
          positionId: position.positionId,
        };
        return loadPositionRewardPortfolio({
          positionId: position.positionId,
          global: () =>
            cache.fetchQuery({
              queryKey: [
                "phase-one-rewards",
                id,
                action.wallet,
                String(position.positionId),
                "global",
              ],
              staleTime: 30_000,
              retry: false,
              queryFn: () => readPositionGlobalRewards(input),
            }),
          discovery: () =>
            cache.fetchQuery({
              queryKey: [
                "phase-one-gauges",
                id,
                action.wallet,
                String(position.positionId),
                "reward-pools",
              ],
              staleTime: 60_000,
              retry: false,
              queryFn: () => discoverPositionRewardPools(input),
            }),
          pool: (poolId, hasLp) =>
            cache.fetchQuery({
              queryKey: protocolQueryKeys.phaseOneRewards(
                id,
                action.wallet,
                position.positionId,
                poolId
              ),
              staleTime: 30_000,
              retry: false,
              queryFn: () =>
                readPositionGaugeRewards({ ...input, poolId, includeProtocolAccrual: hasLp }),
            }),
        });
      }),
  });
  const rows = portfolio.data ?? [];
  const incomplete = rows.some(
    (p) => p.globalUnavailable || p.discoveryUnavailable || p.pools.some((pool) => !pool.rewards)
  );
  const sources: readonly { kind: RewardSource; label: string }[] = [
    { kind: "global", label: e("staking") },
    { kind: "gauge", label: e("liquidity") },
    { kind: "lp-bribe", label: e("lpBribes") },
    { kind: "allocator", label: e("allocatorBribes") },
  ];
  const tokens = new Map(
    deployment.supportedPools
      .flatMap((pool) => [pool.token0, pool.token1])
      .map((token) => [token.address.toLowerCase(), token])
  );
  const amounts = (entries: readonly RewardAmount[], unavailable = false) => {
    if (unavailable) return <span className="earn-muted">{e("rewardsUnavailable")}</span>;
    const positive = entries.filter((entry) => entry.amount > 0n);
    if (!positive.length) return <span className="earn-muted">{e("noRewards")}</span>;
    return positive.map((entry) => {
      const token = tokens.get(entry.asset.toLowerCase());
      const statics = entry.asset.toLowerCase() === deployment.contracts.statics.toLowerCase();
      return (
        <p className="is-numeric" key={entry.asset}>
          {token || statics
            ? `${formatUnits(entry.amount, token?.decimals ?? 18)} ${token?.symbol ?? "STATICS"}`
            : t("unknownAsset", {
                amount: String(entry.amount),
                asset: `${entry.asset.slice(0, 6)}…${entry.asset.slice(-4)}`,
              })}
        </p>
      );
    });
  };
  const poolName = (poolId: Hex) => {
    const pool = deployment.supportedPools.find(
      (p) => p.poolId.toLowerCase() === poolId.toLowerCase()
    );
    return pool
      ? `${pool.token0.symbol}/${pool.token1.symbol}`
      : t("unknownPool", { pool: `${poolId.slice(0, 10)}…${poolId.slice(-4)}` });
  };
  const manage = (positionId: bigint, poolId: Hex | null, label: string) => (
    <a
      className="ui-button ui-button--secondary ui-button--sm"
      href="#earn-position-details"
      aria-label={`${t("manage")} ${label}`}
      onClick={() => onManage(positionId, poolId)}
    >
      {t("manage")}
    </a>
  );
  return (
    <section className={`ui-card ${styles.portfolio}`} aria-label={t("title")}>
      <div className="earn-card-heading">
        <div>
          <h2>{t("title")}</h2>
          <p className="earn-muted">{t("help")}</p>
        </div>
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          disabled={!action.ready || portfolio.isFetching}
          onClick={() =>
            void cache.invalidateQueries({
              predicate: (query) =>
                ["phase-one-rewards", "phase-one-gauges"].includes(String(query.queryKey[0])) &&
                query.queryKey[1] === id &&
                query.queryKey[2] === action.wallet,
            })
          }
        >
          {t("refresh")}
        </button>
      </div>
      <BatchRewardClaim
        deployment={deployment}
        rows={rows}
        loading={loadingPositions || portfolio.isPending || portfolio.isFetching}
        incomplete={incompletePositions || incomplete || portfolio.isError}
      />
      <p className="earn-muted">
        {t("coverage", {
          positions: positions.length,
          pools: new Set(rows.flatMap((p) => p.pools.map((pool) => pool.poolId.toLowerCase())))
            .size,
        })}
      </p>
      {(loadingPositions || (action.ready && portfolio.isPending && positions.length > 0)) && (
        <p role="status">{e("loadingRewards")}</p>
      )}
      {(incomplete || portfolio.isError) && <p role="alert">{t("partial")}</p>}
      {rows.length > 0 && (
        <>
          <div className={styles.totals}>
            {sources.map((source) => (
              <article key={source.kind} aria-label={`${t("total")} ${source.label}`}>
                <h3>{source.label}</h3>
                {amounts(totalPortfolioRewards(rows, source.kind))}
              </article>
            ))}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{t("breakdown")}</caption>
              <thead>
                <tr>
                  <th>{t("position")}</th>
                  <th>{t("pool")}</th>
                  {sources.map((source) => (
                    <th key={source.kind}>{source.label}</th>
                  ))}
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((position) => {
                  const label = r("positionNumber", { id: String(position.positionId) });
                  return [
                    <tr key={`${position.positionId}:global`}>
                      <th scope="row">
                        {label}
                        <p className="earn-muted">
                          {formatUnits(
                            positions.find((p) => p.positionId === position.positionId)
                              ?.stakedBalance ?? 0n,
                            18
                          )}{" "}
                          STATICS {t("staked")}
                        </p>
                      </th>
                      <td>{t("allAssets")}</td>
                      <td>
                        {amounts(
                          portfolioRewardAmounts(position, "global"),
                          position.globalUnavailable
                        )}
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{manage(position.positionId, null, label)}</td>
                    </tr>,
                    ...(position.discoveryUnavailable
                      ? [
                          <tr key={`${position.positionId}:error`}>
                            <th scope="row">{label}</th>
                            <td colSpan={6}>{e("rewardsUnavailable")}</td>
                          </tr>,
                        ]
                      : []),
                    ...position.pools.map((pool) => (
                      <tr key={`${position.positionId}:${pool.poolId}`}>
                        <th scope="row">{label}</th>
                        <td>{poolName(pool.poolId)}</td>
                        <td>—</td>
                        {sources.slice(1).map((source) => (
                          <td key={source.kind}>
                            {(source.kind === "allocator" && pool.hasAllocator) ||
                            (source.kind !== "allocator" && pool.hasLp)
                              ? amounts(
                                  portfolioRewardAmounts(position, source.kind, pool.poolId),
                                  !pool.rewards
                                )
                              : "—"}
                          </td>
                        ))}
                        <td>
                          {manage(
                            position.positionId,
                            pool.poolId,
                            `${label} ${poolName(pool.poolId)}`
                          )}
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
