"use client";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { IndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";
import {
  claimScopeIncomplete,
  earnHref,
  rewardDisplay,
  rewardRowKey,
  rewardToken,
  scopeRewardAmounts,
  type RewardClaimScope,
} from "@/lib/rewards/earn";
import {
  coolingDown,
  earnPositionStatus,
  earnStatusFilters,
  freeStake,
  matchesSearch,
  matchesStatusFilter,
  needsAttention,
  sortEarnRows,
  staleAllocation,
  type EarnPositionRow,
  type EarnPositionStatus,
  type EarnSort,
  type EarnSortField,
  type EarnStatusFilter,
} from "@/lib/rewards/position-table";
import {
  readHiddenPositions,
  subscribeHiddenPositions,
  writeHiddenPositions,
} from "@/lib/rewards/hidden-positions";
import { useEarnPositionTable } from "@/hooks/useEarnPositionTable";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { BatchRewardClaim } from "./BatchRewardClaim";
import { RewardAmounts } from "./RewardAmounts";
import styles from "./earn.module.css";

const PAGE_SIZE = 25;
const allSources: RewardClaimScope["sources"] = ["global", "gauge", "lp-bribe", "allocator"];

const statusTone: Record<EarnPositionStatus, "negative" | "warning" | "positive" | "neutral"> = {
  loading: "neutral",
  unavailable: "neutral",
  empty: "neutral",
  "earning-nothing": "negative",
  "stale-allocation": "negative",
  cooldown: "warning",
  maturing: "warning",
  earning: "positive",
};

export function EarnPositionsTable({
  deployment,
  action,
  positions,
  rewardRows,
  rewardsLoading,
  rewardsIncomplete,
  ownershipLoading,
}: {
  deployment: PhaseOneDeployment;
  action: ReturnType<typeof usePhaseOneAction>;
  positions: readonly IndexedPhaseOnePosition[];
  rewardRows: readonly PositionRewardPortfolio[];
  rewardsLoading: boolean;
  rewardsIncomplete: boolean;
  ownershipLoading: boolean;
}) {
  const t = useTranslations("earnTable");
  const deploymentId = deployment.descriptor.deploymentId;
  const { rows, now } = useEarnPositionTable(deployment, action, positions);
  const hiddenSnapshot = useSyncExternalStore(
    subscribeHiddenPositions,
    () => JSON.stringify(readHiddenPositions(deploymentId, action.wallet)),
    () => "[]"
  );
  const hidden = useMemo(() => JSON.parse(hiddenSnapshot) as string[], [hiddenSnapshot]);
  const [showHidden, setShowHidden] = useState(false);
  const [status, setStatus] = useState<EarnStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EarnSort>({ field: "staked", direction: "desc" });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const selectionContext = `${deploymentId}:${action.wallet}:${status}:${search}:${showHidden}:${hiddenSnapshot}`;
  const [selection, setSelection] = useState<{ context: string; ids: string[] }>({
    context: selectionContext,
    ids: [],
  });
  if (selection.context !== selectionContext) {
    setSelection({ context: selectionContext, ids: [] });
  }
  const selected = selection.context === selectionContext ? selection.ids : [];
  const setSelected = (ids: string[]) => setSelection({ context: selectionContext, ids });

  const symbolOf = (asset: `0x${string}`) => rewardToken(deployment, asset)?.symbol;
  const visibleRows = rows.filter((row) => showHidden || !hidden.includes(String(row.positionId)));
  const searched = visibleRows.filter((row) => matchesSearch(row, search, symbolOf));
  const filtered = sortEarnRows(
    searched.filter((row) => matchesStatusFilter(row, status, now)),
    sort
  );
  const shown = filtered.slice(0, limit);
  // Hiding is a display preference; wallet-wide summaries and collection include every owned NFT.
  const activeRows = rows;
  const activeIds = new Set(activeRows.map((row) => row.positionId));
  const activeRewardRows = rewardRows.filter((row) => activeIds.has(row.positionId));

  const totalStaked = activeRows.reduce((sum, row) => sum + row.stakedBalance, 0n);
  const allocationKnown = activeRows.every((row) => row.allocation);
  const totalAllocated = activeRows.reduce(
    (sum, row) => sum + (row.allocation?.lockedStake ?? 0n),
    0n
  );
  const totalStale = activeRows.reduce((sum, row) => sum + staleAllocation(row), 0n);
  const totalFree = activeRows.reduce((sum, row) => sum + freeStake(row), 0n);
  const attention = activeRows.filter((row) => needsAttention(earnPositionStatus(row, now))).length;

  const rowKeysFor = (ids: readonly string[]) =>
    rewardRows
      .filter((row) => ids.includes(String(row.positionId)))
      .flatMap((row) => [
        rewardRowKey(row.positionId),
        ...row.pools.map((pool) => rewardRowKey(row.positionId, pool.poolId)),
      ]);
  const allScope: RewardClaimScope = {
    sources: allSources,
    selectedRows: rowKeysFor(activeRows.map((row) => String(row.positionId))),
  };
  const selectedScope: RewardClaimScope = {
    sources: allSources,
    selectedRows: rowKeysFor(selected),
  };
  const claimLoading = rewardsLoading || ownershipLoading;
  const scopeKey = `${deploymentId}:${action.wallet}:${hiddenSnapshot}`;

  const toggleHidden = (ids: readonly string[], hide: boolean) => {
    writeHiddenPositions(
      deploymentId,
      action.wallet,
      hide ? [...hidden, ...ids] : hidden.filter((id) => !ids.includes(id))
    );
    if (hide) setSelected(selected.filter((id) => !ids.includes(id)));
  };
  const sortBy = (field: EarnSortField) =>
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === "desc" ? "asc" : "desc",
    }));
  const sortLabel = (field: EarnSortField) =>
    sort.field === field ? (sort.direction === "asc" ? "↑" : "↓") : "";
  const ariaSort = (field: EarnSortField) =>
    sort.field === field ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const shownIds = shown.map((row) => String(row.positionId));
  const statusCount = (filter: EarnStatusFilter) =>
    searched.filter((row) => matchesStatusFilter(row, filter, now)).length;
  const statics = (amount: bigint) => rewardDisplay(amount, 18).display;

  return (
    <div className={styles.positionsSection}>
      <section className={styles.summaryChips} aria-label={t("summary")}>
        <div className={styles.summaryChip}>
          <span className={styles.chipLabel}>{t("totalStaked")}</span>
          <span className={styles.chipValue}>
            {statics(totalStaked)} <small>STATICS</small>
          </span>
          <span className={styles.chipMeta}>
            {t("positionCount", { count: activeRows.length })}
            {hidden.length > 0 && ` · ${t("hiddenCount", { count: hidden.length })}`}
          </span>
        </div>
        <div className={styles.summaryChip}>
          <div className={styles.chipHeading}>
            <span className={styles.chipLabel}>{t("claimable")}</span>
            <BatchRewardClaim
              deployment={deployment}
              rows={activeRewardRows}
              loading={claimLoading}
              incomplete={rewardsIncomplete || claimScopeIncomplete(activeRewardRows, allScope)}
              scope={allScope}
              scopeKey={`${scopeKey}:all`}
              label={t("collect")}
            />
          </div>
          <RewardAmounts
            deployment={deployment}
            amounts={scopeRewardAmounts(activeRewardRows, { sources: allSources })}
            preview
          />
          {claimLoading && <span className={styles.chipMeta}>{t("loading")}</span>}
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.chipLabel}>{t("allocated")}</span>
          <span className={styles.chipValue}>
            {allocationKnown ? statics(totalAllocated) : "—"} <small>STATICS</small>
          </span>
          <span className={styles.chipMeta}>
            {totalStale > 0n && `${t("staleAmount", { amount: statics(totalStale) })} · `}
            {t("freeAmount", { amount: allocationKnown ? statics(totalFree) : "—" })}
          </span>
        </div>
        <button
          type="button"
          className={`${styles.summaryChip} ${styles.attentionChip}`}
          onClick={() => {
            setStatus("attention");
            setLimit(PAGE_SIZE);
          }}
          aria-label={t("showAttention", { count: attention })}
        >
          <span className={styles.chipLabel}>{t("attention")}</span>
          <span className={styles.chipValue}>{attention}</span>
          <span className={styles.chipMeta}>{t("attentionHelp")}</span>
        </button>
      </section>

      <div className={styles.tableHeading}>
        <h2>{t("title")}</h2>
      </div>
      <div className={styles.controlBar}>
        <div className={styles.statusTabs} role="group" aria-label={t("statusFilter")}>
          {earnStatusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={status === filter}
              onClick={() => {
                setStatus(filter);
                setLimit(PAGE_SIZE);
              }}
            >
              {t(`filter.${filter}`)} <span className={styles.tabCount}>{statusCount(filter)}</span>
            </button>
          ))}
        </div>
        <div className={styles.controlActions}>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            aria-pressed={showHidden}
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden
              ? t("hidingOff", { count: hidden.length })
              : t("showHidden", { count: hidden.length })}
          </button>
          <label className={styles.search}>
            <span className={styles.srOnly}>{t("search")}</span>
            <input
              type="search"
              value={search}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => {
                setSearch(event.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
          </label>
        </div>
      </div>

      <div className={styles.tableFrame}>
        <table className={styles.positionsTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.checkCell}>
                <SelectAll
                  ids={shownIds}
                  selected={selected}
                  onChange={setSelected}
                  label={t("selectShown")}
                />
              </th>
              <th scope="col">{t("column.position")}</th>
              <th scope="col" className={styles.numeric} aria-sort={ariaSort("staked")}>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => sortBy("staked")}
                >
                  {t("column.staked")} {sortLabel("staked")}
                </button>
              </th>
              <th scope="col">{t("column.assets")}</th>
              <th scope="col" aria-sort={ariaSort("allocated")}>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => sortBy("allocated")}
                >
                  {t("column.allocated")} {sortLabel("allocated")}
                </button>
              </th>
              <th scope="col">{t("column.liquidity")}</th>
              <th scope="col" className={styles.numeric}>
                {t("column.claimable")}
              </th>
              <th scope="col">
                <span className={styles.srOnly}>{t("column.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <PositionTableRow
                key={String(row.positionId)}
                deployment={deployment}
                row={row}
                now={now}
                hidden={hidden.includes(String(row.positionId))}
                selected={selected.includes(String(row.positionId))}
                claimable={scopeRewardAmounts(rewardRows, {
                  sources: allSources,
                  positionId: row.positionId,
                })}
                onSelect={(checked) => {
                  const id = String(row.positionId);
                  setSelected(checked ? [...selected, id] : selected.filter((x) => x !== id));
                }}
                onHide={(hide) => toggleHidden([String(row.positionId)], hide)}
              />
            ))}
          </tbody>
        </table>
        {!ownershipLoading && shown.length === 0 && (
          <div className={styles.tableEmpty}>
            <p>{rows.length ? t("noMatches") : t("noPositions")}</p>
            {rows.length > 0 ? (
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                onClick={() => {
                  setStatus("all");
                  setSearch("");
                  setShowHidden(true);
                }}
              >
                {t("clearFilters")}
              </button>
            ) : (
              <Link className="ui-button ui-button--secondary ui-button--sm" href="/app/positions">
                {t("createPosition")}
              </Link>
            )}
          </div>
        )}
        {ownershipLoading && <p className={styles.tableEmpty}>{t("loadingPositions")}</p>}
        {filtered.length > shown.length && (
          <div className={styles.loadMore}>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => setLimit(limit + PAGE_SIZE)}
            >
              {t("loadMore", { count: filtered.length - shown.length })}
            </button>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className={styles.bulkBar} role="region" aria-label={t("bulkActions")}>
          <strong>{t("selectedCount", { count: selected.length })}</strong>
          <BatchRewardClaim
            deployment={deployment}
            rows={rewardRows.filter((row) => selected.includes(String(row.positionId)))}
            loading={claimLoading}
            incomplete={rewardsIncomplete || claimScopeIncomplete(rewardRows, selectedScope)}
            scope={selectedScope}
            scopeKey={`${scopeKey}:selected:${selectionContext}`}
            label={t("collectSelected")}
          />
          {selected.length === 1 && (
            <>
              <Link
                className="ui-button ui-button--secondary ui-button--sm"
                href={earnHref("staking", { positionId: BigInt(selected[0]) })}
              >
                {t("manageStake")}
              </Link>
              <Link
                className="ui-button ui-button--secondary ui-button--sm"
                href={earnHref("allocations", { positionId: BigInt(selected[0]) })}
              >
                {t("manageAllocations")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => toggleHidden(selected, true)}
          >
            {t("hideSelected")}
          </button>
          <button
            type="button"
            className={`ui-button ui-button--ghost ui-button--sm ${styles.bulkClear}`}
            onClick={() => setSelected([])}
          >
            {t("clearSelection")}
          </button>
        </div>
      )}
    </div>
  );
}

function PositionTableRow({
  deployment,
  row,
  now,
  hidden,
  selected,
  claimable,
  onSelect,
  onHide,
}: {
  deployment: PhaseOneDeployment;
  row: EarnPositionRow;
  now: bigint | undefined;
  hidden: boolean;
  selected: boolean;
  claimable: ReturnType<typeof scopeRewardAmounts>;
  onSelect: (checked: boolean) => void;
  onHide: (hide: boolean) => void;
}) {
  const t = useTranslations("earnTable");
  const id = String(row.positionId);
  const status = earnPositionStatus(row, now);
  const stale = staleAllocation(row);
  const staked = row.stakedBalance;
  const percent = (amount: bigint) =>
    staked > 0n ? `${Number((amount * 10_000n) / staked) / 100}%` : "0%";
  const statics = (amount: bigint) => rewardDisplay(amount, 18).display;
  const cooldownLeft =
    row.allocation && now !== undefined && coolingDown(row, now)
      ? row.allocation.nextAllocationAt - now
      : 0n;
  const statusLabel =
    status === "cooldown"
      ? t("status.cooldown", { time: formatDuration(cooldownLeft) })
      : t(`status.${status}`);
  return (
    <tr
      className={`${selected ? styles.selectedRow : ""} ${hidden ? styles.hiddenRow : ""}`.trim()}
    >
      <td className={styles.checkCell}>
        <input
          type="checkbox"
          checked={selected}
          aria-label={t("selectPosition", { id })}
          onChange={(event) => onSelect(event.target.checked)}
        />
      </td>
      <td>
        <div className={styles.positionName}>
          <span>{t("position", { id })}</span>
          <span className={styles.statusPill} data-tone={statusTone[status]}>
            {statusLabel}
          </span>
        </div>
        {hidden && <span className={styles.cellMeta}>{t("hiddenTag")}</span>}
      </td>
      <td className={styles.numeric}>
        <span className="is-numeric">{statics(staked)}</span>
      </td>
      <td>
        {row.selectedAssets ? (
          <>
            <span
              className={`is-numeric ${row.selectedAssets.length === 0 && staked > 0n ? styles.dangerText : ""}`}
            >
              {row.selectedAssets.length} / {String(row.maximumRewardAssets ?? "—")}
            </span>
            {(row.maturingAssets?.length ?? 0) > 0 &&
              row.maturesAt !== undefined &&
              now !== undefined && (
                <span className={styles.cellMeta}>
                  {t("maturing", {
                    count: row.maturingAssets!.length,
                    time: formatDuration(row.maturesAt - now),
                  })}
                </span>
              )}
          </>
        ) : (
          <span className={styles.cellMeta}>{row.unavailable ? t("unavailable") : "…"}</span>
        )}
      </td>
      <td>
        {row.allocation ? (
          <>
            <div className={styles.allocationBar} aria-hidden="true">
              <span style={{ width: percent(row.allocation.lockedStake) }} />
              <span data-tone="negative" style={{ width: percent(stale) }} />
            </div>
            <span className={styles.cellMeta}>
              {t("allocationSummary", {
                allocated: statics(row.allocation.lockedStake),
                free: statics(freeStake(row)),
                pools: row.allocation.poolCount,
              })}
              {stale > 0n && ` · ${t("staleAmount", { amount: statics(stale) })}`}
            </span>
          </>
        ) : (
          <span className={styles.cellMeta}>{row.unavailable ? t("unavailable") : "…"}</span>
        )}
      </td>
      <td>
        <span className={styles.cellMeta}>
          {row.liquidityLegs > 0n ? t("legs", { count: Number(row.liquidityLegs) }) : "—"}
        </span>
      </td>
      <td className={styles.numeric}>
        <RewardAmounts deployment={deployment} amounts={claimable} preview />
      </td>
      <td className={styles.rowActions}>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={() => onHide(!hidden)}
        >
          {hidden ? t("unhide") : t("hide")}
        </button>
        <Link
          className="ui-button ui-button--secondary ui-button--sm"
          href={earnHref("staking", { positionId: row.positionId })}
        >
          {t("manage")}
        </Link>
      </td>
    </tr>
  );
}

function SelectAll({
  ids,
  selected,
  onChange,
  label,
}: {
  ids: readonly string[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const count = ids.filter((id) => selected.includes(id)).length;
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < ids.length;
  }, [count, ids.length]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      disabled={!ids.length}
      checked={ids.length > 0 && count === ids.length}
      onChange={(event) =>
        onChange(
          event.target.checked
            ? [...new Set([...selected, ...ids])]
            : selected.filter((id) => !ids.includes(id))
        )
      }
    />
  );
}

function formatDuration(seconds: bigint): string {
  const total = Number(seconds > 0n ? seconds : 0n);
  const hours = Math.floor(total / 3600),
    minutes = Math.ceil((total % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}
