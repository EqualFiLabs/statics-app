"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";
import {
  rewardDisplay,
  rewardRowKey,
  scopeRewardAmounts,
  type RewardClaimScope,
} from "@/lib/rewards/earn";
import {
  legPeriodEstimate,
  legShareBps,
  type GaugeLegState,
  type GaugePoolState,
  type GaugeReserveState,
  type LiquidityStatus,
} from "@/lib/rewards/liquidity-rewards";
import { RangeBar } from "./RangeBar";
import { RewardAmounts } from "./RewardAmounts";
import styles from "./earn.module.css";

export type CompactLiquidityPool = {
  poolId: Hex;
  name: string;
  positions: readonly { positionId: bigint }[];
  keys: readonly string[];
  state?: GaugePoolState;
  status?: LiquidityStatus;
  shareBps?: bigint;
  emission?: bigint;
  estimate?: bigint;
};

/** A pool's detail disclosure owns all metrics and actions on narrow screens. */
export function CompactLiquidityPools({
  deployment,
  rows,
  scope,
  pools,
  expanded,
  selected,
  selectAll,
  onExpand,
  onSelect,
  poolActions,
  positionActions,
  poolStatus,
  legOf,
  reserve,
  estimatePlaceholder,
  dataPending,
}: {
  deployment: PhaseOneDeployment;
  rows: readonly PositionRewardPortfolio[];
  scope: RewardClaimScope;
  pools: readonly CompactLiquidityPool[];
  expanded: readonly string[];
  selected: readonly string[];
  selectAll: ReactNode;
  onExpand: (poolId: Hex) => void;
  onSelect: (keys: readonly string[], checked: boolean) => void;
  poolActions: (pool: CompactLiquidityPool) => ReactNode;
  positionActions: (pool: CompactLiquidityPool, positionId: bigint) => ReactNode;
  poolStatus: (pool: CompactLiquidityPool) => ReactNode;
  legOf: (positionId: bigint, poolId: Hex) => GaugeLegState | undefined;
  reserve?: GaugeReserveState;
  estimatePlaceholder: string;
  dataPending: boolean;
}) {
  const t = useTranslations("liquidityRewards");
  const statics = (amount: bigint | undefined) =>
    amount === undefined ? estimatePlaceholder : `${rewardDisplay(amount, 18).display} STATICS`;
  const percent = (bps: bigint | undefined) =>
    bps === undefined
      ? estimatePlaceholder
      : `${(Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  const rewards = (poolId: Hex, source: "gauge" | "lp-bribe", positionId?: bigint) => (
    <RewardAmounts
      deployment={deployment}
      amounts={scopeRewardAmounts(rows, {
        ...scope,
        sources: [source],
        poolId,
        positionId: positionId ?? scope.positionId,
      })}
    />
  );
  return (
    <section className={styles.compactPools} aria-label={t("poolList")}>
      <div className={styles.compactPoolHeading}>
        {selectAll}
        <span>{t("column.pool")}</span>
      </div>
      {pools.map((pool) => {
        const open = expanded.some((id) => id.toLowerCase() === pool.poolId.toLowerCase());
        const chosen = pool.keys.filter((key) => selected.includes(key)).length;
        const detailId = `liquidity-details-${pool.poolId}`;
        return (
          <article
            key={pool.poolId}
            className={styles.compactPool}
            data-selected={chosen > 0 || undefined}
          >
            <div className={styles.compactPoolHeading}>
              <input
                type="checkbox"
                aria-label={t("selectPool", { pool: pool.name })}
                checked={chosen > 0 && chosen === pool.keys.length}
                ref={(node) => {
                  if (node) node.indeterminate = chosen > 0 && chosen < pool.keys.length;
                }}
                onChange={(event) => onSelect(pool.keys, event.target.checked)}
              />
              <button
                type="button"
                className={styles.compactPoolToggle}
                aria-expanded={open}
                aria-controls={detailId}
                aria-label={t(open ? "collapse" : "expand", { pool: pool.name })}
                onClick={() => onExpand(pool.poolId)}
              >
                <span className={styles.compactPoolName}>
                  <strong>{pool.name}</strong>
                  <span className={styles.cellMeta}>
                    {t("positionCount", { count: pool.positions.length })}
                  </span>
                </span>
                {poolStatus(pool)}
                <span aria-hidden="true">{open ? "▾" : "▸"}</span>
              </button>
            </div>
            {open && (
              <div id={detailId} className={styles.compactPoolDetails}>
                <dl className={styles.compactMetrics}>
                  <div>
                    <dt>{t("column.share")}</dt>
                    <dd>{percent(pool.shareBps)}</dd>
                  </div>
                  <div>
                    <dt>{t("column.poolEmission")}</dt>
                    <dd>{statics(pool.emission)}</dd>
                  </div>
                  <div>
                    <dt>{t("column.estimate")}</dt>
                    <dd>{statics(pool.estimate)}</dd>
                  </div>
                  <div>
                    <dt>{t("column.emissions")}</dt>
                    <dd>{rewards(pool.poolId, "gauge")}</dd>
                  </div>
                  <div>
                    <dt>{t("column.incentives")}</dt>
                    <dd>{rewards(pool.poolId, "lp-bribe")}</dd>
                  </div>
                </dl>
                <div className={styles.compactActions}>{poolActions(pool)}</div>
                <h3 className={styles.compactPositionsTitle}>{t("positions")}</h3>
                {pool.positions.map(({ positionId }) => {
                  const leg = legOf(positionId, pool.poolId);
                  const state = pool.state;
                  return (
                    <section
                      key={String(positionId)}
                      className={styles.compactPosition}
                      aria-label={t("position", { id: String(positionId) })}
                    >
                      <div className={styles.compactPositionHeading}>
                        <input
                          type="checkbox"
                          aria-label={t("selectLeg", { id: String(positionId), pool: pool.name })}
                          checked={selected.includes(rewardRowKey(positionId, pool.poolId))}
                          onChange={(event) =>
                            onSelect([rewardRowKey(positionId, pool.poolId)], event.target.checked)
                          }
                        />
                        <h4>{t("position", { id: String(positionId) })}</h4>
                      </div>
                      {leg && state ? (
                        <RangeBar leg={leg} pool={state} />
                      ) : (
                        <span className={styles.cellMeta}>
                          {t(dataPending ? "loading" : "status.unavailable")}
                        </span>
                      )}
                      <dl className={styles.compactMetrics}>
                        <div>
                          <dt>{t("column.share")}</dt>
                          <dd>{percent(leg && state ? legShareBps(leg, state) : undefined)}</dd>
                        </div>
                        <div>
                          <dt>{t("column.estimate")}</dt>
                          <dd>
                            {statics(
                              leg && state && reserve
                                ? legPeriodEstimate(leg, state, reserve)
                                : undefined
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("column.emissions")}</dt>
                          <dd>{rewards(pool.poolId, "gauge", positionId)}</dd>
                        </div>
                        <div>
                          <dt>{t("column.incentives")}</dt>
                          <dd>{rewards(pool.poolId, "lp-bribe", positionId)}</dd>
                        </div>
                      </dl>
                      <div className={styles.compactActions}>
                        {positionActions(pool, positionId)}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
