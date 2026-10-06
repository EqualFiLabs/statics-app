"use client";

import { useState } from "react";
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
import { formatUnits } from "viem";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  executeBatchRewardClaims,
  freezeBatchRewardClaims,
  planBatchRewardClaims,
  reviewedBatchRewardAmounts,
} from "@/lib/phase-one/batch-rewards";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";

export function BatchRewardClaim({
  deployment,
  rows,
  loading,
  incomplete,
}: {
  deployment: PhaseOneDeployment;
  rows: readonly PositionRewardPortfolio[];
  loading: boolean;
  incomplete: boolean;
}) {
  const t = useTranslations("batchRewards");
  const selection = rows.map((row) => String(row.positionId)).join(",");
  const action = usePhaseOneAction(deployment, selection);
  const cache = useQueryClient();
  const [progress, setProgress] = useState<{
    context: string;
    completed: number;
    total: number;
  } | null>(null);
  const context = `${deployment.descriptor.deploymentId}:${action.wallet}:${action.walletState.chainId}:${selection}`;
  const visibleProgress = progress?.context === context ? progress : null;
  const positive = rows.some(
    (row) =>
      row.global?.pendingRewards.some((value) => value > 0n) ||
      row.pools.some(
        (pool) =>
          pool.rewards &&
          ((pool.hasLp &&
            pool.rewards.lp.amounts
              .slice(0, pool.rewards.lp.slotCount)
              .some((value) => value > 0n)) ||
            (pool.hasAllocator && pool.rewards.allocator.some((reward) => reward.amount > 0n)))
      )
  );
  const review = () =>
    void action.prepare(async () => {
      setProgress(null);
      if (loading || incomplete) throw new Error(t("incomplete"));
      const client = action.publicClient!;
      const wallet = action.wallet!;
      const diamond = deployment.contracts.diamond;
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
          throw new Error(t("unsupported"));
      } catch {
        throw new Error(t("unsupported"));
      }
      action.assertCurrent();
      const planned = planBatchRewardClaims(rows, wallet, diamond);
      if (!planned.length) throw new Error(t("noRewards"));
      const blockNumber = await client.getBlockNumber();
      const batches: BatchRewardClaims[] = [];
      for (const batch of planned) {
        action.assertCurrent();
        const preview = await client.call({
          account: wallet,
          to: diamond,
          data: buildBatchClaimRewardsCall(batch, diamond),
          blockNumber,
        });
        if (!preview.data) throw new Error(t("invalidPreview"));
        batches.push(freezeBatchRewardClaims(batch, decodeBatchClaimRewardsResult(preview.data)));
      }
      const tokens = new Map(
        deployment.supportedPools
          .flatMap((pool) => [pool.token0, pool.token1])
          .map((token) => [token.address.toLowerCase(), token])
      );
      const totals = reviewedBatchRewardAmounts(batches, rows);
      if (!totals.length) throw new Error(t("noRewards"));
      return {
        label: t("claimAll"),
        details: [
          t("transactions", { count: batches.length }),
          t("receiver", { address: wallet }),
          ...totals.map(({ asset, amount }) => {
            const token = tokens.get(asset.toLowerCase());
            const statics = asset.toLowerCase() === deployment.contracts.statics.toLowerCase();
            return token || statics
              ? t("minimum", {
                  amount: formatUnits(amount, token?.decimals ?? 18),
                  asset: token?.symbol ?? "STATICS",
                })
              : t("unknownMinimum", { amount: String(amount), asset });
          }),
          t("atomicHelp"),
        ],
        execute: async () => {
          setProgress({ context, completed: 0, total: batches.length });
          await executeBatchRewardClaims({
            batches,
            assertCurrent: action.assertCurrent,
            send: (batch, index) =>
              action.send({
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
                validateSimulation: (data) => {
                  if (!data) throw new Error(t("invalidPreview"));
                  freezeBatchRewardClaims(batch, decodeBatchClaimRewardsResult(data));
                },
              }),
            onConfirmed: (_, completed) =>
              setProgress({ context, completed, total: batches.length }),
          });
        },
      };
    });
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
        {action.busy ? t("working") : t("claimAll")}
      </button>
      {visibleProgress && (
        <p role="status" aria-live="polite">
          {t(
            visibleProgress.completed === visibleProgress.total ? "complete" : "progress",
            visibleProgress
          )}
        </p>
      )}
      <ActionReview action={action} />
    </div>
  );
}
