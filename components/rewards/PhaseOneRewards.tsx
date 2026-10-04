"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, formatUnits, type Address } from "viem";
import { usePhaseOnePositions } from "@/hooks/usePhaseOnePositions";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { RewardSelectionEditor } from "@/components/positions/RewardSelectionEditor";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { loadIndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import {
  readPositionStakingState,
  buildPositionStakingTransaction,
  buildStaticsStakeApproval,
} from "@/lib/phase-one/staking";
import {
  readPositionGaugeState,
  readPositionGaugeRewards,
  buildGaugeAllocationTransaction,
  buildGaugeRewardResolution,
  validateGaugeAllocationChange,
  replacePoolAllocation,
} from "@/lib/phase-one/gauges";
import { globalRewardPrerequisites, gaugePrerequisites } from "@/lib/phase-one/reward-actions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { useAppLocale } from "@/i18n/client";

export function PhaseOneRewards({
  deployment,
  initialPositionId,
}: {
  deployment: PhaseOneDeployment;
  initialPositionId: bigint | null;
}) {
  const t = useTranslations("rewards");
  const p = useTranslations("phaseOne");
  const action = usePhaseOneAction(deployment);
  const positions = usePhaseOnePositions(deployment.descriptor.deploymentId, action.wallet);
  const initial = useQuery({
    queryKey: [
      "phase-one-position",
      deployment.descriptor.deploymentId,
      action.wallet,
      String(initialPositionId),
      "detail",
    ],
    enabled: Boolean(action.wallet && initialPositionId !== null),
    retry: false,
    queryFn: () =>
      loadIndexedPhaseOnePosition(initialPositionId!, deployment.descriptor.deploymentId),
  });
  const ownInitial =
    initial.data?.owner.toLowerCase() === action.wallet?.toLowerCase() ? initial.data : null;
  const items = [
    ...new Map(
      [...positions.items, ...(ownInitial ? [ownInitial] : [])].map((item) => [
        String(item.positionId),
        item,
      ])
    ).values(),
  ];
  const [selection, setSelection] = useState<string | null>(null);
  const [poolId, setPoolId] = useState(
    deployment.supportedPools.find((pool) => pool.enabled)?.poolId ?? ""
  );
  const selected =
    items.find((item) => String(item.positionId) === selection) ?? ownInitial ?? items[0];
  return (
    <div className="rewards-page">
      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("startEarning")}</p>
            <h2>{t("createAndStakeTitle")}</h2>
            <p>{t("createAndStakeDescription")}</p>
          </div>
        </div>
        <ActionReview action={action} />
        {positions.isError && <p role="alert">{positions.error.message}</p>}
        {items.length === 0 ? (
          <Link className="dollar-submit" href="/app/positions">
            {p("newPosition")}
          </Link>
        ) : (
          <label className="basket-field">
            {p("choosePosition")}
            <select
              value={String(selected?.positionId ?? "")}
              onChange={(event) => setSelection(event.target.value)}
            >
              {items.map((position) => (
                <option key={String(position.positionId)} value={String(position.positionId)}>
                  {t("positionNumber", { id: String(position.positionId) })}
                </option>
              ))}
            </select>
          </label>
        )}
        {positions.hasNextPage && (
          <button
            type="button"
            disabled={positions.isFetchingNextPage}
            onClick={() => void positions.fetchNextPage()}
          >
            {p("loadMore")}
          </button>
        )}
        {deployment.supportedPools.some((pool) => pool.enabled) && (
          <label className="basket-field">
            {p("pool")}
            <select
              value={poolId}
              onChange={(event) => setPoolId(event.target.value as `0x${string}`)}
            >
              {deployment.supportedPools
                .filter((pool) => pool.enabled)
                .map((pool) => (
                  <option key={pool.poolId} value={pool.poolId}>
                    {pool.token0.symbol}/{pool.token1.symbol}
                  </option>
                ))}
            </select>
          </label>
        )}
      </section>
      {selected && (
        <PositionRewards
          key={`${deployment.descriptor.deploymentId}:${action.wallet}:${selected.positionId}:${poolId}`}
          deployment={deployment}
          positionId={selected.positionId}
          poolId={poolId as `0x${string}`}
        />
      )}
    </div>
  );
}

function PositionRewards({
  deployment,
  positionId,
  poolId,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: `0x${string}`;
}) {
  const t = useTranslations("rewards");
  const d = useTranslations("positionDetail");
  const p = useTranslations("phaseOne");
  const locale = useAppLocale();
  const action = usePhaseOneAction(deployment, `${positionId}:${poolId}`);
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState("");
  const [allocationInput, setAllocationInput] = useState<string | null>(null);
  const [assetDraft, setAssetDraft] = useState<readonly Address[] | null>(null);
  const live = useQuery({
    queryKey: protocolQueryKeys.phaseOnePosition(
      deployment.descriptor.deploymentId,
      action.wallet,
      positionId
    ),
    enabled: action.ready,
    queryFn: async () => {
      const block = await action.publicClient!.getBlock({ blockTag: "pending" });
      const [staking, gauges] = await Promise.all([
        readPositionStakingState({
          publicClient: action.publicClient!,
          deployment,
          positionId,
          account: action.wallet!,
        }),
        readPositionGaugeState({
          publicClient: action.publicClient!,
          deployment,
          positionId,
          account: action.wallet!,
          now: Number(block.timestamp),
        }),
      ]);
      return { staking, gauges };
    },
  });
  const rewards = useQuery({
    queryKey: protocolQueryKeys.phaseOneRewards(
      deployment.descriptor.deploymentId,
      action.wallet,
      positionId,
      poolId
    ),
    enabled: action.ready && Boolean(poolId),
    queryFn: () =>
      readPositionGaugeRewards({
        publicClient: action.publicClient!,
        deployment,
        positionId,
        poolId,
        account: action.wallet!,
      }),
  });
  const tokens = [
    ...new Map(
      deployment.supportedPools
        .flatMap((pool) => [pool.token0, pool.token1])
        .map((token) => [
          token.address.toLowerCase(),
          { ...token, name: token.symbol, metadataAvailable: true },
        ])
    ).values(),
  ];
  const describeAmount = (asset: Address, amount: bigint) => {
    const token = tokens.find((entry) => entry.address.toLowerCase() === asset.toLowerCase());
    return token
      ? `${formatUnits(amount, token.decimals)} ${token.symbol}`
      : `${amount} units (${asset})`;
  };
  const selectedAssets = assetDraft ?? live.data?.staking.selectedAssets ?? [];
  const confirmedAssets = live.data?.staking.selectedAssets ?? [];
  const additions = selectedAssets.filter((asset) => !confirmedAssets.includes(asset));
  const removals = confirmedAssets.filter((asset) => !selectedAssets.includes(asset));
  const allocation =
    live.data?.gauges.allocations.active.find(
      (entry) => entry.poolId.toLowerCase() === poolId.toLowerCase()
    )?.amount ?? 0n;
  const allocationValue = allocationInput ?? formatUnits(allocation, 18);
  const sendPrerequisites = async (
    prerequisites: readonly { label: string; data: `0x${string}` }[]
  ) => {
    for (const prerequisite of prerequisites)
      await action.send({
        kind: "checkpoint-rewards",
        label: prerequisite.label,
        amount: `Position #${positionId}`,
        to: deployment.contracts.diamond,
        data: prerequisite.data,
      });
  };
  const stake = (kind: "stake" | "unstake") =>
    action.prepare(async () => {
      if (!live.data || !action.publicClient || !action.wallet) throw new Error(p("selection"));
      const amount = parseLocalizedUnits(amountInput, 18, locale);
      const transaction = buildPositionStakingTransaction({
        deployment,
        positionId,
        action: kind === "stake" ? { kind, amount } : { kind, amount, receiver: action.wallet },
      });
      const prerequisites = await globalRewardPrerequisites(
        action.publicClient,
        deployment,
        confirmedAssets
      );
      return {
        label: kind === "stake" ? p("stake") : p("unstake"),
        details: [`${formatUnits(amount, 18)} STATICS`, ...prerequisites.map((item) => item.label)],
        execute: async () => {
          if (kind === "stake") {
            const key = [
              "phase-one-stake-allowance",
              deployment.descriptor.deploymentId,
              deployment.descriptor.chainId,
              action.wallet,
              deployment.contracts.statics,
              deployment.contracts.diamond,
            ] as const;
            const read = () =>
              action.publicClient!.readContract({
                address: deployment.contracts.statics,
                abi: erc20Abi,
                functionName: "allowance",
                args: [action.wallet!, deployment.contracts.diamond],
              });
            const allowance = await queryClient.fetchQuery({
              queryKey: key,
              staleTime: 0,
              queryFn: read,
            });
            const approval = buildStaticsStakeApproval({ deployment, allowance, required: amount });
            if (approval.needed) {
              await action.send({
                kind: "phase-one-approve-token",
                label: p("stake"),
                amount: `${formatUnits(amount, 18)} STATICS`,
                to: approval.target,
                data: approval.calldata,
              });
              await queryClient.fetchQuery({ queryKey: key, staleTime: 0, queryFn: read });
            }
          }
          await sendPrerequisites(prerequisites);
          await action.send({
            kind: kind === "stake" ? "phase-one-stake" : "phase-one-unstake",
            label: kind === "stake" ? p("stake") : p("unstake"),
            amount: `${formatUnits(amount, 18)} STATICS`,
            to: transaction.target,
            data: transaction.calldata,
          });
          setAmountInput("");
        },
      };
    });
  const saveSelection = () =>
    action.prepare(async () => {
      if (!action.publicClient || !live.data) throw new Error(p("selection"));
      if (BigInt(selectedAssets.length) > live.data.staking.maximumRewardAssets)
        throw new Error(
          d("chooseAssets", { count: String(live.data.staking.maximumRewardAssets) })
        );
      const prerequisites = await globalRewardPrerequisites(action.publicClient, deployment, [
        ...confirmedAssets,
        ...additions,
      ]);
      const transactions = [
        ...(removals.length
          ? [
              buildPositionStakingTransaction({
                deployment,
                positionId,
                action: { kind: "opt-out", assets: removals },
              }),
            ]
          : []),
        ...(additions.length
          ? [
              buildPositionStakingTransaction({
                deployment,
                positionId,
                action: { kind: "opt-in", assets: additions },
              }),
            ]
          : []),
      ];
      return {
        label: d("selectedRewards"),
        details: [
          p("selectionHelp"),
          ...additions.map((asset) => `+ ${describeAmount(asset, 0n)}`),
          ...removals.map((asset) => `− ${describeAmount(asset, 0n)}`),
          ...prerequisites.map((item) => item.label),
        ],
        execute: async () => {
          await sendPrerequisites(prerequisites);
          for (const transaction of transactions)
            await action.send({
              kind: "phase-one-reward-selection",
              label: d("selectedRewards"),
              amount: `${additions.length + removals.length}`,
              to: transaction.target,
              data: transaction.calldata,
            });
          setAssetDraft(null);
        },
      };
    });
  const saveAllocation = () =>
    action.prepare(async () => {
      if (!action.publicClient || !action.wallet) throw new Error(p("selection"));
      const prerequisites = await gaugePrerequisites(action.publicClient, deployment);
      const block = await action.publicClient.getBlock({ blockTag: "pending" });
      const [gauges, staking] = await Promise.all([
        readPositionGaugeState({
          publicClient: action.publicClient,
          deployment,
          positionId,
          account: action.wallet,
          now: Number(block.timestamp),
        }),
        readPositionStakingState({
          publicClient: action.publicClient,
          deployment,
          positionId,
          account: action.wallet,
        }),
      ]);
      const next = replacePoolAllocation(
        gauges.allocations.active,
        poolId,
        parseLocalizedUnits(allocationValue || "0", 18, locale)
      );
      const validation = validateGaugeAllocationChange({
        current: gauges.allocations,
        next,
        stakedBalance: staking.stakedBalance,
        maximumAllocations: gauges.maximumAllocations,
        now: Number(block.timestamp),
      });
      const transaction = buildGaugeAllocationTransaction({
        deployment,
        positionId,
        next,
        validation,
      });
      return {
        label: p("allocation"),
        details: [
          p("allocationHelp"),
          ...next.map(
            (entry) =>
              `${deployment.supportedPools.find((pool) => pool.poolId === entry.poolId)?.token0.symbol ?? entry.poolId}: ${formatUnits(entry.amount, 18)} STATICS`
          ),
          ...prerequisites.map((item) => item.label),
        ],
        execute: async () => {
          await sendPrerequisites(prerequisites);
          await action.send({
            kind: "phase-one-set-allocations",
            label: p("allocation"),
            amount: `${formatUnits(validation.totalAllocated, 18)} STATICS`,
            to: transaction.target,
            data: transaction.calldata,
          });
          setAllocationInput(null);
        },
      };
    });
  const claim = (kind: "global" | "lp" | "allocator") =>
    action.prepare(async () => {
      if (!action.publicClient || !action.wallet) throw new Error(p("selection"));
      const prerequisites =
        kind === "global"
          ? await globalRewardPrerequisites(action.publicClient, deployment, confirmedAssets, true)
          : await gaugePrerequisites(action.publicClient, deployment);
      const latest =
        kind === "global"
          ? await readPositionStakingState({
              publicClient: action.publicClient,
              deployment,
              positionId,
              account: action.wallet,
            })
          : await readPositionGaugeRewards({
              publicClient: action.publicClient,
              deployment,
              positionId,
              poolId,
              account: action.wallet,
            });
      const claims =
        "pendingRewards" in latest
          ? latest.selectedAssets.map((asset, index) => ({
              asset,
              slot: index,
              amount: latest.pendingRewards[index],
            }))
          : kind === "lp"
            ? latest.lp.amounts
                .slice(0, latest.lp.slotCount)
                .map((amount, slot) => ({ amount, slot, asset: latest.lp.assets[slot] }))
            : latest.allocator;
      const positive = claims.filter((entry) => entry.amount > 0n);
      if (!positive.length) throw new Error("No rewards are available to claim.");
      const minimumAmounts = positive.map((entry) => (entry.amount * 995n) / 1000n);
      const transaction =
        kind === "global"
          ? buildPositionStakingTransaction({
              deployment,
              positionId,
              action: {
                kind: "claim",
                assets: positive.map((entry) => entry.asset),
                minimumAmounts,
                receiver: action.wallet,
              },
            })
          : buildGaugeRewardResolution({
              deployment,
              positionId,
              poolId,
              action: {
                kind: kind === "lp" ? "claim-lp" : "claim-allocator",
                slots: positive.map((entry) => entry.slot),
                minimumAmounts,
                receiver: action.wallet,
              },
            });
      const label =
        kind === "global" ? p("globalClaim") : kind === "lp" ? p("lpClaim") : p("allocatorClaim");
      return {
        label,
        details: [
          ...positive.map(
            (entry, index) =>
              `${p("minimum")}: ${describeAmount(entry.asset, minimumAmounts[index])}`
          ),
          ...prerequisites.map((entry) => entry.label),
        ],
        execute: async () => {
          await sendPrerequisites(prerequisites);
          await action.send({
            kind:
              kind === "global"
                ? "phase-one-claim-global-rewards"
                : kind === "lp"
                  ? "phase-one-claim-lp-rewards"
                  : "phase-one-claim-allocator-rewards",
            label,
            amount: positive.map((entry) => describeAmount(entry.asset, entry.amount)).join(", "),
            to: transaction.target,
            data: transaction.calldata,
          });
        },
      };
    });
  const disabled = !action.ready || action.busy || !live.data;
  return (
    <>
      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("stakingSource")}</p>
            <h3>{t("positionNumber", { id: String(positionId) })}</h3>
          </div>
        </div>
        {live.isError && <p role="alert">{live.error.message}</p>}
        <p>
          {p("staked")}: {formatUnits(live.data?.staking.stakedBalance ?? 0n, 18)}
        </p>
        <label className="basket-field">
          {p("amount")}
          <input
            value={amountInput}
            disabled={action.busy}
            onChange={(event) => {
              action.cancel();
              setAmountInput(event.target.value);
            }}
            inputMode="decimal"
          />
        </label>
        <button
          className="dollar-submit"
          type="button"
          disabled={disabled || !amountInput}
          onClick={() => void stake("stake")}
        >
          {p("reviewStake")}
        </button>
        <button
          type="button"
          disabled={disabled || !amountInput}
          onClick={() => void stake("unstake")}
        >
          {p("reviewUnstake")}
        </button>
      </section>
      <section className="position-panel">
        <RewardSelectionEditor
          candidates={tokens.map((token) => ({ token, sources: [t("stakingSource")] }))}
          confirmed={confirmedAssets}
          selected={selectedAssets}
          rewards={tokens.map((token) => ({
            token,
            pending:
              live.data?.staking.pendingRewards[confirmedAssets.indexOf(token.address)] ?? 0n,
          }))}
          maximum={live.data?.staking.maximumRewardAssets ?? 0n}
          chainId={deployment.descriptor.chainId}
          changeCount={additions.length + removals.length}
          disabled={disabled}
          saving={action.busy}
          onToggle={(asset) => {
            action.cancel();
            setAssetDraft(
              selectedAssets.includes(asset)
                ? selectedAssets.filter((entry) => entry !== asset)
                : [...selectedAssets, asset]
            );
          }}
          onSave={() => void saveSelection()}
        />
      </section>
      <section className="position-panel">
        <h3>{p("allocation")}</h3>
        <p>{p("allocationHelp")}</p>
        {live.data?.gauges.coolingDown && <p>{p("cooldown")}</p>}
        <label className="basket-field">
          {p("allocationAmount")}
          <input
            value={allocationValue}
            inputMode="decimal"
            disabled={action.busy}
            onChange={(event) => {
              action.cancel();
              setAllocationInput(event.target.value);
            }}
          />
        </label>
        <button
          className="dollar-submit"
          type="button"
          disabled={disabled || !poolId}
          onClick={() => void saveAllocation()}
        >
          {p("saveAllocation")}
        </button>
      </section>
      <section className="position-panel">
        <h3>{t("multiAssetClaims")}</h3>
        <div className="reward-position-list">
          <article className="reward-position">
            <h4>{t("stakingSource")}</h4>
            {confirmedAssets.map((asset, index) => (
              <p key={asset}>
                {describeAmount(asset, live.data?.staking.pendingRewards[index] ?? 0n)}
              </p>
            ))}
            <button
              className="dollar-submit"
              type="button"
              disabled={
                disabled || !live.data?.staking.pendingRewards.some((amount) => amount > 0n)
              }
              onClick={() => void claim("global")}
            >
              {p("globalClaim")}
            </button>
          </article>
          <article className="reward-position">
            <h4>{t("liquiditySource")}</h4>
            {rewards.isError && <p role="alert">{rewards.error.message}</p>}
            {rewards.data?.lp.amounts.slice(0, rewards.data.lp.slotCount).map((amount, slot) => (
              <p key={slot}>{describeAmount(rewards.data!.lp.assets[slot], amount)}</p>
            ))}
            <button
              className="dollar-submit"
              type="button"
              disabled={disabled || !rewards.data?.lp.amounts.some((amount) => amount > 0n)}
              onClick={() => void claim("lp")}
            >
              {p("lpClaim")}
            </button>
            {rewards.data?.allocator.map((entry) => (
              <p key={entry.slot}>{describeAmount(entry.asset, entry.amount)}</p>
            ))}
            <button
              type="button"
              disabled={disabled || !rewards.data?.allocator.some((entry) => entry.amount > 0n)}
              onClick={() => void claim("allocator")}
            >
              {p("allocatorClaim")}
            </button>
          </article>
        </div>
      </section>
      <ActionReview action={action} />
    </>
  );
}
