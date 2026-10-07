"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  BATCH_REWARD_MAX_CLAIMS,
  BATCH_REWARD_MAX_ENTRIES,
  buildBatchClaimRewardsCall,
  decodeBatchClaimRewardsResult,
  staticsBatchRewardsAbi,
  type BatchRewardClaims,
} from "@statics-protocol/sdk";
import type { Hex } from "viem";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  executeBatchRewardClaims,
  freezeBatchRewardClaims,
  planBatchRewardClaims,
  reviewedBatchRewardAmounts,
} from "@/lib/phase-one/batch-rewards";
import type { PositionRewardPortfolio, RewardAmount } from "@/lib/phase-one/reward-portfolio";
import { scopeRewardAmounts, rewardPoolName, type RewardClaimScope } from "@/lib/rewards/earn";
import { ReviewDrawer } from "./ReviewDrawer";
import { RewardAmounts } from "./RewardAmounts";
import styles from "./earn.module.css";

const allSources: RewardClaimScope = { sources: ["global", "gauge", "lp-bribe", "allocator"] };
type Progress = {
  context: string;
  state: "preparing" | "review" | "signing" | "confirming" | "complete" | "stopped" | "error";
  completed: number;
  total: number;
  hashes: Hex[];
  stopRequested?: boolean;
  batches?: BatchRewardClaims[];
  totals?: readonly RewardAmount[];
};
export function BatchRewardClaim({
  deployment,
  rows,
  loading,
  incomplete,
  scope = allSources,
  label,
  scopeKey = "",
}: {
  deployment: PhaseOneDeployment;
  rows: readonly PositionRewardPortfolio[];
  loading: boolean;
  incomplete: boolean;
  scope?: RewardClaimScope;
  label?: string;
  scopeKey?: string;
}) {
  const t = useTranslations("batchRewards"),
    u = useTranslations("earnUx"),
    p = useTranslations("phaseOne");
  const selection = `${scopeKey}:${JSON.stringify(scope, (_, value) => (typeof value === "bigint" ? String(value) : value))}:${rows.map((row) => String(row.positionId)).join(",")}`;
  const action = usePhaseOneAction(deployment, selection),
    cache = useQueryClient();
  const context = `${deployment.descriptor.deploymentId}:${action.wallet}:${action.walletState.chainId}:${selection}`;
  const [progress, setProgress] = useState<Progress | null>(null),
    stop = useRef(false);
  useLayoutEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, [context]);
  const visible = progress?.context === context ? progress : null;
  const running = Boolean(action.busy && action.review);
  const update = (values: Partial<Progress>) =>
    setProgress((previous) =>
      previous?.context === context ? { ...previous, ...values } : previous
    );
  const title = label ?? t("claimAll");
  const review = () => {
    stop.current = false;
    setProgress({ context, state: "preparing", completed: 0, total: 0, hashes: [] });
    void action.prepare(async () => {
      try {
        if (loading || incomplete) throw new Error(t("incomplete"));
        const client = action.publicClient!,
          wallet = action.wallet!,
          diamond = deployment.contracts.diamond;
        try {
          const limits = await cache.fetchQuery({
            queryKey: ["phase-one-batch-limits", deployment.descriptor.chainId, diamond],
            staleTime: 300_000,
            retry: false,
            queryFn: () =>
              client.readContract({
                address: diamond,
                abi: staticsBatchRewardsAbi,
                functionName: "batchClaimLimits",
              }),
          });
          if (
            limits[0] !== BigInt(BATCH_REWARD_MAX_CLAIMS) ||
            limits[1] !== BigInt(BATCH_REWARD_MAX_ENTRIES)
          )
            throw new Error();
        } catch {
          throw new Error(t("unsupported"));
        }
        action.assertCurrent();
        const planned = planBatchRewardClaims(rows, wallet, diamond, scope);
        if (!planned.length) throw new Error(t("noRewards"));
        const blockNumber = await client.getBlockNumber(),
          batches: BatchRewardClaims[] = [];
        for (const batch of planned) {
          action.assertCurrent();
          if (stop.current) throw new Error(u("stopped"));
          const preview = await client.call({
            account: wallet,
            to: diamond,
            data: buildBatchClaimRewardsCall(batch, diamond),
            blockNumber,
          });
          if (!preview.data) throw new Error(t("invalidPreview"));
          batches.push(freezeBatchRewardClaims(batch, decodeBatchClaimRewardsResult(preview.data)));
        }
        action.assertCurrent();
        if (stop.current) throw new Error(u("stopped"));
        const totals = reviewedBatchRewardAmounts(batches, rows);
        if (!totals.length) throw new Error(t("noRewards"));
        update({ state: "review", total: batches.length, batches, totals });
        return {
          label: title,
          details: [],
          execute: async () => {
            try {
              await executeBatchRewardClaims({
                batches,
                assertCurrent: () => {
                  action.assertCurrent();
                  if (stop.current) throw new Error(u("stopped"));
                },
                send: (batch, index) => {
                  update({ state: "signing" });
                  return action.send({
                    kind: "phase-one-claim-batch-rewards",
                    label: t("batch", { current: index + 1, total: batches.length }),
                    amount: t("batchAmount", {
                      count:
                        batch.globalClaims.length +
                        batch.lpClaims.length +
                        batch.allocatorClaims.length,
                    }),
                    to: diamond,
                    data: buildBatchClaimRewardsCall(batch, diamond),
                    onSigning: () => {
                      action.assertCurrent();
                      if (stop.current) throw new Error(u("stopped"));
                      update({ state: "signing" });
                    },
                    onSubmitted: () => update({ state: "confirming" }),
                    validateSimulation: (data) => {
                      if (!data) throw new Error(t("invalidPreview"));
                      freezeBatchRewardClaims(batch, decodeBatchClaimRewardsResult(data));
                    },
                  });
                },
                onConfirmed: (hash, completed) =>
                  setProgress((previous) =>
                    previous?.context === context
                      ? { ...previous, completed, hashes: [...previous.hashes, hash] }
                      : previous
                  ),
              });
              update({ state: "complete" });
            } catch (failure) {
              update({ state: stop.current ? "stopped" : "error" });
              throw failure;
            }
          },
        };
      } catch (failure) {
        update({ state: stop.current ? "stopped" : "error" });
        throw failure;
      }
    });
  };
  const close = () => {
    stop.current = true;
    action.cancel();
    setProgress(null);
  };
  const positive = scopeRewardAmounts(rows, scope).length > 0;
  return (
    <div>
      <button
        type="button"
        className="ui-button ui-button--primary"
        disabled={
          !action.ready ||
          loading ||
          incomplete ||
          !positive ||
          action.busy ||
          Boolean(action.review)
        }
        onClick={review}
      >
        {action.busy ? t("working") : title}
      </button>
      {visible && (
        <ReviewDrawer title={title} busy={action.busy} onClose={close}>
          <p role="status" aria-live="polite">
            {visible.state === "review"
              ? t("transactions", { count: visible.total })
              : visible.state === "complete"
                ? t("complete", { total: visible.total })
                : visible.state === "error" || visible.state === "stopped"
                  ? `${u(visible.state)} · ${t("progress", { completed: visible.completed, total: visible.total })}`
                  : u(visible.state)}
          </p>
          <p className={styles.recipient}>{t("receiver", { address: action.wallet ?? "" })}</p>
          {visible.totals && (
            <div className={styles.payouts}>
              {visible.totals.map((entry) => (
                <div key={entry.asset}>
                  <span className={styles.muted}>{u("minimumPayout")}</span>
                  <RewardAmounts deployment={deployment} amounts={[entry]} />
                </div>
              ))}
            </div>
          )}
          {visible.batches && (
            <details className={styles.breakdown}>
              <summary>{u("claimBreakdown")}</summary>
              {visible.batches.map((batch, index) => (
                <section key={index}>
                  <h3>{t("batch", { current: index + 1, total: visible.total })}</h3>
                  {(
                    [
                      ["global", batch.globalClaims],
                      ["lp", batch.lpClaims],
                      ["allocator", batch.allocatorClaims],
                    ] as const
                  ).map(([kind, groups]) =>
                    groups.map((group, groupIndex) => (
                      <div key={`${kind}:${groupIndex}`}>
                        <p>
                          {u("position", { id: String(group.positionId) })}
                          {"poolId" in group
                            ? ` · ${rewardPoolName(deployment, group.poolId)}`
                            : ` · ${u("staking")}`}{" "}
                          · {u("entries", { count: group.minimumAmounts.length })}
                        </p>
                        <RewardAmounts
                          deployment={deployment}
                          amounts={reviewedBatchRewardAmounts(
                            [
                              {
                                receiver: batch.receiver,
                                globalClaims:
                                  kind === "global"
                                    ? [group as BatchRewardClaims["globalClaims"][number]]
                                    : [],
                                lpClaims:
                                  kind === "lp"
                                    ? [group as BatchRewardClaims["lpClaims"][number]]
                                    : [],
                                allocatorClaims:
                                  kind === "allocator"
                                    ? [group as BatchRewardClaims["allocatorClaims"][number]]
                                    : [],
                              },
                            ],
                            rows
                          )}
                        />
                      </div>
                    ))
                  )}
                </section>
              ))}
            </details>
          )}
          {action.error && (
            <p className="dapp-inline-error" role="alert">
              {action.error}
            </p>
          )}
          {visible.hashes.length > 0 && (
            <div className={styles.transactions}>
              {visible.hashes.map((hash, index) => (
                <a
                  key={`${index}:${hash}`}
                  href={
                    action.walletState.explorerUrl
                      ? `${action.walletState.explorerUrl}/tx/${hash}`
                      : `/app/activity?transaction=${hash}`
                  }
                >
                  {u("confirmedTransaction", { count: index + 1 })} · {hash.slice(0, 10)}…
                  {hash.slice(-6)}
                </a>
              ))}
            </div>
          )}
          {visible.state === "review" && action.review && (
            <>
              <p className={styles.muted}>{t("atomicHelp")}</p>
              <button
                type="button"
                className="ui-button ui-button--primary"
                disabled={!action.ready || action.busy}
                onClick={() => void action.confirm()}
              >
                {p("confirm")}
              </button>
            </>
          )}
          {running && (
            <button
              type="button"
              className="ui-button ui-button--secondary"
              onClick={() => {
                stop.current = true;
                update({ stopRequested: true });
              }}
              disabled={Boolean(visible.stopRequested)}
            >
              {u("stopAfterCurrent")}
            </button>
          )}
          {!action.busy && (
            <button type="button" className="ui-button ui-button--secondary" onClick={close}>
              {visible.state === "review" ? p("cancel") : u("close")}
            </button>
          )}
        </ReviewDrawer>
      )}
    </div>
  );
}
