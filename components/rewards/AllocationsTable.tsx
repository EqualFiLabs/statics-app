"use client";
import { Fragment, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Hex } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { IndexedAllocationPool, IndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import { loadIndexedManagedLiquidity } from "@/lib/indexer/phase-one";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";
import {
  claimScopeIncomplete,
  rewardDisplay,
  rewardPoolName,
  rewardRowKey,
  scopeRewardAmounts,
  type RewardClaimScope,
} from "@/lib/rewards/earn";
import {
  allocationStatus,
  directedEmission,
  poolIncentiveEstimates,
  suggestDestination,
  sumAssetAmounts,
  type AllocationStatus,
  type DestinationSuggestion,
} from "@/lib/rewards/allocations";
import { coolingDown, freeStake, staleAllocation } from "@/lib/rewards/position-table";
import { formatDuration } from "@/lib/rewards/time";
import { useEarnPositionTable } from "@/hooks/useEarnPositionTable";
import {
  useAllocationDirectory,
  useAllocationPools,
  useAllocationRules,
} from "@/hooks/useAllocationDirectory";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { useTableRewardClaim } from "./useTableRewardClaim";
import { FloatingSelectedActions } from "./FloatingSelectedActions";
import {
  AllocationEditor,
  planPosition,
  type AllocationEditorStart,
  type AllocationEdits,
} from "./AllocationEditor";
import { AllocationChangeSet } from "./AllocationChangeSet";
import { ReviewDrawer } from "./ReviewDrawer";
import { AllocationDirectory } from "./AllocationDirectory";
import { BatchRewardClaim } from "./BatchRewardClaim";
import { RewardAmounts } from "./RewardAmounts";
import styles from "./earn.module.css";

const sources: RewardClaimScope["sources"] = ["allocator"];
const filters = ["all", "attention", "active", "stale"] as const;
type Filter = (typeof filters)[number];
/** "removed": no current allocation, but allocator rewards earned earlier are still claimable. */
type PoolStatus = AllocationStatus | "removed";
const tone: Record<PoolStatus, "positive" | "warning" | "negative" | "neutral"> = {
  active: "positive",
  stale: "negative",
  removed: "neutral",
  unknown: "neutral",
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

type Entry = Readonly<{
  positionId: bigint;
  amount: bigint;
  status: PoolStatus;
}>;
type PoolRow = Readonly<{
  poolId: Hex;
  name: string;
  pool?: IndexedAllocationPool;
  entries: readonly Entry[];
  status: PoolStatus;
  activeAmount: bigint;
  staleAmount: bigint;
  keys: readonly string[];
  suggestion: DestinationSuggestion | null;
}>;

export function AllocationsTable({
  deployment,
  action,
  positions,
  rows,
  loading,
  incomplete,
  scope,
  initialPoolId,
  initialUnlock,
}: {
  deployment: PhaseOneDeployment;
  action: ReturnType<typeof usePhaseOneAction>;
  positions: readonly IndexedPhaseOnePosition[];
  /** Allocator reward portfolio rows. */
  rows: readonly PositionRewardPortfolio[];
  loading: boolean;
  incomplete: boolean;
  scope: RewardClaimScope;
  /** Older links focus one pool: it is shown expanded. */
  initialPoolId?: Hex;
  /** An unstake shortfall for `scope.positionId`: the editor opens pre-filled to free it. */
  initialUnlock?: bigint;
}) {
  const t = useTranslations("allocations");
  const editorText = useTranslations("allocationEditor");
  const compact = useSyncExternalStore(
    subscribeCompactLayout,
    readCompactLayout,
    serverCompactLayout
  );
  const id = deployment.descriptor.deploymentId;
  const [filter, setFilter] = useState<Filter>("all");
  // A linked pool is already isolated by the claim scope; pre-filling the search with a
  // manifest name could hide a pool the directory labels differently.
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<readonly string[]>(() =>
    initialPoolId ? [initialPoolId] : []
  );
  /** Whether the full-screen pool directory is open. */
  const [browsing, setBrowsing] = useState(false);
  /** The open allocation editor and where it starts; `key` resets it on every open. */
  const [editor, setEditor] = useState<{ key: number; start: AllocationEditorStart } | null>(() =>
    initialUnlock && scope.positionId !== undefined
      ? { key: 0, start: { positionId: scope.positionId, unlock: initialUnlock } }
      : null
  );
  const openEditor = (start: AllocationEditorStart) =>
    setEditor({ key: (editor?.key ?? 0) + 1, start });
  /** "Add & review" asks the change set to open its review once the edits are staged. */
  const [reviewRequest, setReviewRequest] = useState<number | null>(null);
  // Staged edits survive filtering and searching, but not a wallet, network or deployment change.
  const draftContext = `${id}:${deployment.descriptor.chainId}:${deployment.contracts.diamond}:${action.wallet}:${action.walletState.chainId}`;
  const [drafts, setDrafts] = useState<{ context: string; edits: AllocationEdits }>({
    context: draftContext,
    edits: {},
  });
  const edits = drafts.context === draftContext ? drafts.edits : {};
  const stage = (
    changes: readonly Readonly<{ positionId: bigint; poolId: Hex; amount: bigint }>[]
  ) => {
    const next: Record<string, Record<string, { poolId: Hex; amount: bigint }>> = {};
    for (const [position, pools] of Object.entries(edits)) next[position] = { ...pools };
    for (const change of changes) {
      const position = String(change.positionId),
        key = change.poolId.toLowerCase();
      const current =
        positionRow(change.positionId)?.allocation?.active?.find(
          (entry) => entry.poolId.toLowerCase() === key
        )?.amount ?? 0n;
      next[position] = { ...next[position] };
      // Staging the chain's own amount is no change at all.
      if (change.amount === current) delete next[position][key];
      else next[position][key] = { poolId: change.poolId, amount: change.amount };
      if (!Object.keys(next[position]).length) delete next[position];
    }
    setDrafts({ context: draftContext, edits: next });
  };
  const context = `${id}:${deployment.descriptor.chainId}:${deployment.contracts.diamond}:${action.wallet}:${action.walletState.chainId}:${scope.positionId ?? "all"}:${scope.poolId ?? "all"}:${filter}:${search}`;
  const [selection, setSelection] = useState<{ context: string; keys: string[] }>({
    context,
    keys: [],
  });
  const setSelected = (keys: string[]) => setSelection({ context, keys });

  const table = useEarnPositionTable(deployment, action, positions);
  const now = table.now;
  const positionRows = table.rows.filter(
    (row) => scope.positionId === undefined || row.positionId === scope.positionId
  );
  const allocated = positionRows.flatMap((row) =>
    (row.allocation?.active ?? []).map((entry) => ({ positionId: row.positionId, ...entry }))
  );
  // Pools with allocator rewards but no current allocation still need a place to collect them.
  const rewarded = rows.flatMap((row) =>
    row.pools.filter((pool) => pool.hasAllocator).map((pool) => pool.poolId)
  );
  const poolIds = [
    ...new Map(
      [...allocated.map((entry) => entry.poolId), ...rewarded]
        .filter((poolId) => !scope.poolId || poolId.toLowerCase() === scope.poolId.toLowerCase())
        .map((poolId) => [poolId.toLowerCase(), poolId])
    ).values(),
  ];
  const directory = useAllocationPools(deployment, poolIds);
  const rules = useAllocationRules(deployment, action);
  // Eligibility for pools being staged or edited that the wallet does not hold yet.
  const extra = useAllocationPools(deployment, [
    ...Object.values(edits).flatMap((pools) => Object.values(pools).map((entry) => entry.poolId)),
    ...(editor?.start.poolId ? [editor.start.poolId] : []),
  ]);
  const poolInfo = (poolId: Hex) => directory.poolOf(poolId) ?? extra.poolOf(poolId);
  const eligibleOf = (poolId: Hex) => poolInfo(poolId)?.eligibility.eligible;
  const plans =
    rules.data && now !== undefined
      ? positionRows.flatMap((row) => {
          if (!edits[String(row.positionId)]) return [];
          const plan = planPosition({ row, edits, rules: rules.data!, now, eligible: eligibleOf });
          return plan && plan.changes.length ? [plan] : [];
        })
      : [];
  const candidates = useAllocationDirectory(deployment, {
    eligible: "true",
    sort: "incentives",
    limit: 25,
  });
  // Pools where the wallet provides liquidity: allocating there directs emissions back to it.
  const liquidity = useQueries({
    queries: positionRows
      .filter((row) => row.liquidityLegs > 0n)
      .map((row) => ({
        queryKey: [
          "phase-one-liquidity",
          id,
          action.wallet,
          String(row.positionId),
          "allocation-lp",
        ],
        enabled: Boolean(action.wallet),
        staleTime: 60_000,
        retry: false,
        queryFn: () => loadIndexedManagedLiquidity(row.positionId, id, action.wallet!),
      })),
  });
  const liquidityPools = liquidity.flatMap(
    (query) => query.data?.filter((leg) => leg.liquidity > 0n).map((leg) => leg.poolId) ?? []
  );

  const pools: PoolRow[] = poolIds.map((poolId) => {
    const pool = directory.poolOf(poolId);
    const entries: Entry[] = allocated
      .filter((entry) => entry.poolId.toLowerCase() === poolId.toLowerCase())
      .map((entry) => ({
        positionId: entry.positionId,
        amount: entry.amount,
        status: allocationStatus(entry, pool),
      }));
    const claimers = rows
      .filter((row) =>
        row.pools.some(
          (entry) => entry.hasAllocator && entry.poolId.toLowerCase() === poolId.toLowerCase()
        )
      )
      .map((row) => row.positionId)
      .filter((positionId) => !entries.some((entry) => entry.positionId === positionId));
    const all: Entry[] = [
      ...entries,
      ...claimers.map((positionId) => ({ positionId, amount: 0n, status: "removed" as const })),
    ];
    const activeAmount = entries
      .filter((entry) => entry.status === "active")
      .reduce((sum, entry) => sum + entry.amount, 0n);
    const staleAmount = entries
      .filter((entry) => entry.status === "stale")
      .reduce((sum, entry) => sum + entry.amount, 0n);
    const status: PoolStatus = entries.some((entry) => entry.status === "stale")
      ? "stale"
      : entries.some((entry) => entry.status === "active")
        ? "active"
        : entries.length
          ? "unknown"
          : "removed";
    const name =
      pool?.token0.symbol && pool.token1.symbol
        ? `${pool.token0.symbol} / ${pool.token1.symbol}`
        : rewardPoolName(deployment, poolId);
    const suggestion =
      status === "stale"
        ? suggestDestination({
            pools: candidates.pools,
            exclude: [poolId],
            liquidityPools,
            allocatedPools: allocated
              .filter((entry) => all.some((item) => item.positionId === entry.positionId))
              .map((entry) => entry.poolId),
          })
        : null;
    return {
      poolId,
      name,
      pool,
      entries: all,
      status,
      activeAmount,
      staleAmount,
      keys: all.map((entry) => rewardRowKey(entry.positionId, poolId)),
      suggestion,
    };
  });

  const matches = (pool: PoolRow, value: Filter) =>
    value === "all" || (value === "attention" ? pool.status === "stale" : pool.status === value);
  const text = search.trim().toLowerCase();
  const visible = pools.filter(
    (pool) => matches(pool, filter) && (!text || pool.name.toLowerCase().includes(text))
  );
  const count = (value: Filter) => pools.filter((pool) => matches(pool, value)).length;
  const visibleKeys = new Set(visible.flatMap((pool) => pool.keys));
  const selected =
    selection.context === context ? selection.keys.filter((key) => visibleKeys.has(key)) : [];
  const toggleKeys = (keys: readonly string[], checked: boolean) =>
    setSelected(
      checked ? [...new Set([...selected, ...keys])] : selected.filter((key) => !keys.includes(key))
    );
  const changeFilter = (value: Filter) => {
    setSelected([]);
    setFilter(value);
  };
  const toggleExpanded = (poolId: Hex) =>
    setExpanded((previous) =>
      previous.some((entry) => entry.toLowerCase() === poolId.toLowerCase())
        ? previous.filter((entry) => entry.toLowerCase() !== poolId.toLowerCase())
        : [...previous, poolId]
    );

  const allScope: RewardClaimScope = { ...scope, sources };
  const selectedScope: RewardClaimScope = { ...allScope, selectedRows: selected };
  const tableClaim = useTableRewardClaim({
    deployment,
    action,
    rows,
    loading,
    incomplete,
    context: `${context}:${selection.context === context ? selection.keys.join(",") : ""}`,
  });
  const collect = (rowScope: RewardClaimScope, accessibleLabel: string) =>
    scopeRewardAmounts(rows, rowScope).length > 0
      ? tableClaim.collect(rowScope, t("collect"), accessibleLabel)
      : null;

  const statics = (amount: bigint | undefined) =>
    amount === undefined ? "—" : `${rewardDisplay(amount, 18).display} STATICS`;
  const pending = directory.loading ? "…" : "—";
  const share = (pool: PoolRow) =>
    pool.pool && pool.pool.weight > 0n && pool.activeAmount > 0n
      ? `${(Number((pool.activeAmount * 1_000_000n) / pool.pool.weight) / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
      : pool.pool
        ? "0%"
        : pending;
  const estimates = (pool: PoolRow, amount = pool.activeAmount) =>
    pool.pool && amount > 0n ? poolIncentiveEstimates(pool.pool, amount, 0n, now) : [];
  const statusLabel = (status: PoolStatus) =>
    status === "unknown" && directory.loading ? t("loading") : t(`status.${status}`);
  const staleReason = (pool: PoolRow) =>
    pool.pool && !pool.pool.eligibility.eligible
      ? pool.pool.eligibility.reasons.map((reason) => t(`reason.${reason}`)).join(", ")
      : t("reason.version");
  const positionRow = (positionId: bigint) =>
    positionRows.find((row) => row.positionId === positionId);
  const adjust = (poolId: Hex, label: string) => (
    <button
      type="button"
      className="ui-button ui-button--secondary ui-button--sm"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={() => openEditor({ poolId })}
    >
      {t("adjust")}
    </button>
  );
  const staged = (positionId: bigint, poolId: Hex) =>
    edits[String(positionId)]?.[poolId.toLowerCase()];
  const suggestionNote = (pool: PoolRow) =>
    pool.status === "stale" ? (
      <span className={styles.cellMeta}>
        {staleReason(pool)}
        {pool.suggestion &&
          ` · ${t("suggestion", {
            pool: candidates.pools.find((entry) => entry.poolId === pool.suggestion!.poolId)
              ? poolLabel(
                  candidates.pools.find((entry) => entry.poolId === pool.suggestion!.poolId)!
                )
              : rewardPoolName(deployment, pool.suggestion.poolId),
            reason: t(`suggestionReason.${pool.suggestion.reason}`),
          })}`}
      </span>
    ) : null;
  function poolLabel(pool: IndexedAllocationPool) {
    return pool.token0.symbol && pool.token1.symbol
      ? `${pool.token0.symbol} / ${pool.token1.symbol}`
      : rewardPoolName(deployment, pool.poolId);
  }
  const statusPill = (pool: PoolRow) => (
    <span
      className={styles.statusPill}
      data-tone={tone[pool.status]}
      title={t(`statusHelp.${pool.status}`)}
    >
      {statusLabel(pool.status)}
    </span>
  );
  const move = (pool: PoolRow) => {
    return (
      <button
        type="button"
        className="ui-button ui-button--secondary ui-button--sm"
        aria-label={t("movePool", { pool: pool.name })}
        aria-haspopup="dialog"
        onClick={() => {
          const suggestion = pool.suggestion;
          if (!suggestion) {
            setBrowsing(true);
            return;
          }
          // Suggested amounts: what each position already has there plus its stale stake.
          const key = suggestion.poolId.toLowerCase();
          const prefill: Record<string, Record<string, { poolId: Hex; amount: bigint }>> = {};
          for (const entry of pool.entries)
            if (entry.status === "stale") {
              const existing =
                positionRow(entry.positionId)?.allocation?.active?.find(
                  (item) => item.poolId.toLowerCase() === key
                )?.amount ?? 0n;
              prefill[String(entry.positionId)] = {
                [key]: { poolId: suggestion.poolId, amount: existing + entry.amount },
              };
            }
          openEditor({ poolId: suggestion.poolId, prefill });
        }}
      >
        {t("move")}
      </button>
    );
  };
  const poolActions = (pool: PoolRow) => (
    <>
      {collect({ ...allScope, poolId: pool.poolId }, t("collectPool", { pool: pool.name }))}
      {pool.status === "stale"
        ? move(pool)
        : pool.status !== "removed" && adjust(pool.poolId, t("adjustPool", { pool: pool.name }))}
    </>
  );
  const entryActions = (pool: PoolRow, entry: Entry) => (
    <>
      {collect(
        { ...allScope, positionId: entry.positionId, poolId: pool.poolId },
        t("collectEntry", { id: String(entry.positionId), pool: pool.name })
      )}
      {entry.status !== "removed" && (
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          aria-label={t("removeEntry", { id: String(entry.positionId), pool: pool.name })}
          aria-haspopup="dialog"
          disabled={staged(entry.positionId, pool.poolId)?.amount === 0n}
          onClick={() => openEditor({ positionId: entry.positionId, poolId: pool.poolId })}
        >
          {t("remove")}
        </button>
      )}
    </>
  );
  const entryMeta = (entry: Entry, poolId: Hex) => {
    const pending = staged(entry.positionId, poolId);
    if (pending)
      return (
        <span className={styles.statusPill} data-tone="warning">
          {t("pending", { amount: rewardDisplay(pending.amount, 18).display })}
        </span>
      );
    const row = positionRow(entry.positionId);
    const left =
      row?.allocation && now !== undefined && coolingDown(row, now)
        ? row.allocation.nextAllocationAt - now
        : 0n;
    return left > 0n ? (
      <span className={styles.statusPill} data-tone="warning">
        {t("cooldown", { time: formatDuration(left) })}
      </span>
    ) : null;
  };

  // Summary.
  const totalLocked = positionRows.reduce(
    (sum, row) => sum + (row.allocation?.lockedStake ?? 0n),
    0n
  );
  const totalStale = positionRows.reduce((sum, row) => sum + staleAllocation(row), 0n);
  const totalFree = positionRows.reduce((sum, row) => sum + freeStake(row), 0n);
  const allocationKnown = positionRows.every((row) => row.allocation);
  const idle = positionRows.filter(
    (row) => row.allocation && freeStake(row) > 0n && (now === undefined || !coolingDown(row, now))
  );
  const weekly = sumAssetAmounts(pools.map((pool) => estimates(pool)));
  const attention = count("attention");
  const largestIdle = [...idle].sort((a, b) => (freeStake(a) > freeStake(b) ? -1 : 1))[0];
  const [summaryDialog, setSummaryDialog] = useState({ context, open: false });
  if (summaryDialog.context !== context || (!compact && summaryDialog.open))
    setSummaryDialog({ context, open: false });
  const summaryDetails = (
    <>
      <div className={styles.summaryChip}>
        <span className={styles.chipLabel}>{t("allocated")}</span>
        <span className={styles.chipValue}>
          {allocationKnown ? rewardDisplay(totalLocked, 18).display : "—"} <small>STATICS</small>
        </span>
        <span className={styles.chipMeta}>
          {totalStale > 0n && `${t("staleAmount", { amount: statics(totalStale) })} · `}
          {t("freeAmount", { amount: statics(totalFree) })}
        </span>
        {largestIdle && (
          <button
            type="button"
            className={`ui-button ui-button--secondary ui-button--sm ${styles.summaryMore}`}
            aria-haspopup="dialog"
            onClick={() => {
              setSummaryDialog({ context, open: false });
              setBrowsing(true);
            }}
          >
            {t("allocateFree")}
          </button>
        )}
      </div>
      <div className={styles.summaryChip}>
        <span className={styles.chipLabel}>{t("estimate")}</span>
        {weekly.length ? (
          <RewardAmounts deployment={deployment} amounts={weekly} preview />
        ) : (
          <span className={styles.chipValue}>{directory.loading ? "…" : "—"}</span>
        )}
        <span className={styles.chipMeta}>{t("estimateHelp")}</span>
      </div>
      <button
        type="button"
        className={`${styles.summaryChip} ${styles.attentionChip}`}
        onClick={() => changeFilter("attention")}
        aria-label={t("showAttention", { count: attention })}
      >
        <span className={styles.chipLabel}>{t("attention")}</span>
        <span className={styles.chipValue}>{attention}</span>
        <span className={styles.chipMeta}>
          {idle.length > 0 ? t("attentionIdle", { count: idle.length }) : t("attentionHelp")}
        </span>
      </button>
    </>
  );

  const selectAll = (
    <input
      type="checkbox"
      aria-label={t("selectAll")}
      disabled={visibleKeys.size === 0}
      checked={visibleKeys.size > 0 && selected.length === visibleKeys.size}
      ref={(node) => {
        if (node) node.indeterminate = selected.length > 0 && selected.length < visibleKeys.size;
      }}
      onChange={(event) => toggleKeys([...visibleKeys], event.target.checked)}
    />
  );
  const poolCheckbox = (pool: PoolRow) => {
    const chosen = pool.keys.filter((key) => selected.includes(key)).length;
    return (
      <input
        type="checkbox"
        aria-label={t("selectPool", { pool: pool.name })}
        disabled={pool.keys.length === 0}
        checked={chosen > 0 && chosen === pool.keys.length}
        ref={(node) => {
          if (node) node.indeterminate = chosen > 0 && chosen < pool.keys.length;
        }}
        onChange={(event) => toggleKeys(pool.keys, event.target.checked)}
      />
    );
  };
  const entryCheckbox = (pool: PoolRow, entry: Entry) => {
    const key = rewardRowKey(entry.positionId, pool.poolId);
    return (
      <input
        type="checkbox"
        aria-label={t("selectEntry", { id: String(entry.positionId), pool: pool.name })}
        checked={selected.includes(key)}
        onChange={(event) => toggleKeys([key], event.target.checked)}
      />
    );
  };
  const rewards = (pool: PoolRow, positionId?: bigint) => (
    <RewardAmounts
      deployment={deployment}
      amounts={scopeRewardAmounts(rows, {
        ...allScope,
        poolId: pool.poolId,
        positionId: positionId ?? scope.positionId,
      })}
      preview
      empty={positionId === undefined}
    />
  );
  const estimateCell = (pool: PoolRow, amount?: bigint): ReactNode => {
    const values = estimates(pool, amount);
    return values.length ? (
      <RewardAmounts deployment={deployment} amounts={values} preview />
    ) : (
      <span className={styles.cellMeta}>{pool.pool ? "—" : pending}</span>
    );
  };

  const poolNameOf = (poolId: Hex) => {
    const info = poolInfo(poolId);
    return info ? poolLabel(info) : rewardPoolName(deployment, poolId);
  };
  const changeSet = (
    <AllocationChangeSet
      deployment={deployment}
      plans={plans}
      edits={edits}
      rules={rules.data}
      eligible={eligibleOf}
      poolName={poolNameOf}
      reviewRequest={reviewRequest}
      onReviewRequestHandled={() => setReviewRequest(null)}
      onConfirmed={(positionIds) => {
        const ids = positionIds.map(String);
        setDrafts({
          context: draftContext,
          edits: Object.fromEntries(
            Object.entries(edits).filter(([position]) => !ids.includes(position))
          ),
        });
      }}
      onDiscard={() => setDrafts({ context: draftContext, edits: {} })}
    />
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
              scopeKey={`allocations:${context}:all`}
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
            onChange={(event) => {
              setSelected([]);
              setSearch(event.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="ui-button ui-button--primary ui-button--sm"
          aria-haspopup="dialog"
          onClick={() => setBrowsing(true)}
        >
          {t("browsePools")}
        </button>
      </div>

      <div className={compact ? styles.compactFrame : styles.tableFrame}>
        {compact ? (
          <section className={styles.compactPools} aria-label={t("poolList")}>
            <div className={styles.compactPoolHeading}>
              {selectAll}
              <span>{t("column.pool")}</span>
            </div>
            {visible.map((pool) => {
              const open = expanded.some(
                (entry) => entry.toLowerCase() === pool.poolId.toLowerCase()
              );
              const detailId = `allocation-details-${pool.poolId}`;
              return (
                <article key={pool.poolId} className={styles.compactPool}>
                  <div className={styles.compactPoolHeading}>
                    {poolCheckbox(pool)}
                    <button
                      type="button"
                      className={styles.compactPoolToggle}
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-describedby={`${detailId}-status`}
                      aria-label={t(open ? "collapse" : "expand", { pool: pool.name })}
                      onClick={() => toggleExpanded(pool.poolId)}
                    >
                      <span className={styles.compactPoolName}>
                        <strong>{pool.name}</strong>
                        <span className={styles.cellMeta}>
                          {statics(pool.activeAmount + pool.staleAmount)}
                        </span>
                      </span>
                      <span id={`${detailId}-status`}>{statusPill(pool)}</span>
                      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                    </button>
                  </div>
                  {open && (
                    <div id={detailId} className={styles.compactPoolDetails}>
                      {suggestionNote(pool)}
                      <dl className={styles.compactMetrics}>
                        <div>
                          <dt>{t("column.share")}</dt>
                          <dd>{share(pool)}</dd>
                        </div>
                        <div>
                          <dt>{t("column.directed")}</dt>
                          <dd>{statics(directedEmission(pool.activeAmount, directory.reserve))}</dd>
                        </div>
                        <div>
                          <dt>{t("column.estimate")}</dt>
                          <dd>{estimateCell(pool)}</dd>
                        </div>
                        <div>
                          <dt>{t("column.claimable")}</dt>
                          <dd>{rewards(pool)}</dd>
                        </div>
                      </dl>
                      <div className={styles.compactActions}>{poolActions(pool)}</div>
                      <h3 className={styles.compactPositionsTitle}>{t("positions")}</h3>
                      {pool.entries.map((entry) => (
                        <section
                          key={String(entry.positionId)}
                          className={styles.compactPosition}
                          aria-label={t("position", { id: String(entry.positionId) })}
                        >
                          <div className={styles.compactPositionHeading}>
                            {entryCheckbox(pool, entry)}
                            <h4>{t("position", { id: String(entry.positionId) })}</h4>
                            {entryMeta(entry, pool.poolId)}
                          </div>
                          <dl className={styles.compactMetrics}>
                            <div>
                              <dt>{t("column.allocated")}</dt>
                              <dd>{statics(entry.amount)}</dd>
                            </div>
                            <div>
                              <dt>{t("column.estimate")}</dt>
                              <dd>
                                {estimateCell(pool, entry.status === "active" ? entry.amount : 0n)}
                              </dd>
                            </div>
                            <div>
                              <dt>{t("column.claimable")}</dt>
                              <dd>{rewards(pool, entry.positionId)}</dd>
                            </div>
                          </dl>
                          <div className={styles.compactActions}>{entryActions(pool, entry)}</div>
                        </section>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <table className={`${styles.positionsTable} ${styles.liquidityTable}`}>
            <colgroup>
              <col style={{ width: 48 }} />
              <col style={{ width: 260 }} />
              <col />
              <col style={{ width: 80 }} />
              <col />
              <col />
              <col />
              <col style={{ width: 200 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>
                  {selectAll}
                </th>
                <th scope="col">{t("column.pool")}</th>
                <th scope="col" className={styles.numeric}>
                  {t("column.allocated")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.share")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.directed")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.estimate")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.claimable")}
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
                const chosen = pool.keys.some((key) => selected.includes(key));
                return (
                  <Fragment key={pool.poolId}>
                    <tr className={chosen ? styles.selectedRow : undefined}>
                      <td className={styles.checkCell}>{poolCheckbox(pool)}</td>
                      <td>
                        <div className={styles.positionName}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            aria-expanded={open}
                            aria-label={t(open ? "collapse" : "expand", { pool: pool.name })}
                            onClick={() => toggleExpanded(pool.poolId)}
                          >
                            {open ? "▾" : "▸"}
                          </button>
                          <span>{pool.name}</span>
                          {statusPill(pool)}
                        </div>
                        {suggestionNote(pool) ?? (
                          <span className={styles.cellMeta}>
                            {t("positionCount", { count: pool.entries.length })}
                          </span>
                        )}
                      </td>
                      <td className={styles.numeric}>
                        {statics(pool.activeAmount + pool.staleAmount)}
                      </td>
                      <td className={styles.numeric}>{share(pool)}</td>
                      <td className={styles.numeric}>
                        {statics(directedEmission(pool.activeAmount, directory.reserve))}
                      </td>
                      <td className={styles.numeric}>{estimateCell(pool)}</td>
                      <td className={styles.numeric}>{rewards(pool)}</td>
                      <td className={styles.rowActions}>{poolActions(pool)}</td>
                    </tr>
                    {open &&
                      pool.entries.map((entry) => {
                        const key = rewardRowKey(entry.positionId, pool.poolId);
                        return (
                          <tr
                            key={key}
                            className={selected.includes(key) ? styles.selectedRow : undefined}
                          >
                            <td className={styles.checkCell}>{entryCheckbox(pool, entry)}</td>
                            <td>
                              <div className={styles.legCell}>
                                <span>{t("position", { id: String(entry.positionId) })}</span>
                                <span className={styles.positionName}>
                                  <span
                                    className={styles.statusPill}
                                    data-tone={tone[entry.status]}
                                  >
                                    {statusLabel(entry.status)}
                                  </span>
                                  {entryMeta(entry, pool.poolId)}
                                </span>
                              </div>
                            </td>
                            <td className={styles.numeric}>{statics(entry.amount)}</td>
                            <td />
                            <td className={styles.numeric}>
                              {entry.status === "active"
                                ? statics(directedEmission(entry.amount, directory.reserve))
                                : "—"}
                            </td>
                            <td className={styles.numeric}>
                              {estimateCell(pool, entry.status === "active" ? entry.amount : 0n)}
                            </td>
                            <td className={styles.numeric}>{rewards(pool, entry.positionId)}</td>
                            <td className={styles.rowActions}>{entryActions(pool, entry)}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !table.loading && visible.length === 0 && (
          <div className={styles.tableEmpty}>
            <p>{pools.length ? t("noMatches") : t("noAllocations")}</p>
            {pools.length ? (
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                onClick={() => {
                  changeFilter("all");
                  setSearch("");
                }}
              >
                {t("clearFilters")}
              </button>
            ) : (
              largestIdle && (
                <button
                  type="button"
                  className="ui-button ui-button--secondary ui-button--sm"
                  aria-haspopup="dialog"
                  onClick={() => setBrowsing(true)}
                >
                  {t("allocateFree")}
                </button>
              )
            )}
          </div>
        )}
        {directory.unavailable && <p className={styles.tableEmpty}>{t("directoryUnavailable")}</p>}
      </div>

      {browsing && (
        <ReviewDrawer
          title={t("directoryTitle")}
          variant="fullscreen"
          onClose={() => setBrowsing(false)}
        >
          <AllocationDirectory
            deployment={deployment}
            compact={compact}
            now={now}
            yourAllocation={(poolId) =>
              allocated
                .filter((entry) => entry.poolId.toLowerCase() === poolId.toLowerCase())
                .reduce((sum, entry) => sum + entry.amount, 0n)
            }
            allocate={(pool) => (
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                disabled={!pool.eligibility.eligible || positionRows.length === 0}
                title={!pool.eligibility.eligible ? t("allocateIneligible") : undefined}
                aria-label={t("allocateTo", { pool: poolLabel(pool) })}
                aria-haspopup="dialog"
                onClick={() => openEditor({ poolId: pool.poolId })}
              >
                {t("allocate")}
              </button>
            )}
          />
          {plans.length > 0 && <div className={styles.dialogFooter}>{changeSet}</div>}
        </ReviewDrawer>
      )}

      {editor && positionRows.length > 0 && (
        <ReviewDrawer
          key={editor.key}
          title={editorText("title")}
          variant="modal"
          className={styles.allocationModal}
          onClose={() => setEditor(null)}
        >
          <AllocationEditor
            deployment={deployment}
            positions={positionRows}
            edits={edits}
            rules={rules.data}
            now={now}
            eligible={eligibleOf}
            poolInfo={poolInfo}
            poolName={poolNameOf}
            poolLabel={poolLabel}
            start={editor.start}
            onApply={(changes, review) => {
              stage(changes);
              setEditor(null);
              if (review) setReviewRequest((reviewRequest ?? 0) + 1);
            }}
          />
        </ReviewDrawer>
      )}

      {/* The directory dialog shows the change set itself; the page behind it is inert. */}
      {!browsing && (selected.length > 0 || plans.length > 0) && (
        <FloatingSelectedActions label={t("bulkActions")}>
          {plans.length > 0 && changeSet}
          {selected.length > 0 && (
            <div className={styles.changeSet}>
              <strong>{t("selectedCount", { count: selected.length })}</strong>
              {tableClaim.collect(selectedScope, t("collectSelected"), t("collectSelected"), false)}
              <button
                type="button"
                className={`ui-button ui-button--ghost ui-button--sm ${styles.bulkClear}`}
                onClick={() => setSelected([])}
              >
                {t("clearSelection")}
              </button>
            </div>
          )}
        </FloatingSelectedActions>
      )}
      {tableClaim.review}
    </div>
  );
}
