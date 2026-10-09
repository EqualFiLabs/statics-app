"use client";
import { useDeferredValue, useState } from "react";
import { useTranslations } from "next-intl";
import { formatUnits, type Hex } from "viem";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { IndexedAllocationPool } from "@/lib/indexer/phase-one";
import { rewardDisplay } from "@/lib/rewards/earn";
import {
  evenSplit,
  planAllocationChange,
  poolIncentiveEstimates,
  unlockReductions,
  type AllocationPlan,
} from "@/lib/rewards/allocations";
import type { EarnPositionRow } from "@/lib/rewards/position-table";
import { formatDuration } from "@/lib/rewards/time";
import { useAllocationDirectory } from "@/hooks/useAllocationDirectory";
import { RewardAmounts } from "./RewardAmounts";
import { ReviewDrawer } from "./ReviewDrawer";
import styles from "./earn.module.css";

export type AllocationEdit = Readonly<{ poolId: Hex; amount: bigint }>;
/** Staged amounts by position, then by lower-cased pool ID. An amount of 0 removes the pool. */
export type AllocationEdits = Readonly<Record<string, Readonly<Record<string, AllocationEdit>>>>;
export type AllocationRules = Readonly<{ cooldown: bigint; maximumAllocations: bigint }>;
export type AllocationChangeInput = Readonly<{ positionId: bigint; poolId: Hex; amount: bigint }>;

/** Plan one position's full replacement set from its chain state plus edits. */
export function planPosition(input: {
  row: EarnPositionRow;
  edits: AllocationEdits;
  rules: AllocationRules;
  now: bigint;
  eligible: (poolId: Hex) => boolean | undefined;
}): AllocationPlan | null {
  const allocation = input.row.allocation;
  if (!allocation?.active) return null;
  return planAllocationChange({
    positionId: input.row.positionId,
    current: {
      nextAllocationAt: Number(allocation.nextAllocationAt),
      totalAllocated: allocation.totalAllocated,
      lockedStake: allocation.lockedStake,
      active: allocation.active,
    },
    stakedBalance: input.row.stakedBalance,
    maximumAllocations: input.rules.maximumAllocations,
    cooldown: input.rules.cooldown,
    now: input.now,
    edits: new Map(Object.entries(input.edits[String(input.row.positionId)] ?? {})),
    eligible: input.eligible,
  });
}

/** Where the editor opens: a pool to focus, a position to select, and suggested amounts. */
export type AllocationEditorStart = Readonly<{
  poolId?: Hex;
  positionId?: bigint;
  prefill?: AllocationEdits;
  /** Stake to free for unstaking from `positionId`, taken from its largest allocations. */
  unlock?: bigint;
}>;

type Unit = "amount" | "percent";

const lower = (poolId: Hex) => poolId.toLowerCase();
const PICKER_PAGE = 5;
/** Hundredths of a percent, trimmed: 3350 → "33.5". */
function percentText(basisPoints: bigint) {
  const whole = basisPoints / 100n,
    fraction = String(basisPoints % 100n)
      .padStart(2, "0")
      .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/**
 * Edit one position's allocations at a time, the way the contract applies them: every save
 * replaces the position's whole set in one transaction, under one stake limit and one cooldown.
 * Edits for several positions can be prepared before adding them to the change set.
 */
export function AllocationEditor({
  deployment,
  positions,
  edits,
  rules,
  now,
  eligible,
  poolInfo,
  poolName,
  poolLabel,
  start,
  onApply,
}: {
  deployment: PhaseOneDeployment;
  positions: readonly EarnPositionRow[];
  /** Changes already staged in the change set. */
  edits: AllocationEdits;
  rules: AllocationRules | undefined;
  now: bigint | undefined;
  eligible: (poolId: Hex) => boolean | undefined;
  poolInfo: (poolId: Hex) => IndexedAllocationPool | undefined;
  poolName: (poolId: Hex) => string;
  poolLabel: (pool: IndexedAllocationPool) => string;
  start: AllocationEditorStart;
  onApply: (changes: readonly AllocationChangeInput[], review: boolean) => void;
}) {
  const t = useTranslations("allocationEditor");
  const locale = useAppLocale();
  const focusKey = start.poolId ? lower(start.poolId) : undefined;
  const [unit, setUnit] = useState<Unit>("amount");
  const [added, setAdded] = useState<Readonly<Record<string, IndexedAllocationPool>>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  /** Amounts this editor has set, by position and pool, before they are added to the change set. */
  const [targets, setTargets] = useState<AllocationEdits>(() => start.prefill ?? {});
  /** Each row's amount to add or remove, keyed `position:pool`, in the current unit. */
  const [inputs, setInputs] = useState<Readonly<Record<string, string>>>({});
  const [search, setSearch] = useState("");
  const [impactOpen, setImpactOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerPage, setPickerPage] = useState(0);
  const query = useDeferredValue(search.trim());
  const suggestions = useAllocationDirectory(deployment, {
    ...(query ? { search: query } : {}),
    eligible: "true",
    sort: "incentives",
    limit: 6,
  });

  const eligibleOf = (poolId: Hex) =>
    added[lower(poolId)]?.eligibility.eligible ?? eligible(poolId);
  const infoOf = (poolId: Hex) => added[lower(poolId)] ?? poolInfo(poolId);
  const nameOf = (poolId: Hex) => {
    const info = added[lower(poolId)];
    return info ? poolLabel(info) : poolName(poolId);
  };
  const chainAmount = (row: EarnPositionRow, key: string) =>
    row.allocation?.active?.find((entry) => lower(entry.poolId) === key)?.amount ?? 0n;
  const base = (row: EarnPositionRow, key: string) =>
    edits[String(row.positionId)]?.[key]?.amount ?? chainAmount(row, key);
  const freeOf = (row: EarnPositionRow) => row.stakedBalance - (row.allocation?.lockedStake ?? 0n);
  const coolingUntil = (row: EarnPositionRow) =>
    row.allocation && now !== undefined && row.allocation.nextAllocationAt > now
      ? row.allocation.nextAllocationAt
      : undefined;
  const statics = (amount: bigint) => `${rewardDisplay(amount, 18).display} STATICS`;
  const at = (seconds: bigint) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(Number(seconds) * 1000)
    );

  const [selected, setSelected] = useState(() => {
    const has = (id: bigint | string | undefined) =>
      id !== undefined && positions.some((row) => String(row.positionId) === String(id));
    if (has(start.positionId)) return String(start.positionId);
    const prefilled = Object.keys(start.prefill ?? {}).find(has);
    if (prefilled) return prefilled;
    const byAmount = (amount: (row: EarnPositionRow) => bigint) =>
      [...positions].sort((a, b) => (amount(a) === amount(b) ? 0 : amount(a) > amount(b) ? -1 : 1));
    if (focusKey) {
      const holder = byAmount((row) => chainAmount(row, focusKey))[0];
      if (holder && chainAmount(holder, focusKey) > 0n) return String(holder.positionId);
    }
    const open = byAmount(freeOf).find((row) => coolingUntil(row) === undefined);
    return String((open ?? positions[0])?.positionId ?? "");
  });
  const row = positions.find((entry) => String(entry.positionId) === selected) ?? positions[0];
  const id = row ? String(row.positionId) : "";

  // An unstake shortfall pre-fills reductions once the position's allocations are known.
  const [unlockApplied, setUnlockApplied] = useState(false);
  if (
    start.unlock &&
    !unlockApplied &&
    row?.allocation?.active &&
    String(start.positionId) === id
  ) {
    setUnlockApplied(true);
    const reductions = unlockReductions(
      row.allocation.active
        .filter((entry) => eligibleOf(entry.poolId) !== false)
        .map((entry) => ({ poolId: entry.poolId, amount: base(row, lower(entry.poolId)) })),
      start.unlock
    );
    setTargets({
      ...targets,
      [id]: {
        ...targets[id],
        ...Object.fromEntries(reductions.map((entry) => [lower(entry.poolId), entry])),
      },
    });
  }

  /** A row's add/remove amount; null when it is not a valid number. */
  const parse = (text: string, target: EarnPositionRow): bigint | null => {
    if (!text.trim()) return 0n;
    try {
      if (unit === "amount") return parseLocalizedUnits(text, 18, locale);
      return (target.stakedBalance * parseLocalizedUnits(text, 2, locale)) / 10_000n;
    } catch {
      return null;
    }
  };
  /** The amount a pool would have after this editor's changes. */
  const amountOf = (target: EarnPositionRow, key: string) =>
    targets[String(target.positionId)]?.[key]?.amount ?? base(target, key);
  const textIn = (amount: bigint, target: EarnPositionRow) =>
    amount <= 0n
      ? ""
      : unit === "amount"
        ? formatUnits(amount, 18)
        : target.stakedBalance > 0n
          ? percentText((amount * 10_000n) / target.stakedBalance)
          : "";
  const setAmounts = (target: EarnPositionRow, values: readonly AllocationEdit[]) => {
    const position = String(target.positionId);
    setTargets({
      ...targets,
      [position]: {
        ...targets[position],
        ...Object.fromEntries(values.map((value) => [lower(value.poolId), value])),
      },
    });
  };
  const poolsOf = (target: EarnPositionRow) => {
    const position = String(target.positionId);
    const pools = new Map<string, Hex>();
    for (const entry of target.allocation?.active ?? [])
      pools.set(lower(entry.poolId), entry.poolId);
    for (const edit of Object.values(edits[position] ?? {}))
      pools.set(lower(edit.poolId), edit.poolId);
    for (const target of Object.values(targets[position] ?? {}))
      pools.set(lower(target.poolId), target.poolId);
    if (start.poolId && focusKey) pools.set(focusKey, start.poolId);
    return [...pools.values()];
  };
  /** This editor's changes for a position, relative to what is already staged or on chain. */
  const changesOf = (target: EarnPositionRow) =>
    Object.entries(targets[String(target.positionId)] ?? {}).flatMap(([key, edit]) =>
      edit.amount === base(target, key) ? [] : [{ key, poolId: edit.poolId, amount: edit.amount }]
    );
  const planOf = (target: EarnPositionRow) => {
    if (!rules || now === undefined) return null;
    const position = String(target.positionId);
    const merged: Record<string, AllocationEdit> = { ...edits[position] };
    for (const change of changesOf(target))
      merged[change.key] = { poolId: change.poolId, amount: change.amount };
    return planPosition({
      row: target,
      edits: { [position]: merged },
      rules,
      now,
      eligible: eligibleOf,
    });
  };

  const changed = positions
    .map((target) => ({ target, changes: changesOf(target) }))
    .filter((entry) => entry.changes.length > 0);
  const blocked = changed.some(({ target }) => !planOf(target)?.validation.valid);
  const apply = (review: boolean) =>
    onApply(
      changed.flatMap(({ target, changes }) =>
        changes.map((change) => ({
          positionId: target.positionId,
          poolId: change.poolId,
          amount: change.amount,
        }))
      ),
      review
    );

  if (!row) return <p className={styles.muted}>{t("noPositions")}</p>;

  const plan = planOf(row);
  const cooling = coolingUntil(row);
  const pools = poolsOf(row);
  const keys = pools.map(lower);
  const maximum = rules?.maximumAllocations;
  const others = (key: string) =>
    (plan?.next ?? [])
      .filter((entry) => lower(entry.poolId) !== key)
      .reduce((sum, entry) => sum + entry.amount, 0n);
  const live = pools.filter((poolId) => eligibleOf(poolId) !== false);
  const lockedAfter = plan?.lockedAfter ?? row.allocation?.lockedStake ?? 0n;
  const freeAfter = row.stakedBalance > lockedAfter ? row.stakedBalance - lockedAfter : 0n;
  const share = (amount: bigint) =>
    row.stakedBalance > 0n ? Number((amount * 10_000n) / row.stakedBalance) / 100 : 0;
  const draftsHere = changesOf(row);
  const canAdd =
    cooling === undefined &&
    maximum !== undefined &&
    BigInt(plan?.next.length ?? live.length) < maximum;
  const options = suggestions.pools
    .filter((pool) => !keys.includes(lower(pool.poolId)))
    .slice(0, 5);
  /** A position's summary as it would be after this editor's changes. */
  const summaryOf = (target: EarnPositionRow) => {
    const locked = planOf(target)?.lockedAfter ?? target.allocation?.lockedStake ?? 0n;
    const until = coolingUntil(target);
    return {
      locked,
      free: target.stakedBalance > locked ? target.stakedBalance - locked : 0n,
      cooling: until !== undefined && now !== undefined ? formatDuration(until - now) : null,
      changes: changesOf(target).length,
    };
  };
  const positionMeta = (target: EarnPositionRow, summary: ReturnType<typeof summaryOf>) =>
    t("positionMeta", {
      staked: statics(target.stakedBalance),
      allocated: rewardDisplay(summary.locked, 18).display,
      free: rewardDisplay(summary.free, 18).display,
    });
  const positionPills = (summary: ReturnType<typeof summaryOf>) => (
    <>
      {summary.cooling && (
        <span className={styles.statusPill} data-tone="warning">
          {t("optionCooling", { time: summary.cooling })}
        </span>
      )}
      {summary.changes > 0 && (
        <span className={styles.statusPill} data-tone="positive">
          {t("optionEdited", { count: summary.changes })}
        </span>
      )}
    </>
  );
  const matching = positions.filter((target) =>
    String(target.positionId).includes(pickerQuery.trim().replace(/^#/, ""))
  );
  const pickerPages = Math.max(1, Math.ceil(matching.length / PICKER_PAGE));
  const pickerPageNow = Math.min(pickerPage, pickerPages - 1);
  const selectedSummary = summaryOf(row);
  const segments = (plan?.next ?? []).filter((entry) => entry.amount > 0n);

  const impactList = !plan ? (
    <p className={styles.cellMeta}>{t("loading")}</p>
  ) : (
    <ul>
      {plan.changes.length === 0 && <li>{t("noChanges")}</li>}
      {plan.lockedAfter !== plan.lockedBefore && (
        <li>
          {t("locked", {
            before: rewardDisplay(plan.lockedBefore, 18).display,
            after: rewardDisplay(plan.lockedAfter, 18).display,
          })}{" "}
          {plan.lockedAfter < plan.lockedBefore
            ? t("unlocks", { amount: statics(plan.lockedBefore - plan.lockedAfter) })
            : t("locks", { amount: statics(plan.lockedAfter - plan.lockedBefore) })}
        </li>
      )}
      {plan.droppedIneligible.map((poolId) => (
        <li key={poolId}>{t("dropsStale", { pool: nameOf(poolId) })}</li>
      ))}
      {plan.changes.length > 0 && plan.startsCooldown && plan.cooldownUntil ? (
        <li data-tone="warning">{t("startsCooldown", { time: at(plan.cooldownUntil) })}</li>
      ) : plan.changes.length > 0 && cooling !== undefined ? (
        <li>{t("coolingNoReset", { time: at(cooling) })}</li>
      ) : (
        plan.changes.length === 0 &&
        cooling === undefined &&
        rules && <li>{t("cooldownRule", { duration: formatDuration(rules.cooldown) })}</li>
      )}
      {maximum !== undefined && (
        <li>{t("slots", { used: plan.next.length, max: String(maximum) })}</li>
      )}
      {plan.issues.map((issue) => (
        <li key={issue} data-tone="negative">
          {t(`issue.${issue}`)}
        </li>
      ))}
    </ul>
  );
  // Phones show the impact as one line in the footer, expandable to the full list.
  const impactShort = plan
    ? [
        plan.lockedAfter !== plan.lockedBefore
          ? t("lockedShort", {
              before: rewardDisplay(plan.lockedBefore, 18).display,
              after: rewardDisplay(plan.lockedAfter, 18).display,
            })
          : null,
        plan.changes.length > 0 && plan.startsCooldown ? t("cooldownShort") : null,
        plan.issues.length ? t("issuesShort", { count: plan.issues.length }) : null,
      ]
        .filter(Boolean)
        .join(" · ") || t("noChanges")
    : t("loading");

  const addContent = (inDialog: boolean) => (
    <>
      <label className={styles.search}>
        <span className={styles.srOnly}>{t("addSearch")}</span>
        <input
          type="search"
          autoFocus={inDialog}
          value={search}
          disabled={!canAdd}
          placeholder={t("addPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {!canAdd ? (
        <span className={styles.cellMeta}>
          {cooling !== undefined
            ? t("addCooling", { time: at(cooling) })
            : maximum !== undefined
              ? t("addLimit", { max: String(maximum) })
              : t("loading")}
        </span>
      ) : options.length ? (
        <ul className={styles.editorSuggestions} aria-label={t("addSearch")}>
          {options.map((pool) => (
            <li key={pool.poolId}>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                onClick={() => {
                  const key = lower(pool.poolId);
                  setAdded({ ...added, [key]: pool });
                  setTargets({
                    ...targets,
                    [id]: { ...targets[id], [key]: { poolId: pool.poolId, amount: 0n } },
                  });
                  setJustAdded(key);
                  setSearch("");
                  setAddOpen(false);
                }}
              >
                + {poolLabel(pool)}
              </button>
              <span className={styles.cellMeta}>
                {t("streams", { count: pool.incentiveStreamCount })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className={styles.cellMeta}>
          {suggestions.loading ? t("loading") : t("addEmpty")}
        </span>
      )}
    </>
  );

  return (
    <div className={styles.allocationEditor}>
      <p className={`${styles.muted} ${styles.editorIntro}`}>{t("intro")}</p>
      <details className={styles.editorAbout}>
        <summary>{t("about")}</summary>
        <p className={styles.muted}>{t("intro")}</p>
      </details>
      <button
        type="button"
        className={styles.positionTrigger}
        aria-haspopup="dialog"
        aria-label={t("choosePosition", { id })}
        onClick={() => {
          setPickerQuery("");
          setPickerPage(Math.floor(positions.indexOf(row) / PICKER_PAGE));
          setPickerOpen(true);
        }}
      >
        <span className={styles.chipLabel}>{t("position")}</span>
        <span className={styles.positionTriggerHeading}>
          <strong>{t("positionName", { id })}</strong>
          {positionPills(selectedSummary)}
          <span className={styles.positionTriggerAction} aria-hidden="true">
            {t("changePosition")} ›
          </span>
        </span>
        <span className={styles.cellMeta}>{positionMeta(row, selectedSummary)}</span>
      </button>
      {pickerOpen && (
        <ReviewDrawer
          title={t("positionsTitle")}
          variant="fullscreen"
          onClose={() => setPickerOpen(false)}
        >
          <div className={styles.positionPicker}>
            {positions.length > PICKER_PAGE && (
              <label className={styles.search}>
                <span className={styles.srOnly}>{t("findPosition")}</span>
                <input
                  type="search"
                  inputMode="numeric"
                  value={pickerQuery}
                  placeholder={t("findPosition")}
                  onChange={(event) => {
                    setPickerQuery(event.target.value);
                    setPickerPage(0);
                  }}
                />
              </label>
            )}
            {matching.length === 0 ? (
              <p className={styles.muted}>{t("noPositionMatch")}</p>
            ) : (
              <ul className={styles.positionOptions} aria-label={t("positionsTitle")}>
                {matching
                  .slice(pickerPageNow * PICKER_PAGE, (pickerPageNow + 1) * PICKER_PAGE)
                  .map((target) => {
                    const summary = summaryOf(target),
                      targetId = String(target.positionId);
                    const share = (amount: bigint) =>
                      target.stakedBalance > 0n
                        ? Number((amount * 10_000n) / target.stakedBalance) / 100
                        : 0;
                    return (
                      <li key={targetId}>
                        <button
                          type="button"
                          className={styles.positionOption}
                          aria-pressed={targetId === id}
                          aria-label={[
                            t("positionName", { id: targetId }),
                            summary.cooling ? t("optionCooling", { time: summary.cooling }) : null,
                            summary.changes ? t("optionEdited", { count: summary.changes }) : null,
                            positionMeta(target, summary),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                          onClick={() => {
                            setSelected(targetId);
                            setPickerOpen(false);
                          }}
                        >
                          <span className={styles.positionTriggerHeading}>
                            <strong>{t("positionName", { id: targetId })}</strong>
                            {targetId === id && (
                              <span className={styles.statusPill}>{t("selectedPill")}</span>
                            )}
                            {positionPills(summary)}
                          </span>
                          <span className={styles.cellMeta}>{positionMeta(target, summary)}</span>
                          <span className={styles.stakeBar} aria-hidden="true">
                            <span style={{ width: `${share(summary.locked)}%` }} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
            {matching.length > PICKER_PAGE && (
              <div className={styles.pickerPager}>
                <button
                  type="button"
                  className="ui-button ui-button--secondary ui-button--sm"
                  aria-label={t("previousPage")}
                  disabled={pickerPageNow === 0}
                  onClick={() => setPickerPage(pickerPageNow - 1)}
                >
                  ‹
                </button>
                <span className={styles.cellMeta}>
                  {t("pageRange", {
                    from: pickerPageNow * PICKER_PAGE + 1,
                    to: Math.min((pickerPageNow + 1) * PICKER_PAGE, matching.length),
                    total: matching.length,
                  })}
                </span>
                <button
                  type="button"
                  className="ui-button ui-button--secondary ui-button--sm"
                  aria-label={t("nextPage")}
                  disabled={pickerPageNow >= pickerPages - 1}
                  onClick={() => setPickerPage(pickerPageNow + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </ReviewDrawer>
      )}

      <section className={styles.editorCard} aria-label={t("card", { id })}>
        <p className={styles.editorStatsLine}>
          {t("statsLine", {
            staked: rewardDisplay(row.stakedBalance, 18).display,
            allocated: rewardDisplay(lockedAfter, 18).display,
            free: rewardDisplay(freeAfter, 18).display,
          })}
        </p>
        <div className={styles.editorStats}>
          <div>
            <span className={styles.chipLabel}>{t("staked")}</span>
            <strong>{statics(row.stakedBalance)}</strong>
          </div>
          <div>
            <span className={styles.chipLabel}>{t("allocated")}</span>
            <strong>{statics(lockedAfter)}</strong>
          </div>
          <div>
            <span className={styles.chipLabel}>{t("free")}</span>
            <strong>{statics(freeAfter)}</strong>
          </div>
        </div>
        <div
          className={styles.stakeBar}
          role="img"
          aria-label={t("bar", {
            summary: [
              ...segments.map((entry) => `${nameOf(entry.poolId)} ${share(entry.amount)}%`),
              `${t("free")} ${share(freeAfter)}%`,
            ].join(", "),
          })}
        >
          {segments.map((entry) => (
            <span
              key={entry.poolId}
              data-index={keys.indexOf(lower(entry.poolId)) % 5}
              style={{ width: `${share(entry.amount)}%` }}
            />
          ))}
        </div>
        {cooling !== undefined && (
          <p className={styles.editorNotice} data-tone="warning">
            {t("coolingNow", { time: at(cooling) })}
          </p>
        )}
        {start.unlock && String(start.positionId) === id && (
          <p className={styles.editorNotice}>
            {t("unlockNote", { amount: statics(start.unlock) })}
          </p>
        )}

        <div className={styles.editorToolbar}>
          <div className={styles.statusTabs} role="group" aria-label={t("units")}>
            {(["amount", "percent"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={unit === value}
                onClick={() => {
                  setUnit(value);
                  setInputs({});
                }}
              >
                {t(`unit.${value}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            disabled={cooling !== undefined || live.length === 0}
            onClick={() => setAmounts(row, evenSplit(live, row.stakedBalance))}
          >
            {t("split")}
          </button>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            disabled={pools.every((poolId) => amountOf(row, lower(poolId)) === 0n)}
            onClick={() =>
              setAmounts(
                row,
                pools.map((poolId) => ({ poolId, amount: 0n }))
              )
            }
          >
            {t("clear")}
          </button>
        </div>

        {pools.length === 0 ? (
          <p className={styles.muted}>{t("noPools")}</p>
        ) : (
          <ul className={styles.editorRows} aria-label={t("pools", { id })}>
            {pools.map((poolId, index) => {
              const key = lower(poolId),
                name = nameOf(poolId);
              const stale = eligibleOf(poolId) === false;
              const before = chainAmount(row, key);
              const after = stale ? 0n : amountOf(row, key);
              const edited = draftsHere.some((change) => change.key === key);
              const ceiling =
                row.stakedBalance > others(key) ? row.stakedBalance - others(key) : 0n;
              // During cooldown a pool can only go back up to its amount on chain.
              const limit = cooling !== undefined && before < ceiling ? before : ceiling;
              const addable = limit > after ? limit - after : 0n;
              const inputKey = `${id}:${key}`;
              const text = inputs[inputKey] ?? "";
              const delta = parse(text, row);
              const setDelta = (value: string) => setInputs({ ...inputs, [inputKey]: value });
              const applyDelta = (amount: bigint) => {
                setAmounts(row, [{ poolId, amount }]);
                setDelta("");
              };
              const info = infoOf(poolId);
              const estimate =
                info && after > 0n && !stale
                  ? poolIncentiveEstimates(info, before, after - before, now)
                  : [];
              return (
                <li
                  key={key}
                  className={styles.editorRow}
                  data-focus={key === focusKey || undefined}
                  data-stale={stale || undefined}
                >
                  <div className={styles.editorRowHeading}>
                    <span
                      className={styles.stakeSwatch}
                      data-index={index % 5}
                      aria-hidden="true"
                    />
                    <strong>{name}</strong>
                    {stale ? (
                      <span className={styles.statusPill} data-tone="warning">
                        {t("status.stale")}
                      </span>
                    ) : edited ? (
                      <span className={styles.statusPill} data-tone="positive">
                        {t("status.edited")}
                      </span>
                    ) : before === 0n && base(row, key) === 0n ? (
                      <span className={styles.statusPill}>{t("status.new")}</span>
                    ) : null}
                  </div>
                  {stale ? (
                    <>
                      <span className={styles.cellMeta}>
                        {t("staleHelp", { amount: statics(before) })}
                      </span>
                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        aria-label={t("removeFrom", { pool: name, id })}
                        disabled={amountOf(row, key) === 0n}
                        onClick={() => setAmounts(row, [{ poolId, amount: 0n }])}
                      >
                        {t("remove")}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={styles.editorAmount}>
                        <strong>{t("current", { amount: statics(after) })}</strong>
                        <span className={styles.cellMeta}>
                          {[
                            before !== after
                              ? t("change", {
                                  before: rewardDisplay(before, 18).display,
                                  after: rewardDisplay(after, 18).display,
                                })
                              : null,
                            t("share", { percent: share(after) }),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <div className={styles.allocationInput}>
                        <div
                          className={styles.amountBox}
                          data-invalid={delta === null || undefined}
                        >
                          <input
                            aria-label={t("deltaFor", { id, pool: name })}
                            inputMode="decimal"
                            placeholder="0"
                            autoFocus={justAdded === key || key === focusKey}
                            value={text}
                            aria-invalid={delta === null || undefined}
                            onChange={(event) => setDelta(event.target.value)}
                          />
                          <span className={styles.inputUnit}>
                            {unit === "amount" ? "STATICS" : "%"}
                          </span>
                          <button
                            type="button"
                            className={styles.inputMax}
                            aria-label={t("maxFor", { pool: name })}
                            disabled={!plan || (addable === 0n && after === 0n)}
                            onClick={() => setDelta(textIn(addable > 0n ? addable : after, row))}
                          >
                            {t("max")}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="ui-button ui-button--secondary ui-button--sm"
                          aria-label={t("addTo", { pool: name, id })}
                          disabled={!plan || !delta || delta > addable}
                          onClick={() => delta && applyDelta(after + delta)}
                        >
                          {t("add")}
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button--ghost ui-button--sm"
                          aria-label={t("removeFrom", { pool: name, id })}
                          disabled={!plan || !delta || delta > after}
                          onClick={() => delta && applyDelta(after - delta)}
                        >
                          {t("remove")}
                        </button>
                      </div>
                      {(delta === null || delta > addable) && (
                        // Say why the amount can't be added (or removed) here.
                        <span className={styles.cellMeta} data-tone="negative">
                          {delta === null
                            ? t("invalidAmount")
                            : cooling !== undefined && addable === 0n
                              ? t("addCoolingRow", { time: at(cooling) })
                              : delta > after
                                ? t("tooMuch", {
                                    add: statics(addable),
                                    remove: statics(after),
                                  })
                                : t("addMax", { amount: statics(addable) })}
                        </span>
                      )}
                      {estimate.length > 0 && (
                        <div className={styles.editorEstimate}>
                          <span className={styles.cellMeta}>{t("weekly")}</span>
                          <RewardAmounts deployment={deployment} amounts={estimate} preview />
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.editorAdd}>{addContent(false)}</div>
        {/* Phones add pools on their own screen, over the editor. */}
        <button
          type="button"
          className={`ui-button ui-button--secondary ${styles.editorAddButton}`}
          aria-haspopup="dialog"
          onClick={() => setAddOpen(true)}
        >
          {t("addPoolButton")}
        </button>
        {addOpen && (
          <ReviewDrawer
            title={t("addPoolTitle", { id })}
            variant="fullscreen"
            onClose={() => setAddOpen(false)}
          >
            <div className={styles.editorAdd}>{addContent(true)}</div>
          </ReviewDrawer>
        )}
      </section>

      <section className={styles.editorImpact} aria-label={t("impact")} aria-live="polite">
        <h3>{t("impact")}</h3>
        {impactList}
      </section>

      <div className={styles.dialogFooter}>
        {changed.length > 0 && (
          <button
            type="button"
            className={styles.footerImpactToggle}
            aria-expanded={impactOpen}
            onClick={() => setImpactOpen(!impactOpen)}
          >
            <span>{impactShort}</span>
            <span aria-hidden="true">{impactOpen ? "▾" : "▸"}</span>
            <span className={styles.srOnly}>{t("impact")}</span>
          </button>
        )}
        {changed.length > 0 && impactOpen && (
          <div className={styles.footerImpact}>{impactList}</div>
        )}
        <div className={styles.changeSet}>
          <span className={styles.changeSetSummary}>
            <strong>
              {changed.length ? t("changedPositions", { count: changed.length }) : t("noChanges")}
            </strong>
            {changed.length > 0 && <span className={styles.cellMeta}>{t("footerHint")}</span>}
          </span>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={!changed.length || blocked}
            onClick={() => apply(false)}
          >
            {t("apply")}
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            disabled={!changed.length || blocked}
            onClick={() => apply(true)}
          >
            {t("applyReview")}
          </button>
        </div>
      </div>
    </div>
  );
}
