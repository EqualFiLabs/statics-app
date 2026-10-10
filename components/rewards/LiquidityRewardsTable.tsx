"use client";
import Link from "next/link";
import { Fragment, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";
import {
  claimScopeIncomplete,
  earnHref,
  rewardDisplay,
  rewardPoolName,
  rewardRowKey,
  scopeRewardAmounts,
  type RewardClaimScope,
} from "@/lib/rewards/earn";
import {
  legInRange,
  legPeriodEstimate,
  legShareBps,
  liquidityStatus,
  needsLiquidityAttention,
  poolPeriodEmission,
  type GaugeLegState,
  type LiquidityStatus,
} from "@/lib/rewards/liquidity-rewards";
import { formatDuration } from "@/lib/rewards/time";
import { useLiquidityGauges } from "@/hooks/useLiquidityGauges";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { useTableRewardClaim } from "./useTableRewardClaim";
import { CompactLiquidityPools, type CompactLiquidityPool } from "./CompactLiquidityPools";
import { RangeBar } from "./RangeBar";
import { FloatingSelectedActions } from "./FloatingSelectedActions";
import { ReviewDrawer } from "./ReviewDrawer";
import { BatchRewardClaim } from "./BatchRewardClaim";
import { RewardAmounts } from "./RewardAmounts";
import styles from "./earn.module.css";

const sources: RewardClaimScope["sources"] = ["gauge", "lp-bribe"];
const filters = ["all", "attention", "earning", "out-of-range", "no-emissions", "stopped"] as const;
type Filter = (typeof filters)[number];
const tone: Record<LiquidityStatus, "positive" | "warning" | "negative" | "neutral"> = {
  earning: "positive",
  "out-of-range": "warning",
  "no-emissions": "warning",
  stopped: "negative",
  "no-liquidity": "neutral",
  unavailable: "neutral",
};

const compactQuery = "(max-width: 1199px)";
function subscribeCompactLayout(notify: () => void) {
  const media = window.matchMedia?.(compactQuery);
  media?.addEventListener("change", notify);
  return () => media?.removeEventListener("change", notify);
}
function readCompactLayout() {
  return window.matchMedia?.(compactQuery).matches ?? false;
}
const serverCompactLayout = () => false;

export function LiquidityRewardsTable({
  deployment,
  action,
  rows,
  loading,
  incomplete,
  initialPoolId,
  scope,
}: {
  deployment: PhaseOneDeployment;
  action: ReturnType<typeof usePhaseOneAction>;
  rows: readonly PositionRewardPortfolio[];
  loading: boolean;
  incomplete: boolean;
  /** Older links focus one pool: pre-fill the search and expand it. */
  initialPoolId?: Hex;
  scope: RewardClaimScope;
}) {
  const t = useTranslations("liquidityRewards");
  const compact = useSyncExternalStore(
    subscribeCompactLayout,
    readCompactLayout,
    serverCompactLayout
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState(() =>
    initialPoolId ? rewardPoolName(deployment, initialPoolId) : ""
  );
  const [expanded, setExpanded] = useState<readonly string[]>(() =>
    initialPoolId ? [initialPoolId] : []
  );
  const context = `${deployment.descriptor.deploymentId}:${deployment.descriptor.chainId}:${deployment.contracts.diamond}:${action.wallet}:${action.walletState.chainId}:${scope.positionId ?? "all"}:${scope.poolId ?? "all"}:${scope.asset ?? "all"}:${filter}:${search}`;
  const [selection, setSelection] = useState<{ context: string; keys: string[] }>({
    context,
    keys: [],
  });
  const setSelected = (keys: string[]) => setSelection({ context, keys });
  const changeFilter = (value: Filter) => {
    setSelected([]);
    setFilter(value);
  };
  const changeSearch = (value: string) => {
    setSelected([]);
    setSearch(value);
  };

  const legs = rows.flatMap((row) =>
    row.pools
      .filter((pool) => pool.hasLp)
      .map((pool) => ({ positionId: row.positionId, poolId: pool.poolId }))
  );
  const gauges = useLiquidityGauges(deployment, action, legs);
  // Reserve views are stored state. An expired period must be checkpointed before
  // its budget can describe the current period; claim previews remain independent.
  const currentReserve =
    gauges.reserve &&
    (!gauges.reserve.activated ||
      (gauges.now !== undefined && gauges.now < gauges.reserve.periodFinish))
      ? gauges.reserve
      : undefined;
  const estimatePlaceholder = gauges.loading ? "…" : "—";
  const poolIds = [...new Map(legs.map((leg) => [leg.poolId.toLowerCase(), leg.poolId])).values()];
  const pools = poolIds.map((poolId) => {
    const positions = legs.filter((leg) => leg.poolId.toLowerCase() === poolId.toLowerCase());
    const state = gauges.poolOf(poolId);
    const legStates = positions
      .map((leg) => gauges.legOf(leg.positionId, poolId))
      .filter((leg): leg is GaugeLegState => Boolean(leg));
    const known = Boolean(state) && legStates.length === positions.length;
    const status = state && known ? liquidityStatus(state, legStates, currentReserve) : undefined;
    return {
      poolId,
      name: rewardPoolName(deployment, poolId),
      positions,
      state,
      legStates,
      status,
      emission: state && currentReserve ? poolPeriodEmission(state, currentReserve) : undefined,
      estimate:
        state && currentReserve && known
          ? legStates.reduce((sum, leg) => sum + legPeriodEstimate(leg, state, currentReserve), 0n)
          : undefined,
      shareBps:
        state && known
          ? legStates.reduce((sum, leg) => sum + legShareBps(leg, state), 0n)
          : undefined,
      keys: positions.map((leg) => rewardRowKey(leg.positionId, poolId)),
    };
  });
  // Out of range, no emissions or stopped — or a stopped gauge still holding claimable rewards.
  const needsAttention = (pool: (typeof pools)[number]) =>
    Boolean(
      (pool.status && needsLiquidityAttention(pool.status)) ||
      (pool.state?.stopped &&
        scopeRewardAmounts(rows, { ...scope, sources, poolId: pool.poolId }).length > 0)
    );
  const matches = (pool: (typeof pools)[number], value: Filter) =>
    value === "all" || (value === "attention" ? needsAttention(pool) : pool.status === value);
  const text = search.trim().toLowerCase();
  const visible = pools.filter(
    (pool) => matches(pool, filter) && (!text || pool.name.toLowerCase().includes(text))
  );
  const visibleKeys = new Set(visible.flatMap((pool) => pool.keys));
  const selected =
    selection.context === context ? selection.keys.filter((key) => visibleKeys.has(key)) : [];
  const count = (value: Filter) => pools.filter((pool) => matches(pool, value)).length;
  const allLegs = pools.flatMap((pool) =>
    pool.state ? pool.legStates.map((leg) => ({ leg, pool: pool.state! })) : []
  );
  const liveLegs = allLegs.filter(({ leg }) => leg.liquidity > 0n);
  const inRange = liveLegs.filter(({ leg, pool }) => legInRange(leg, pool)).length;
  const estimateKnown = pools.every((pool) => pool.estimate !== undefined);
  const weekEstimate = pools.reduce((sum, pool) => sum + (pool.estimate ?? 0n), 0n);
  const attention = count("attention");
  const periodLeft =
    gauges.reserve && gauges.now !== undefined && gauges.reserve.periodFinish > gauges.now
      ? gauges.reserve.periodFinish - gauges.now
      : undefined;
  const allScope: RewardClaimScope = { ...scope, sources };
  const selectedScope: RewardClaimScope = { ...allScope, selectedRows: selected };
  const statics = (amount: bigint) => rewardDisplay(amount, 18).display;
  const percent = (bps: bigint) =>
    `${(Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  const toggleKeys = (keys: readonly string[], checked: boolean) =>
    setSelected(
      checked ? [...new Set([...selected, ...keys])] : selected.filter((key) => !keys.includes(key))
    );
  const selectAll = (
    <input
      type="checkbox"
      aria-label={t("selectAllPositions")}
      disabled={visibleKeys.size === 0}
      checked={visibleKeys.size > 0 && selected.length === visibleKeys.size}
      ref={(node) => {
        if (node) node.indeterminate = selected.length > 0 && selected.length < visibleKeys.size;
      }}
      onChange={(event) => toggleKeys([...visibleKeys], event.target.checked)}
    />
  );
  const tableClaim = useTableRewardClaim({
    deployment,
    action,
    rows,
    loading,
    incomplete: incomplete,
    context: `${context}:${selection.context === context ? selection.keys.join(",") : ""}`,
  });
  const collect = (rowScope: RewardClaimScope, accessibleLabel: string, label = t("collect")) =>
    scopeRewardAmounts(rows, rowScope).length > 0
      ? tableClaim.collect(rowScope, label, accessibleLabel)
      : null;
  const statusLabel = (status: LiquidityStatus | undefined) =>
    status && (status !== "unavailable" || !gauges.loading)
      ? t(`status.${status}`)
      : t(gauges.loading ? "loading" : "status.unavailable");
  const liquidityHref = (positionId: bigint, poolId: Hex) =>
    `/app/liquidity?positionId=${positionId}&poolId=${poolId}`;

  const [summaryDialog, setSummaryDialog] = useState({ context, open: false });
  if (summaryDialog.context !== context || (!compact && summaryDialog.open))
    setSummaryDialog({ context, open: false });
  const summaryDetails = (
    <>
      {" "}
      <div className={styles.summaryChip}>
        <span className={styles.chipLabel}>{t("estimate")}</span>
        <span className={styles.chipValue}>
          {estimateKnown && gauges.reserve ? statics(weekEstimate) : "—"} <small>STATICS</small>
        </span>
        <span className={styles.chipMeta}>
          {periodLeft !== undefined
            ? t("periodEnds", { time: formatDuration(periodLeft) })
            : gauges.reserve && !gauges.reserve.activated
              ? t("notActivated")
              : gauges.reserve?.activated && !currentReserve
                ? t("periodUnavailable")
                : t("estimateHelp")}
        </span>
      </div>
      <div className={styles.summaryChip}>
        <span className={styles.chipLabel}>{t("inRange")}</span>
        <span className={styles.chipValue}>
          {t("inRangeValue", { inRange, total: liveLegs.length })}
        </span>
        <span className={styles.chipMeta}>{t("inRangeHelp")}</span>
      </div>
      <button
        type="button"
        className={`${styles.summaryChip} ${styles.attentionChip}`}
        onClick={() => changeFilter("attention")}
        aria-label={t("showAttention", { count: attention })}
      >
        <span className={styles.chipLabel}>{t("attention")}</span>
        <span className={styles.chipValue}>{attention}</span>
        <span className={styles.chipMeta}>{t("attentionHelp")}</span>
      </button>
    </>
  );
  const poolActions = (pool: CompactLiquidityPool) => (
    <>
      {collect(
        { ...allScope, poolId: pool.poolId },
        t(pool.positions.length > 1 ? "collectAllPool" : "collectPool", { pool: pool.name }),
        t(pool.positions.length > 1 ? "collectAll" : "collect")
      )}
      {pool.status === "no-emissions" && (
        <Link
          className="ui-button ui-button--secondary ui-button--sm"
          href={earnHref("allocations", {
            positionId: pool.positions[0].positionId,
            poolId: pool.poolId,
          })}
        >
          {t("allocate")}
        </Link>
      )}
    </>
  );
  const positionActions = (pool: CompactLiquidityPool, positionId: bigint) => (
    <>
      {collect(
        { ...allScope, positionId, poolId: pool.poolId },
        t("collectLeg", { id: String(positionId), pool: pool.name })
      )}
      <Link
        className="ui-button ui-button--ghost ui-button--sm"
        href={liquidityHref(positionId, pool.poolId)}
      >
        {t("manage")}
      </Link>
    </>
  );
  const poolStatus = (pool: CompactLiquidityPool) => (
    <span
      className={styles.statusPill}
      data-tone={pool.status ? tone[pool.status] : "neutral"}
      title={pool.status ? t(`statusHelp.${pool.status}`) : undefined}
    >
      {statusLabel(pool.status)}
    </span>
  );
  const toggleExpanded = (poolId: Hex) =>
    setExpanded((previous) =>
      previous.some((entry) => entry.toLowerCase() === poolId.toLowerCase())
        ? previous.filter((entry) => entry.toLowerCase() !== poolId.toLowerCase())
        : [...previous, poolId]
    );

  return (
    <div className={`${styles.positionsSection} ${styles.liquiditySection}`}>
      <section
        className={compact ? styles.compactSummary : styles.summaryChips}
        aria-label={t("summary")}
      >
        <div className={styles.summaryChip}>
          <div className={styles.chipHeading}>
            <span className={styles.chipLabel}>{t("claimable")}</span>
            <BatchRewardClaim
              key={`${context}:all`}
              deployment={deployment}
              rows={rows}
              loading={loading}
              incomplete={incomplete || claimScopeIncomplete(rows, allScope)}
              scope={allScope}
              scopeKey={`liquidity:${context}:all`}
              label={t("collect")}
            />
          </div>
          <RewardAmounts
            deployment={deployment}
            amounts={scopeRewardAmounts(rows, allScope)}
            preview
          />
          {compact && (
            <button
              type="button"
              className={`ui-button ui-button--ghost ui-button--sm ${styles.summaryMore}`}
              aria-haspopup="dialog"
              onClick={() => setSummaryDialog({ context, open: true })}
            >
              {t("more")}
            </button>
          )}
        </div>
        {!compact && summaryDetails}
      </section>
      {compact && summaryDialog.context === context && summaryDialog.open && (
        <ReviewDrawer
          title={t("summary")}
          variant="fullscreen"
          onClose={() => setSummaryDialog({ context, open: false })}
        >
          <div className={styles.summaryDetails}>{summaryDetails}</div>
        </ReviewDrawer>
      )}

      <div className={styles.controlBar}>
        <div className={styles.statusTabs} role="group" aria-label={t("statusFilter")}>
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
            >
              {t(`filter.${value}`)} <span className={styles.tabCount}>{count(value)}</span>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <span className={styles.srOnly}>{t("search")}</span>
          <input
            type="search"
            value={search}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => changeSearch(event.target.value)}
          />
        </label>
      </div>

      <div className={compact ? styles.compactFrame : styles.tableFrame}>
        {compact ? (
          <CompactLiquidityPools
            deployment={deployment}
            rows={rows}
            scope={allScope}
            pools={visible}
            expanded={expanded}
            selected={selected}
            selectAll={selectAll}
            onExpand={toggleExpanded}
            onSelect={toggleKeys}
            poolActions={poolActions}
            positionActions={positionActions}
            poolStatus={poolStatus}
            legOf={gauges.legOf}
            reserve={currentReserve}
            estimatePlaceholder={estimatePlaceholder}
            dataPending={gauges.loading}
          />
        ) : (
          <table className={`${styles.positionsTable} ${styles.liquidityTable}`}>
            <colgroup>
              <col style={{ width: 48 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 80 }} />
              <col />
              <col />
              <col />
              <col />
              <col style={{ width: 210 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>
                  {selectAll}
                </th>
                <th scope="col">{t("column.pool")}</th>
                <th scope="col" className={styles.numeric}>
                  {t("column.share")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.poolEmission")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.estimate")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.emissions")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.incentives")}
                </th>
                <th scope="col">
                  <span className={styles.srOnly}>{t("column.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((pool) => {
                const open = expanded.some(
                  (entry) => entry.toLowerCase() === pool.poolId.toLowerCase()
                );
                const chosen = pool.keys.filter((key) => selected.includes(key)).length;
                return (
                  <Fragment key={pool.poolId}>
                    <tr className={chosen ? styles.selectedRow : undefined}>
                      <td className={styles.checkCell}>
                        <input
                          type="checkbox"
                          aria-label={t("selectPool", { pool: pool.name })}
                          checked={chosen > 0 && chosen === pool.keys.length}
                          ref={(node) => {
                            if (node) node.indeterminate = chosen > 0 && chosen < pool.keys.length;
                          }}
                          onChange={(event) => toggleKeys(pool.keys, event.target.checked)}
                        />
                      </td>
                      <td>
                        <div className={styles.positionName}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            aria-expanded={open}
                            aria-label={t(open ? "collapse" : "expand", { pool: pool.name })}
                            onClick={() =>
                              setExpanded(
                                open
                                  ? expanded.filter(
                                      (entry) => entry.toLowerCase() !== pool.poolId.toLowerCase()
                                    )
                                  : [...expanded, pool.poolId]
                              )
                            }
                          >
                            {open ? "▾" : "▸"}
                          </button>
                          <span>{pool.name}</span>
                          <span
                            className={styles.statusPill}
                            data-tone={pool.status ? tone[pool.status] : "neutral"}
                            title={pool.status ? t(`statusHelp.${pool.status}`) : undefined}
                          >
                            {statusLabel(pool.status)}
                          </span>
                        </div>
                        <span className={styles.cellMeta}>
                          {t("positionCount", { count: pool.positions.length })}
                        </span>
                      </td>
                      <td className={styles.numeric}>
                        {pool.shareBps === undefined ? "…" : percent(pool.shareBps)}
                      </td>
                      <td className={styles.numeric}>
                        {pool.emission === undefined ? estimatePlaceholder : statics(pool.emission)}
                      </td>
                      <td className={styles.numeric}>
                        {pool.estimate === undefined ? estimatePlaceholder : statics(pool.estimate)}
                      </td>
                      <td className={styles.numeric}>
                        <RewardAmounts
                          deployment={deployment}
                          amounts={scopeRewardAmounts(rows, {
                            ...scope,
                            sources: ["gauge"],
                            poolId: pool.poolId,
                          })}
                          preview
                        />
                      </td>
                      <td className={styles.numeric}>
                        <RewardAmounts
                          deployment={deployment}
                          amounts={scopeRewardAmounts(rows, {
                            ...scope,
                            sources: ["lp-bribe"],
                            poolId: pool.poolId,
                          })}
                          preview
                        />
                      </td>
                      <td className={styles.rowActions}>{poolActions(pool)}</td>
                    </tr>
                    {open &&
                      pool.positions.map(({ positionId }) => {
                        const key = rewardRowKey(positionId, pool.poolId);
                        const leg = gauges.legOf(positionId, pool.poolId);
                        const state = pool.state;
                        const reserve = currentReserve;
                        return (
                          <tr
                            key={key}
                            className={selected.includes(key) ? styles.selectedRow : undefined}
                          >
                            <td className={styles.checkCell}>
                              <input
                                type="checkbox"
                                aria-label={t("selectLeg", {
                                  id: String(positionId),
                                  pool: pool.name,
                                })}
                                checked={selected.includes(key)}
                                onChange={(event) => toggleKeys([key], event.target.checked)}
                              />
                            </td>
                            <td>
                              <div className={styles.legCell}>
                                <span>{t("position", { id: String(positionId) })}</span>
                                {leg && state ? (
                                  <RangeBar leg={leg} pool={state} />
                                ) : (
                                  <span className={styles.cellMeta}>…</span>
                                )}
                              </div>
                            </td>
                            <td className={styles.numeric}>
                              {leg && state ? percent(legShareBps(leg, state)) : "…"}
                            </td>
                            <td />
                            <td className={styles.numeric}>
                              {leg && state && reserve
                                ? statics(legPeriodEstimate(leg, state, reserve))
                                : estimatePlaceholder}
                            </td>
                            <td className={styles.numeric}>
                              <RewardAmounts
                                deployment={deployment}
                                amounts={scopeRewardAmounts(rows, {
                                  ...scope,
                                  sources: ["gauge"],
                                  positionId,
                                  poolId: pool.poolId,
                                })}
                                empty={false}
                              />
                            </td>
                            <td className={styles.numeric}>
                              <RewardAmounts
                                deployment={deployment}
                                amounts={scopeRewardAmounts(rows, {
                                  ...scope,
                                  sources: ["lp-bribe"],
                                  positionId,
                                  poolId: pool.poolId,
                                })}
                                empty={false}
                              />
                            </td>
                            <td className={styles.rowActions}>
                              {positionActions(pool, positionId)}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && visible.length === 0 && (
          <div className={styles.tableEmpty}>
            <p>{pools.length ? t("noMatches") : t("noLiquidity")}</p>
            {pools.length ? (
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                onClick={() => {
                  changeFilter("all");
                  changeSearch("");
                }}
              >
                {t("clearFilters")}
              </button>
            ) : (
              <Link className="ui-button ui-button--secondary ui-button--sm" href="/app/liquidity">
                {t("addLiquidity")}
              </Link>
            )}
          </div>
        )}
        {gauges.unavailable && <p className={styles.tableEmpty}>{t("gaugeUnavailable")}</p>}
      </div>

      {selected.length > 0 && (
        <FloatingSelectedActions label={t("bulkActions")}>
          <strong>{t("selectedCount", { count: selected.length })}</strong>
          {tableClaim.collect(selectedScope, t("collectSelected"), t("collectSelected"), false)}
          <button
            type="button"
            className={`ui-button ui-button--ghost ui-button--sm ${styles.bulkClear}`}
            onClick={() => setSelected([])}
          >
            {t("clearSelection")}
          </button>
        </FloatingSelectedActions>
      )}
      {tableClaim.review}
    </div>
  );
}
