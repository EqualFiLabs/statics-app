"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatUnits, type Hex } from "viem";
import { staticsAbi, staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import { useAppLocale } from "@/i18n/client";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { buildGaugeAllocationTransaction } from "@/lib/phase-one/gauges";
import { gaugePrerequisites } from "@/lib/phase-one/reward-actions";
import { rewardDisplay } from "@/lib/rewards/earn";
import { planAllocationChange, type AllocationPlan } from "@/lib/rewards/allocations";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import type { AllocationEdits, AllocationRules } from "./AllocationEditor";
import { ReviewDrawer } from "./ReviewDrawer";
import styles from "./earn.module.css";

/**
 * The staged allocation changes and their execution. Review re-reads every position on chain
 * and re-plans against that live state, so what is signed reflects the chain, not the cached
 * view. Each position is one setGaugeAllocations transaction, sent in order; confirmed
 * positions stay confirmed if a later one fails or is stopped.
 */
export function AllocationChangeSet({
  deployment,
  plans,
  edits,
  rules,
  eligible,
  poolName,
  onConfirmed,
  onDiscard,
  reviewRequest = null,
  onReviewRequestHandled,
}: {
  deployment: PhaseOneDeployment;
  /** Plans from the cached view, for the summary. */
  plans: readonly AllocationPlan[];
  edits: AllocationEdits;
  rules: AllocationRules | undefined;
  eligible: (poolId: Hex) => boolean | undefined;
  poolName: (poolId: Hex) => string;
  /** Called once a run ends (finished, failed or stopped) with the positions it confirmed. */
  onConfirmed: (positionIds: readonly bigint[]) => void;
  onDiscard: () => void;
  /** A new value asks to open the review, e.g. after "Add & review" in the editor. */
  reviewRequest?: number | null;
  onReviewRequestHandled?: () => void;
}) {
  const t = useTranslations("allocationChanges");
  const locale = useAppLocale();
  const selection = JSON.stringify(edits, (_, value) =>
    typeof value === "bigint" ? String(value) : value
  );
  const action = usePhaseOneAction(deployment, `allocations:${selection}`);
  const [progress, setProgress] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const stop = useRef(false);
  const statics = (amount: bigint) => `${rewardDisplay(amount, 18).display} STATICS`;
  const at = (seconds: bigint) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(Number(seconds) * 1000)
    );
  const invalid = plans.filter((plan) => plan.issues.length > 0 || !plan.validation.valid);
  const describe = (plan: AllocationPlan) => [
    t("positionLine", {
      id: String(plan.positionId),
      changes: plan.changes
        .map((change) =>
          t("change", {
            pool: poolName(change.poolId),
            before: rewardDisplay(change.before, 18).display,
            after: rewardDisplay(change.after, 18).display,
          })
        )
        .join("; "),
    }),
    ...plan.droppedIneligible.map((poolId) => t("dropped", { pool: poolName(poolId) })),
    ...(plan.startsCooldown && plan.cooldownUntil
      ? [t("cooldown", { id: String(plan.positionId), time: at(plan.cooldownUntil) })]
      : []),
    ...(plan.lockedAfter < plan.lockedBefore
      ? [t("unlocks", { amount: statics(plan.lockedBefore - plan.lockedAfter) })]
      : plan.lockedAfter > plan.lockedBefore
        ? [t("locks", { amount: statics(plan.lockedAfter - plan.lockedBefore) })]
        : []),
  ];

  const review = () => {
    stop.current = false;
    setProgress(null);
    setOpen(true);
    void action.prepare(async () => {
      const client = action.publicClient!,
        diamond = deployment.contracts.diamond;
      if (!rules) throw new Error(t("unavailable"));
      const block = await client.getBlock({ blockTag: "pending" });
      const now = block.timestamp;
      const live: AllocationPlan[] = [];
      for (const [positionId, positionEdits] of Object.entries(edits)) {
        const id = BigInt(positionId);
        const [allocations, stake] = await Promise.all([
          client.readContract({
            address: diamond,
            abi: staticsGaugeIncentivesAbi,
            functionName: "gaugePositionAllocations",
            args: [id],
            account: action.wallet!,
          }),
          client.readContract({
            address: diamond,
            abi: staticsAbi,
            functionName: "stakePosition",
            args: [id],
            account: action.wallet!,
          }),
        ]);
        const plan = planAllocationChange({
          positionId: id,
          current: {
            nextAllocationAt: allocations[0],
            totalAllocated: allocations[1],
            active: allocations[2],
            lockedStake: allocations[3],
          },
          stakedBalance: stake.stakedBalance,
          maximumAllocations: rules.maximumAllocations,
          cooldown: rules.cooldown,
          now,
          edits: new Map(Object.entries(positionEdits)),
          eligible,
        });
        if (plan.issues.length || !plan.validation.valid)
          throw new Error(t("positionInvalid", { id: positionId }));
        if (plan.changes.length) live.push(plan);
      }
      if (!live.length) throw new Error(t("nothingToSend"));
      const prerequisites = await gaugePrerequisites(client, deployment);
      const total = live.length + prerequisites.length;
      return {
        label: t("title"),
        details: [
          t("transactions", { count: total }),
          ...live.flatMap(describe),
          ...prerequisites.map((item) => item.label),
        ],
        execute: async () => {
          let step = 0;
          // The change set is this action's selection; editing it mid-run would invalidate the
          // remaining sends, so confirmed positions are cleared only after the run ends.
          const confirmed: bigint[] = [];
          try {
            for (const prerequisite of prerequisites) {
              if (stop.current) throw new Error(t("stopped"));
              setProgress(t("progress", { current: ++step, total }));
              await action.send({
                kind: "phase-one-checkpoint-schedule",
                label: prerequisite.label,
                amount: t("checkpoint"),
                to: diamond,
                data: prerequisite.data,
              });
            }
            for (const plan of live) {
              if (stop.current) throw new Error(t("stopped"));
              setProgress(t("progress", { current: ++step, total }));
              const transaction = buildGaugeAllocationTransaction({
                deployment,
                positionId: plan.positionId,
                next: plan.next,
                validation: plan.validation,
              });
              await action.send({
                kind: "phase-one-set-allocations",
                label: t("positionLabel", { id: String(plan.positionId) }),
                amount: `${formatUnits(plan.lockedAfter, 18)} STATICS`,
                to: transaction.target,
                data: transaction.calldata,
              });
              confirmed.push(plan.positionId);
            }
          } finally {
            setProgress(null);
            if (confirmed.length) onConfirmed(confirmed);
          }
        },
      };
    });
  };
  const requested = useEffectEvent(() => {
    if (!action.ready || action.busy) return;
    onReviewRequestHandled?.();
    review();
  });
  useEffect(() => {
    // Opening the review starts the wallet preparation, an external effect of the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reviewRequest !== null) requested();
  }, [reviewRequest, action.ready]);
  const close = () => {
    stop.current = true;
    action.cancel();
    setOpen(false);
    setProgress(null);
  };
  const transactions = plans.length;

  return (
    <>
      <div className={styles.changeSet}>
        <div className={styles.changeSetSummary}>
          <strong>{t("summary", { positions: plans.length, transactions })}</strong>
          <span className={styles.cellMeta}>
            {invalid.length ? t("fixIssues", { count: invalid.length }) : t("hint")}
          </span>
        </div>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={onDiscard}
        >
          {t("discard")}
        </button>
        <button
          type="button"
          className="ui-button ui-button--primary ui-button--sm"
          disabled={!plans.length || invalid.length > 0 || !action.ready || action.busy}
          onClick={review}
        >
          {t("review")}
        </button>
      </div>
      {open && (action.review || action.busy || action.error) && (
        <ReviewDrawer title={t("title")} busy={action.busy} onClose={close}>
          <ActionReview action={action} showCancel={false} />
          {action.busy && progress && (
            <>
              <p role="status">{progress}</p>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() => {
                  stop.current = true;
                }}
              >
                {t("stopAfterCurrent")}
              </button>
            </>
          )}
        </ReviewDrawer>
      )}
    </>
  );
}
