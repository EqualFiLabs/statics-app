"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, formatUnits, type Address } from "viem";
import { staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import { usePhaseOnePositions } from "@/hooks/usePhaseOnePositions";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { loadIndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import {
  readPositionStakingState,
  readPositionGlobalRewards,
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
import { gaugePrerequisites } from "@/lib/phase-one/reward-actions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { useAppLocale } from "@/i18n/client";
import { PhaseOneRewardPortfolio } from "@/components/rewards/PhaseOneRewardPortfolio";
import { discoverPositionRewardPools } from "@/lib/phase-one/reward-portfolio";

export function PhaseOneRewards({
  deployment,
  initialPositionId,
}: {
  deployment: PhaseOneDeployment;
  initialPositionId: bigint | null;
}) {
  const t = useTranslations("rewards");
  const e = useTranslations("earn");
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
  const [poolFocus, setPoolFocus] = useState<`0x${string}` | null>(null);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = positions;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const selected =
    items.find((item) => String(item.positionId) === selection) ?? ownInitial ?? items[0];
  return (
    <div className="earn-page">
      <section className="earn-toolbar" aria-label={e("positionContext")}>
        <div>
          <p className="dapp-section-label">{e("positionContext")}</p>
          <p className="earn-muted">{e("positionHelp")}</p>
        </div>
        <ActionReview action={action} />
        {positions.isError && <p role="alert">{positions.error.message}</p>}
        {positions.isLoading || (initialPositionId !== null && initial.isLoading) ? (
          <p role="status" className="earn-muted">
            {e("loadingPositions")}
          </p>
        ) : items.length === 0 ? (
          <Link className="ui-button ui-button--primary" href="/app/positions">
            {p("newPosition")}
          </Link>
        ) : (
          <label className="basket-field earn-position-select">
            {p("choosePosition")}
            <select
              value={String(selected?.positionId ?? "")}
              onChange={(event) => {
                setSelection(event.target.value);
                setPoolFocus(null);
              }}
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
            className="ui-button ui-button--secondary ui-button--sm"
            type="button"
            disabled={positions.isFetchingNextPage}
            onClick={() => void positions.fetchNextPage()}
          >
            {p("loadMore")}
          </button>
        )}
      </section>
      {items.length > 0 && (
        <PhaseOneRewardPortfolio
          deployment={deployment}
          positions={items}
          loadingPositions={
            positions.isLoading || positions.isFetchingNextPage || positions.hasNextPage
          }
          incompletePositions={positions.isError}
          onManage={(positionId, poolId) => {
            setSelection(String(positionId));
            setPoolFocus(poolId);
          }}
        />
      )}
      {selected && (
        <div id="earn-position-details">
          <PositionRewards
            key={`${deployment.descriptor.deploymentId}:${action.wallet}:${selected.positionId}:${poolFocus}`}
            deployment={deployment}
            positionId={selected.positionId}
            initialPoolId={poolFocus}
          />
        </div>
      )}
    </div>
  );
}

function PositionRewards({
  deployment,
  positionId,
  initialPoolId,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  initialPoolId: `0x${string}` | null;
}) {
  const t = useTranslations("rewards");
  const d = useTranslations("positionDetail");
  const e = useTranslations("earn");
  const p = useTranslations("phaseOne");
  const locale = useAppLocale();
  const action = usePhaseOneAction(deployment, String(positionId));
  const discovered = useQuery({
    queryKey: [
      "phase-one-gauges",
      deployment.descriptor.deploymentId,
      action.wallet,
      String(positionId),
      "reward-pools",
    ],
    enabled: action.ready,
    staleTime: 60_000,
    retry: false,
    queryFn: () =>
      discoverPositionRewardPools({
        publicClient: action.publicClient!,
        deployment,
        positionId,
        account: action.wallet!,
      }),
  });
  const [poolSelection, setPoolId] = useState<`0x${string}` | null>(initialPoolId);
  const poolId =
    poolSelection ??
    discovered.data?.lp[0] ??
    discovered.data?.allocator[0] ??
    deployment.supportedPools.find((pool) => pool.enabled)?.poolId ??
    "0x";
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  type ClaimScope = "global" | "gauge" | "lp-bribe" | "allocator";
  type Scope = "stake" | "selection" | "allocation" | ClaimScope;
  const [scope, setScope] = useState<Scope | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [success, setSuccess] = useState<Scope | null>(null);
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
  const balance = useQuery({
    queryKey: [
      "earn-wallet-balance",
      deployment.descriptor.deploymentId,
      deployment.descriptor.chainId,
      action.wallet,
      deployment.contracts.statics,
    ],
    enabled: action.ready,
    queryFn: () =>
      action.publicClient!.readContract({
        address: deployment.contracts.statics,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [action.wallet!],
      }),
  });
  const prepare = (nextScope: Scope, build: Parameters<typeof action.prepare>[0]) => {
    setScope(nextScope);
    setSuccess(null);
    setProgress(null);
    return action.prepare(async () => {
      const review = await build();
      return {
        ...review,
        details: [t("positionNumber", { id: String(positionId) }), ...review.details],
        execute: async () => {
          setProgress(e("confirmInWallet"));
          await review.execute();
          setProgress(null);
          setSuccess(nextScope);
          if (nextScope === "stake") void balance.refetch();
        },
      };
    });
  };
  const clearReview = () => {
    action.cancel();
    setScope(null);
    setSuccess(null);
    setProgress(null);
  };
  const rewards = useQuery({
    queryKey: protocolQueryKeys.phaseOneRewards(
      deployment.descriptor.deploymentId,
      action.wallet,
      positionId,
      poolId
    ),
    enabled:
      action.ready &&
      poolId !== "0x" &&
      (discovered.isSuccess || discovered.isError || initialPoolId !== null),
    staleTime: 30_000,
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
  const claimAssets = live.data?.staking.claimAssets ?? [];
  const hasAsset = (assets: readonly Address[], asset: Address) =>
    assets.some((entry) => entry.toLowerCase() === asset.toLowerCase());
  const additions = selectedAssets.filter((asset) => !hasAsset(confirmedAssets, asset));
  const removals = confirmedAssets.filter((asset) => !hasAsset(selectedAssets, asset));
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
        kind: "phase-one-checkpoint-schedule",
        label: prerequisite.label,
        amount: `Position #${positionId}`,
        to: deployment.contracts.diamond,
        data: prerequisite.data,
      });
  };
  const stake = (kind: "stake" | "unstake") =>
    prepare("stake", async () => {
      if (!live.data || !action.publicClient || !action.wallet) throw new Error(p("selection"));
      const amount = parseLocalizedUnits(amountInput, 18, locale);
      if (kind === "stake" && (balance.data === undefined || amount > balance.data))
        throw new Error(e("insufficientBalance"));
      if (kind === "unstake" && amount > availableUnstake) throw new Error(e("insufficientStake"));
      const transaction = buildPositionStakingTransaction({
        deployment,
        positionId,
        action: kind === "stake" ? { kind, amount } : { kind, amount, receiver: action.wallet },
      });
      return {
        label: kind === "stake" ? p("stake") : p("unstake"),
        details: [
          `${formatUnits(amount, 18)} STATICS`,
          ...(kind === "stake" ? [e("approvalHelp")] : []),
        ],
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
              setProgress(e("approveInWallet"));
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
          setProgress(e("confirmInWallet"));
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
    prepare("selection", async () => {
      if (!action.publicClient || !live.data) throw new Error(p("selection"));
      if (BigInt(selectedAssets.length) > live.data.staking.maximumRewardAssets)
        throw new Error(
          d("chooseAssets", { count: String(live.data.staking.maximumRewardAssets) })
        );
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
        ],
        execute: async () => {
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
    prepare("allocation", async () => {
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
  const claim = (kind: ClaimScope) =>
    prepare(kind, async () => {
      if (!action.publicClient || !action.wallet) throw new Error(p("selection"));
      const activeLp =
        kind === "gauge" || kind === "lp-bribe"
          ? (
              await action.publicClient.readContract({
                address: deployment.contracts.diamond,
                abi: staticsRangeGaugeAbi,
                functionName: "lpLeg",
                args: [positionId, poolId],
              })
            ).liquidity > 0n
          : false;
      const prerequisites =
        kind === "allocator" || activeLp
          ? await gaugePrerequisites(action.publicClient, deployment)
          : [];
      const latest =
        kind === "global"
          ? await readPositionGlobalRewards({
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
              allocatorSlots: kind === "allocator" ? undefined : [],
              includeProtocolAccrual: kind === "gauge",
            });
      const claims =
        "pendingRewards" in latest
          ? latest.claimAssets.map((asset, index) => ({
              asset,
              slot: index,
              amount: latest.pendingRewards[index],
            }))
          : kind === "allocator"
            ? latest.allocator
            : latest.lp.amounts
                .slice(0, latest.lp.slotCount)
                .map((amount, slot) => ({ amount, slot, asset: latest.lp.assets[slot] }))
                .filter((entry) => (kind === "gauge" ? entry.slot === 0 : entry.slot > 0));
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
                kind: kind === "allocator" ? "claim-allocator" : "claim-lp",
                slots: positive.map((entry) => entry.slot),
                minimumAmounts,
                receiver: action.wallet,
              },
            });
      const label =
        kind === "global"
          ? p("globalClaim")
          : kind === "gauge"
            ? e("reviewGauge")
            : kind === "lp-bribe"
              ? e("reviewLpBribes")
              : e("reviewAllocatorBribes");
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
                : kind === "allocator"
                  ? "phase-one-claim-allocator-rewards"
                  : "phase-one-claim-lp-rewards",
            label,
            amount: positive.map((entry) => describeAmount(entry.asset, entry.amount)).join(", "),
            to: transaction.target,
            data: transaction.calldata,
          });
        },
      };
    });
  const disabled = !action.ready || action.busy || !live.data;
  const stakeBalance = live.data?.staking.stakedBalance;
  const lockedStake = live.data?.gauges.allocations.lockedStake ?? 0n;
  const availableUnstake =
    stakeBalance === undefined ? 0n : stakeBalance > lockedStake ? stakeBalance - lockedStake : 0n;
  const availableAmount =
    mode === "stake" ? balance.data : live.data ? availableUnstake : undefined;
  let amount: bigint | null = null;
  try {
    amount = parseLocalizedUnits(amountInput, 18, locale);
  } catch {
    /* Inline validation below. */
  }
  const amountError =
    amountInput.trim() &&
    (amount === null
      ? e("invalidAmount")
      : amount <= 0n
        ? e("positiveAmount")
        : availableAmount !== undefined && amount > availableAmount
          ? mode === "stake"
            ? e("insufficientBalance")
            : e("insufficientStake")
          : null);
  const displayBalance = (value: bigint | undefined) =>
    value === undefined
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
          Number(formatUnits(value, 18))
        );
  const unallocated =
    stakeBalance === undefined
      ? undefined
      : stakeBalance > (live.data?.gauges.allocations.totalAllocated ?? 0n)
        ? stakeBalance - live.data!.gauges.allocations.totalAllocated
        : 0n;
  const reviewFor = (target: Scope) => (
    <div className="earn-review">
      {scope === target && <ActionReview action={action} />}
      {scope === target && action.busy && <p role="status">{progress ?? e("preparing")}</p>}
      {success === target && (
        <p role="status" className="earn-success">
          {e("confirmed")}
        </p>
      )}
    </div>
  );
  const rewardGroups = [
    {
      kind: "global" as const,
      title: e("staking"),
      help: e("stakingHelp"),
      amounts: claimAssets.map((asset, index) => ({
        asset,
        amount: live.data?.staking.pendingRewards[index] ?? 0n,
      })),
      loaded: Boolean(live.data),
      failed: live.isError,
      button: e("claimStaking"),
    },
    {
      kind: "gauge" as const,
      title: e("liquidity"),
      help: e("liquidityHelp"),
      amounts:
        rewards.data?.lp.amounts
          .slice(0, Math.min(1, rewards.data.lp.slotCount))
          .map((amount, slot) => ({ asset: rewards.data!.lp.assets[slot], amount })) ?? [],
      loaded: Boolean(rewards.data),
      failed: rewards.isError,
      button: e("claimLiquidity"),
    },
    {
      kind: "lp-bribe" as const,
      title: e("lpBribes"),
      help: e("lpBribesHelp"),
      amounts:
        rewards.data?.lp.amounts
          .slice(1, rewards.data.lp.slotCount)
          .map((amount, index) => ({ asset: rewards.data!.lp.assets[index + 1], amount })) ?? [],
      loaded: Boolean(rewards.data),
      failed: rewards.isError,
      button: e("claimLpBribes"),
    },
    {
      kind: "allocator" as const,
      title: e("allocatorBribes"),
      help: e("allocatorBribesHelp"),
      amounts: rewards.data?.allocator ?? [],
      loaded: Boolean(rewards.data),
      failed: rewards.isError,
      button: e("claimAllocation"),
    },
  ];
  const selectedPool = deployment.supportedPools.find((pool) => pool.poolId === poolId);
  const rewardPoolIds = [
    ...new Map(
      [
        ...deployment.supportedPools.filter((pool) => pool.enabled).map((pool) => pool.poolId),
        ...(discovered.data?.lp ?? []),
        ...(discovered.data?.allocator ?? []),
        ...(poolId !== "0x" ? [poolId] : []),
      ].map((id) => [id.toLowerCase(), id])
    ).values(),
  ];
  const poolPicker = (
    <>
      <label className="basket-field earn-pool-select">
        {p("pool")}
        <select
          value={poolId}
          disabled={action.busy}
          onChange={(event) => {
            if (
              scope === "gauge" ||
              scope === "lp-bribe" ||
              scope === "allocator" ||
              scope === "allocation"
            )
              clearReview();
            setAllocationInput(null);
            setPoolId(event.target.value as `0x${string}`);
          }}
        >
          {rewardPoolIds.map((id) => {
            const pool = deployment.supportedPools.find(
              (entry) => entry.poolId.toLowerCase() === id.toLowerCase()
            );
            return (
              <option key={id} value={id}>
                {pool ? `${pool.token0.symbol}/${pool.token1.symbol}` : id}
              </option>
            );
          })}
        </select>
      </label>
      <p className="earn-muted earn-pool-help">{e("poolHelp")}</p>
    </>
  );
  const renderRewardGroup = (group: (typeof rewardGroups)[number], bribe = false) => {
    const positive = group.amounts.filter((entry) => entry.amount > 0n);
    return (
      <article key={group.kind} className="earn-reward-group" aria-label={group.title}>
        {group.kind === "gauge" && poolPicker}
        <div className="earn-reward-heading">
          {bribe ? <h4>{group.title}</h4> : <h3>{group.title}</h3>}
          {positive.length > 0 && !(scope === group.kind && action.review) && (
            <button
              className="ui-button ui-button--secondary ui-button--sm"
              type="button"
              disabled={disabled || !group.loaded}
              onClick={() => void claim(group.kind)}
            >
              {group.button}
            </button>
          )}
        </div>
        <p className="earn-muted">{group.help}</p>
        {positive.length ? (
          positive.map((entry) => (
            <p key={entry.asset} className="earn-reward-value is-numeric">
              {describeAmount(entry.asset, entry.amount)}
            </p>
          ))
        ) : (
          <p className="earn-reward-empty">
            {group.failed
              ? e("rewardsUnavailable")
              : group.loaded
                ? e("noRewards")
                : e("loadingRewards")}
          </p>
        )}
        {reviewFor(group.kind)}
      </article>
    );
  };
  return (
    <>
      <div className="earn-main">
        <section className="ui-card earn-stake-card" aria-label={p("stake")}>
          <div className="earn-card-heading">
            <div>
              <p className="dapp-section-label">{e("staking")}</p>
              <h2>{p("stake")}</h2>
            </div>
            <h3 className="earn-position-badge">
              {t("positionNumber", { id: String(positionId) })}
            </h3>
          </div>
          <div className="earn-balances">
            <div>
              <span>{e("walletBalance")}</span>
              <strong className="is-numeric">
                {displayBalance(balance.data)} <small>STATICS</small>
              </strong>
            </div>
            <div>
              <span>{p("staked")}</span>
              <strong className="is-numeric">
                {displayBalance(stakeBalance)} <small>STATICS</small>
              </strong>
            </div>
          </div>
          {live.isError && (
            <p className="dapp-inline-error" role="alert">
              {live.error.message}
            </p>
          )}
          {balance.isError && (
            <p className="dapp-inline-error" role="alert">
              {e("balanceUnavailable")}
            </p>
          )}
          {scope === "stake" && action.review ? (
            reviewFor("stake")
          ) : (
            <>
              <div className="earn-mode" role="group" aria-label={e("stakeAction")}>
                {(["stake", "unstake"] as const).map((kind) => (
                  <button
                    className="ui-button"
                    type="button"
                    key={kind}
                    aria-pressed={mode === kind}
                    disabled={action.busy}
                    onClick={() => {
                      clearReview();
                      setMode(kind);
                      setAmountInput("");
                    }}
                  >
                    {kind === "stake" ? e("stake") : e("unstake")}
                  </button>
                ))}
              </div>
              <label className="basket-field">
                {p("amount")}
                <div className="earn-amount-field">
                  <input
                    aria-label={p("amount")}
                    value={amountInput}
                    placeholder="0"
                    disabled={action.busy}
                    aria-invalid={Boolean(amountError)}
                    aria-describedby="earn-amount-help"
                    onChange={(event) => {
                      clearReview();
                      setAmountInput(event.target.value);
                    }}
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    disabled={disabled || availableAmount === undefined || availableAmount === 0n}
                    onClick={() => {
                      clearReview();
                      setAmountInput(formatUnits(availableAmount!, 18));
                    }}
                  >
                    {e("max")}
                  </button>
                </div>
              </label>
              <p id="earn-amount-help" className={amountError ? "dapp-inline-error" : "earn-muted"}>
                {amountError ||
                  (mode === "unstake"
                    ? e("unstakeAvailable", {
                        amount: displayBalance(live.data ? availableUnstake : undefined),
                      })
                    : e("stakeHelp"))}
              </p>
              <button
                className="ui-button ui-button--primary ui-button--block"
                type="button"
                disabled={
                  disabled ||
                  amount === null ||
                  amount <= 0n ||
                  Boolean(amountError) ||
                  availableAmount === undefined
                }
                onClick={() => void stake(mode)}
              >
                {scope === "stake" && action.busy
                  ? e("preparing")
                  : mode === "stake"
                    ? p("reviewStake")
                    : p("reviewUnstake")}
              </button>
              {reviewFor("stake")}
            </>
          )}
          <div className="earn-asset-selection">
            <h3>{e("rewardAssets")}</h3>
            <p className="earn-muted">{e("assetHelp")}</p>
            <div className="earn-assets" role="group" aria-label={e("rewardAssets")}>
              {tokens.map((token) => {
                const checked = selectedAssets.some(
                  (asset) => asset.toLowerCase() === token.address.toLowerCase()
                );
                return (
                  <button
                    key={token.address}
                    type="button"
                    className="ui-button ui-button--secondary"
                    aria-pressed={checked}
                    disabled={
                      disabled ||
                      (!checked &&
                        BigInt(selectedAssets.length) >=
                          (live.data?.staking.maximumRewardAssets ?? 0n))
                    }
                    onClick={() => {
                      clearReview();
                      setAssetDraft(
                        checked
                          ? selectedAssets.filter(
                              (entry) => entry.toLowerCase() !== token.address.toLowerCase()
                            )
                          : [...selectedAssets, token.address]
                      );
                    }}
                  >
                    <span aria-hidden="true" className="earn-asset-check">
                      {checked ? "✓" : "+"}
                    </span>
                    {token.symbol}
                  </button>
                );
              })}
            </div>
            {additions.length + removals.length > 0 &&
              !(scope === "selection" && action.review) && (
                <button
                  className="ui-button ui-button--secondary ui-button--block"
                  type="button"
                  disabled={disabled}
                  onClick={() => void saveSelection()}
                >
                  {e("saveAssets")}
                </button>
              )}
            {reviewFor("selection")}
          </div>
        </section>
        <section className="ui-card earn-rewards-card" aria-label={e("yourRewards")}>
          <div className="earn-card-heading">
            <div>
              <p className="dapp-section-label">{e("readyToClaim")}</p>
              <h2>{e("yourRewards")}</h2>
            </div>
          </div>
          <p className="earn-muted">{e("rewardsHelp")}</p>
          {rewards.isError && (
            <p className="dapp-inline-error" role="alert">
              {rewards.error.message}
            </p>
          )}
          <div className="earn-reward-groups">
            {rewardGroups.slice(0, 2).map((group) => renderRewardGroup(group))}
            <section className="earn-reward-group" aria-label={e("allocation")}>
              <h3>{e("allocation")}</h3>
              <p className="earn-muted">{e("allocationRewardsHelp")}</p>
              {rewardGroups.slice(2).map((group) => renderRewardGroup(group, true))}
            </section>
          </div>
        </section>
      </div>
      <details className="ui-card earn-allocation">
        <summary>
          <span>{e("allocateTitle")}</span>
          <span className="earn-muted">{e("optional")}</span>
        </summary>
        <p className="earn-muted">{e("allocationHelp")}</p>
        <div className="earn-allocation-content">
          <div>
            <p className="earn-muted">{e("unallocated")}</p>
            <strong className="is-numeric">{displayBalance(unallocated)} STATICS</strong>
            <p className="earn-muted">
              {e("allocationPool", {
                pool: selectedPool
                  ? `${selectedPool.token0.symbol}/${selectedPool.token1.symbol}`
                  : "—",
              })}
            </p>
            {live.data?.gauges.coolingDown && (
              <p className="earn-muted">
                {p("cooldown")}{" "}
                {e("cooldownUntil", {
                  time: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(live.data.gauges.allocations.nextAllocationAt * 1000)),
                })}
              </p>
            )}
          </div>
          <div>
            {scope === "allocation" && action.review ? (
              reviewFor("allocation")
            ) : (
              <>
                <label className="basket-field">
                  {p("allocationAmount")}
                  <input
                    value={allocationValue}
                    inputMode="decimal"
                    disabled={action.busy}
                    onChange={(event) => {
                      clearReview();
                      setAllocationInput(event.target.value);
                    }}
                  />
                </label>
                <button
                  className="ui-button ui-button--secondary ui-button--block"
                  type="button"
                  disabled={disabled || poolId === "0x" || allocationInput === null}
                  onClick={() => void saveAllocation()}
                >
                  {p("saveAllocation")}
                </button>
                {reviewFor("allocation")}
              </>
            )}
          </div>
        </div>
      </details>
    </>
  );
}
