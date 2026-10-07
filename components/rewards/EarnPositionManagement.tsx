"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, formatUnits, type Address } from "viem";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { ReviewDrawer } from "./ReviewDrawer";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  readPositionStakingState,
  buildPositionStakingTransaction,
  buildStaticsStakeApproval,
} from "@/lib/phase-one/staking";
import {
  readPositionGaugeState,
  buildGaugeAllocationTransaction,
  validateGaugeAllocationChange,
  replacePoolAllocation,
} from "@/lib/phase-one/gauges";
import { gaugePrerequisites } from "@/lib/phase-one/reward-actions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { staticsAbi } from "@statics-protocol/sdk/phase-one";
import { rewardPoolName } from "@/lib/rewards/earn";
import { useAppLocale } from "@/i18n/client";
export function EarnPositionManagement({
  deployment,
  positionId,
  initialPoolId,
  feature,
  onPoolChange,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  initialPoolId: `0x${string}` | null;
  feature: "staking" | "allocations";
  onPoolChange?: (poolId: `0x${string}`) => void;
}) {
  const u = useTranslations("earnUx");
  const t = useTranslations("rewards");
  const d = useTranslations("positionDetail");
  const e = useTranslations("earn");
  const p = useTranslations("phaseOne");
  const locale = useAppLocale();
  const action = usePhaseOneAction(deployment, `${feature}:${positionId}:${initialPoolId}`);
  const [poolSelection, setPoolId] = useState<`0x${string}` | null>(initialPoolId);
  const poolId =
    poolSelection ?? deployment.supportedPools.find((pool) => pool.enabled)?.poolId ?? "0x";
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  type Scope = "stake" | "selection" | "allocation";
  const [scope, setScope] = useState<Scope | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [success, setSuccess] = useState<Scope | null>(null);
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState("");
  const [allocationInput, setAllocationInput] = useState<string | null>(null);
  const [assetDraft, setAssetDraft] = useState<readonly Address[] | null>(null);
  const staking = useQuery({
    queryKey: [
      ...protocolQueryKeys.phaseOnePosition(
        deployment.descriptor.deploymentId,
        action.wallet,
        positionId
      ),
      `${feature}-management`,
    ],
    enabled: action.ready,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const input = {
        publicClient: action.publicClient!,
        deployment,
        positionId,
        account: action.wallet!,
      };
      if (feature === "staking") return readPositionStakingState(input);
      const position = await action.publicClient!.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "stakePosition",
        args: [positionId],
        account: action.wallet!,
      });
      return {
        positionId,
        stakedBalance: position.stakedBalance,
        rewardMultiplierBps: position.rewardMultiplierBps,
        selectedAssets: [],
        claimAssets: [],
        pendingRewards: [],
        maximumRewardAssets: 0n,
      };
    },
  });
  const allocationState = useQuery({
    queryKey: [
      ...protocolQueryKeys.phaseOneGauges(
        deployment.descriptor.deploymentId,
        action.wallet,
        positionId
      ),
      "allocation-management",
    ],
    enabled: action.ready && (feature === "allocations" || mode === "unstake"),
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const block = await action.publicClient!.getBlock({ blockTag: "pending" });
      return readPositionGaugeState({
        publicClient: action.publicClient!,
        deployment,
        positionId,
        account: action.wallet!,
        now: Number(block.timestamp),
      });
    },
  });
  const live = {
    data: staking.data ? { staking: staking.data, gauges: allocationState.data } : undefined,
    isError: staking.isError || allocationState.isError,
    error: staking.error ?? allocationState.error,
  };
  const balance = useQuery({
    queryKey: [
      "earn-wallet-balance",
      deployment.descriptor.deploymentId,
      deployment.descriptor.chainId,
      action.wallet,
      deployment.contracts.statics,
    ],
    enabled: action.ready && feature === "staking",
    staleTime: 30_000,
    retry: false,
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
  const knownTokens = deployment.supportedPools
    .flatMap((pool) => [pool.token0, pool.token1])
    .map((token) => ({ ...token, metadataAvailable: true }));
  if (
    !knownTokens.some(
      (token) => token.address.toLowerCase() === deployment.contracts.statics.toLowerCase()
    )
  )
    knownTokens.push({
      address: deployment.contracts.statics,
      symbol: "STATICS",
      decimals: 18,
      name: "STATICS",
      metadataSource: "reviewed-manifest",
      metadataAvailable: true,
    });
  const tokens = [
    ...new Map(
      [
        ...(live.data?.staking.selectedAssets ?? []).map((address) => ({
          address,
          symbol: `${address.slice(0, 8)}…${address.slice(-6)}`,
          decimals: 0,
          metadataAvailable: false,
        })),
        ...knownTokens,
      ].map((token) => [token.address.toLowerCase(), token])
    ).values(),
  ];
  const describeAmount = (asset: Address, amount: bigint) => {
    const token = tokens.find((entry) => entry.address.toLowerCase() === asset.toLowerCase());
    return token?.metadataAvailable
      ? `${formatUnits(amount, token.decimals)} ${token.symbol}`
      : `${amount} units (${asset})`;
  };
  const selectedAssets = assetDraft ?? live.data?.staking.selectedAssets ?? [];
  const confirmedAssets = live.data?.staking.selectedAssets ?? [];
  const hasAsset = (assets: readonly Address[], asset: Address) =>
    assets.some((entry) => entry.toLowerCase() === asset.toLowerCase());
  const additions = selectedAssets.filter((asset) => !hasAsset(confirmedAssets, asset));
  const removals = confirmedAssets.filter((asset) => !hasAsset(selectedAssets, asset));
  const allocation =
    live.data?.gauges?.allocations.active.find(
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
        action.publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "stakePosition",
          args: [positionId],
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
              `${rewardPoolName(deployment, entry.poolId)}: ${formatUnits(entry.amount, 18)} STATICS`
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
  const disabled =
    !action.ready ||
    action.busy ||
    !live.data ||
    (feature === "allocations" && !allocationState.data) ||
    (mode === "unstake" && !allocationState.data);
  const stakeBalance = live.data?.staking.stakedBalance;
  const lockedStake = live.data?.gauges?.allocations.lockedStake ?? 0n;
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
    stakeBalance === undefined || !allocationState.data
      ? undefined
      : stakeBalance > allocationState.data.allocations.totalAllocated
        ? stakeBalance - allocationState.data.allocations.totalAllocated
        : 0n;
  const reviewFor = (target: Scope) => (
    <div className="earn-review">
      {scope === target && (action.review || action.busy || action.error) && (
        <ReviewDrawer
          title={action.review?.label ?? e("preparing")}
          busy={action.busy}
          onClose={clearReview}
        >
          <ActionReview action={action} />
          {action.busy && <p role="status">{progress ?? e("preparing")}</p>}
        </ReviewDrawer>
      )}
      {success === target && (
        <p role="status" className="earn-success">
          {e("confirmed")}
        </p>
      )}
    </div>
  );
  const selectedPool = deployment.supportedPools.find((pool) => pool.poolId === poolId);
  const rewardPoolIds = [
    ...new Map(
      [
        ...deployment.supportedPools.filter((pool) => pool.enabled).map((pool) => pool.poolId),
        ...(allocationState.data?.allocations.active.map((entry) => entry.poolId) ?? []),
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
            clearReview();
            setAllocationInput(null);
            setPoolId(event.target.value as `0x${string}`);
            onPoolChange?.(event.target.value as `0x${string}`);
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

  return (
    <>
      {feature === "staking" && (
        <div>
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
                {live.error?.message}
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
                <p
                  id="earn-amount-help"
                  className={amountError ? "dapp-inline-error" : "earn-muted"}
                >
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
                      title={token.address}
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
        </div>
      )}
      {feature === "allocations" && (
        <section className="ui-card earn-allocation">
          <h2>{e("allocateTitle")}</h2>
          {poolPicker}
          <ul>
            {allocationState.data?.allocations.active.map((entry) => (
              <li key={entry.poolId}>
                {rewardPoolName(deployment, entry.poolId)}: {formatUnits(entry.amount, 18)} STATICS
              </li>
            ))}
          </ul>
          <p className="earn-muted">
            {u("allocationLimits", {
              count: String(allocationState.data?.maximumAllocations ?? "—"),
              amount: displayBalance(stakeBalance),
            })}
          </p>
          {live.isError && (
            <p className="dapp-inline-error" role="alert">
              {live.error?.message}
            </p>
          )}

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
              {live.data?.gauges?.coolingDown && (
                <p className="earn-muted">
                  {p("cooldown")}{" "}
                  {e("cooldownUntil", {
                    time: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(live.data!.gauges!.allocations.nextAllocationAt * 1000)),
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
        </section>
      )}
    </>
  );
}
