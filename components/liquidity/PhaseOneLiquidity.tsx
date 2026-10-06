"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, formatUnits, parseEventLogs, type Hex } from "viem";
import { staticsAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { usePhaseOnePositions } from "@/hooks/usePhaseOnePositions";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { configuredIndexerUrlForDeployment, loadWalletV4PositionIds } from "@/lib/indexer/statics";
import { loadIndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import {
  buildCreatePositionNftTransaction,
  buildAttachPublicLiquidityTransactions,
  buildProvidePublicLiquidityTransaction,
  buildPublicLiquidityChangeTransaction,
  inspectAttachableV4Position,
  quotePublicLiquidity,
  quoteWithdrawalAmounts,
  readPublicManagedLiquidityPosition,
  readPublicLiquidityFees,
  planPublicLiquidityApprovals,
  usableTickBounds,
  publicLiquidityDeadline,
  type PublicLiquidityChange,
} from "@/lib/phase-one/liquidity";
import { buildGaugeRewardResolution } from "@/lib/phase-one/gauges";
import { gaugePrerequisites } from "@/lib/phase-one/reward-actions";
import { listedPublicPool, readPublicPoolState } from "@/lib/phase-one/pools";
import { priceToAlignedTick, tickPrice, fractionalRewardAmount } from "@/lib/phase-one/prices";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { useAppLocale } from "@/i18n/client";

type Mode = "provide" | "attach" | "increase" | "decrease" | "collect" | "rebalance" | "exit";

export function PhaseOneLiquidity({
  deployment,
  initialPositionId = null,
}: {
  deployment: PhaseOneDeployment;
  initialPositionId?: bigint | null;
}) {
  const t = useTranslations("phaseOne");
  const action = usePhaseOneAction(deployment);
  const positions = usePhaseOnePositions(deployment.descriptor.deploymentId, action.wallet);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const [poolId, setPoolId] = useState(
    deployment.supportedPools.find((pool) => pool.enabled)?.poolId ?? ""
  );
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
  const ownedIds = [
    ...new Set([
      ...items.map((item) => String(item.positionId)),
      ...(createdId !== null ? [String(createdId)] : []),
    ]),
  ];
  const resolved =
    selectedId && ownedIds.includes(selectedId)
      ? selectedId
      : ownInitial
        ? String(ownInitial.positionId)
        : (ownedIds[0] ?? "");
  const create = () =>
    action.prepare(async () => {
      const transaction = await buildCreatePositionNftTransaction({
        publicClient: action.publicClient!,
        deployment,
        receiver: action.wallet!,
      });
      return {
        label: t("newPosition"),
        details: [`${formatUnits(transaction.value, 18)} ETH`],
        execute: async () => {
          await action.send({
            kind: "phase-one-create-position",
            label: t("newPosition"),
            amount: `${formatUnits(transaction.value, 18)} ETH`,
            to: transaction.target,
            data: transaction.calldata,
            value: transaction.value,
            verifyConfirmation: async (receipt) => {
              const event = parseEventLogs({
                abi: staticsAbi,
                logs: receipt.logs,
                eventName: "PositionCreated",
              }).find(
                (entry) =>
                  entry.address.toLowerCase() === deployment.contracts.diamond.toLowerCase() &&
                  entry.args.owner.toLowerCase() === action.wallet!.toLowerCase()
              );
              if (event) {
                setCreatedId(event.args.positionId);
                setSelectedId(String(event.args.positionId));
              }
            },
          });
        },
      };
    });
  return (
    <div className="remaining-page">
      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("liquidity")}</p>
            <h2>{t("liquidityTitle")}</h2>
            <p>{t("liquidityHelp")}</p>
          </div>
          <button
            className="dollar-submit"
            type="button"
            disabled={!action.ready || action.busy}
            onClick={() => void create()}
          >
            {t("newPosition")}
          </button>
        </div>
        <ActionReview action={action} />
        {positions.isError && <p role="alert">{positions.error.message}</p>}
        <label className="basket-field">
          {t("pool")}
          <select
            value={poolId}
            disabled={action.busy}
            onChange={(event) => setPoolId(event.target.value as Hex)}
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
      </section>
      <div className="remaining-layout liquidity-layout">
        <section className="remaining-list">
          <h3>{t("yourPositions")}</h3>
          {ownedIds.length === 0 && <p>{t("empty")}</p>}
          {ownedIds.map((id) => (
            <button
              key={id}
              type="button"
              className={`lp-position${resolved === id ? " is-selected" : ""}`}
              onClick={() => setSelectedId(id)}
            >
              {t("positionNumber", { id })}
            </button>
          ))}
          {positions.hasNextPage && (
            <button
              type="button"
              disabled={positions.isFetchingNextPage}
              onClick={() => void positions.fetchNextPage()}
            >
              {t("loadMore")}
            </button>
          )}
        </section>
        <section className="remaining-workspace">
          {resolved && poolId && (
            <ManagedLiquidity
              key={`${deployment.descriptor.deploymentId}:${action.wallet}:${resolved}:${poolId}`}
              deployment={deployment}
              positionId={BigInt(resolved)}
              poolId={poolId as Hex}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ManagedLiquidity({
  deployment,
  positionId,
  poolId,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: Hex;
}) {
  const t = useTranslations("phaseOne");
  const locale = useAppLocale();
  const action = usePhaseOneAction(deployment, `${positionId}:${poolId}`);
  const queryClient = useQueryClient();
  const pool = listedPublicPool(
    deployment.supportedPools.find((entry) => entry.poolId === poolId)!
  );
  const [mode, setMode] = useState<Mode>("provide");
  const [fullRange, setFullRange] = useState(true);
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [minimum0, setMinimum0] = useState("");
  const [minimum1, setMinimum1] = useState("");
  const [percentage, setPercentage] = useState("50");
  const [slippage, setSlippage] = useState("0.5");
  const [lpId, setLpId] = useState("");
  const state = useQuery({
    queryKey: protocolQueryKeys.phaseOnePool(deployment.descriptor.deploymentId, poolId),
    enabled: action.ready,
    queryFn: () => readPublicPoolState(action.publicClient!, deployment, pool),
  });
  const managed = useQuery({
    queryKey: protocolQueryKeys.phaseOneLiquidity(
      deployment.descriptor.deploymentId,
      action.wallet,
      positionId,
      poolId
    ),
    enabled: action.ready,
    queryFn: () =>
      readPublicManagedLiquidityPosition({
        publicClient: action.publicClient!,
        deployment,
        positionId,
        poolId,
      }),
  });
  const lpIds = useQuery({
    queryKey: ["phase-one-wallet-lp", deployment.descriptor.deploymentId, action.wallet],
    enabled: action.ready && mode === "attach",
    retry: false,
    queryFn: () =>
      loadWalletV4PositionIds(
        action.wallet!,
        configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId)
      ),
  });
  const active = (managed.data?.leg.liquidity ?? 0n) > 0n;
  const selectedMode = mode === "provide" && active ? "increase" : mode;
  const deposits =
    selectedMode === "provide" || selectedMode === "increase" || selectedMode === "rebalance";
  const withdrawals =
    selectedMode === "decrease" ||
    selectedMode === "exit" ||
    selectedMode === "rebalance" ||
    selectedMode === "collect";
  const tokenAmount = (value: bigint, index: 0 | 1) =>
    `${formatUnits(value, index === 0 ? pool.token0.decimals : pool.token1.decimals)} ${index === 0 ? pool.token0.symbol : pool.token1.symbol}`;
  const approve = async (maximum0: bigint, maximum1: bigint) => {
    const key = [
      "phase-one-liquidity-allowance",
      deployment.descriptor.deploymentId,
      deployment.descriptor.chainId,
      action.wallet,
      pool.token0.address,
      pool.token1.address,
      deployment.contracts.diamond,
    ] as const;
    const read = async () =>
      Promise.all(
        [pool.token0, pool.token1].map((token) =>
          action.publicClient!.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [action.wallet!, deployment.contracts.diamond],
          })
        )
      );
    const [allowance0, allowance1] = await queryClient.fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: read,
    });
    const approvals = planPublicLiquidityApprovals({
      deployment,
      pool,
      amount0Maximum: maximum0,
      amount1Maximum: maximum1,
      allowance0,
      allowance1,
    });
    for (const approval of approvals.filter((entry) => entry.needed))
      await action.send({
        kind: "phase-one-approve-token",
        label: t("approveToken", {
          symbol: approval.token === pool.token0.address ? pool.token0.symbol : pool.token1.symbol,
        }),
        amount: tokenAmount(approval.required, approval.token === pool.token0.address ? 0 : 1),
        to: approval.target,
        data: approval.calldata,
      });
    if (approvals.some((entry) => entry.needed))
      await queryClient.fetchQuery({ queryKey: key, staleTime: 0, queryFn: read });
  };
  const prepare = () =>
    action.prepare(async () => {
      if (!action.publicClient || !action.wallet) throw new Error(t("connect"));
      if (selectedMode === "attach") {
        const id = lpId || String(lpIds.data?.[0] ?? "");
        if (!id) throw new Error(t("chooseLp"));
        const inspected = await inspectAttachableV4Position({
          publicClient: action.publicClient,
          deployment,
          pool,
          owner: action.wallet,
          tokenId: BigInt(id),
        });
        const transactions = buildAttachPublicLiquidityTransactions({
          deployment,
          pool,
          positionId,
          position: inspected,
        });
        const prerequisites = await gaugePrerequisites(action.publicClient, deployment);
        return {
          label: t("attach"),
          details: [
            t("lpNumber", { id }),
            t("attachmentHelp"),
            ...prerequisites.map((entry) => entry.label),
          ],
          execute: async () => {
            for (const prerequisite of prerequisites)
              await action.send({
                kind: "phase-one-checkpoint-schedule",
                label: prerequisite.label,
                amount: t("positionNumber", { id: String(positionId) }),
                to: deployment.contracts.diamond,
                data: prerequisite.data,
              });
            for (const transaction of transactions)
              await action.send({
                kind:
                  transaction.kind === "approve" ? "approve-lp-nft" : "phase-one-attach-liquidity",
                label: transaction.kind === "approve" ? t("approveLp") : t("attach"),
                amount: t("lpNumber", { id }),
                to: transaction.target,
                data: transaction.calldata,
              });
          },
        };
      }
      const tolerance =
        selectedMode === "collect" ? 0 : Number(parseLocalizedUnits(slippage, 2, locale));
      if (tolerance < 0 || tolerance > 5000) throw new Error(t("slippageError"));
      const [market, latestManaged] = await Promise.all([
        readPublicPoolState(action.publicClient, deployment, pool),
        readPublicManagedLiquidityPosition({
          publicClient: action.publicClient,
          deployment,
          positionId,
          poolId,
        }),
      ]);
      const [tickLower, tickUpper] =
        !deposits || selectedMode === "increase"
          ? [latestManaged.leg.tickLower, latestManaged.leg.tickUpper]
          : fullRange
            ? usableTickBounds(pool.poolKey.tickSpacing)
            : [
                priceToAlignedTick(
                  parseLocalizedUnits(lower, 36, locale),
                  pool.token0.decimals,
                  pool.token1.decimals,
                  pool.poolKey.tickSpacing,
                  "lower"
                ),
                priceToAlignedTick(
                  parseLocalizedUnits(upper, 36, locale),
                  pool.token0.decimals,
                  pool.token1.decimals,
                  pool.poolKey.tickSpacing,
                  "upper"
                ),
              ];
      const share =
        selectedMode === "decrease" ? parseLocalizedUnits(percentage, 2, locale) : 10000n;
      if (selectedMode === "decrease" && (share <= 0n || share >= 10000n))
        throw new Error(t("percentageError"));
      const delta =
        selectedMode === "decrease"
          ? (latestManaged.leg.liquidity * share) / 10000n
          : latestManaged.leg.liquidity;
      if ((selectedMode === "decrease" || selectedMode === "exit") && delta <= 0n)
        throw new Error(t("noLiquidity"));
      const estimated =
        selectedMode === "collect"
          ? await readPublicLiquidityFees({
              publicClient: action.publicClient,
              deployment,
              poolId,
              ...latestManaged.leg,
            })
          : latestManaged.leg.liquidity > 0n && withdrawals
            ? quoteWithdrawalAmounts(
                market.sqrtPriceX96,
                latestManaged.leg.tickLower,
                latestManaged.leg.tickUpper,
                delta
              )
            : { amount0: 0n, amount1: 0n };
      const min0 =
        selectedMode === "collect"
          ? estimated.amount0
          : minimum0
            ? parseLocalizedUnits(minimum0, pool.token0.decimals, locale)
            : (estimated.amount0 * BigInt(10000 - tolerance)) / 10000n;
      const min1 =
        selectedMode === "collect"
          ? estimated.amount1
          : minimum1
            ? parseLocalizedUnits(minimum1, pool.token1.decimals, locale)
            : (estimated.amount1 * BigInt(10000 - tolerance)) / 10000n;
      const maximum0 = deposits
        ? parseLocalizedUnits(amount0 || "0", pool.token0.decimals, locale)
        : 0n;
      const maximum1 = deposits
        ? parseLocalizedUnits(amount1 || "0", pool.token1.decimals, locale)
        : 0n;
      const quote = deposits
        ? {
            ...quotePublicLiquidity({
              sqrtPriceX96: market.sqrtPriceX96,
              currentTick: market.tick,
              tickSpacing: pool.poolKey.tickSpacing,
              tickLower,
              tickUpper,
              amount0Maximum: maximum0 + (selectedMode === "rebalance" ? min0 : 0n),
              amount1Maximum: maximum1 + (selectedMode === "rebalance" ? min1 : 0n),
              toleranceBps: tolerance,
            }),
            // Rebalance reuses withdrawn principal; these limits cap additional wallet funds.
            maximumAmount0: maximum0,
            maximumAmount1: maximum1,
          }
        : null;
      const prerequisites =
        selectedMode === "collect" ? [] : await gaugePrerequisites(action.publicClient, deployment);
      const change: PublicLiquidityChange | null =
        selectedMode === "provide"
          ? null
          : selectedMode === "increase"
            ? {
                kind: "increase",
                liquidity: quote!.liquidity,
                amount0Maximum: quote!.maximumAmount0,
                amount1Maximum: quote!.maximumAmount1,
              }
            : selectedMode === "rebalance"
              ? {
                  kind: "rebalance",
                  tickLower,
                  tickUpper,
                  liquidity: quote!.liquidity,
                  amount0Maximum: quote!.maximumAmount0,
                  amount1Maximum: quote!.maximumAmount1,
                  amount0Minimum: min0,
                  amount1Minimum: min1,
                }
              : selectedMode === "decrease"
                ? { kind: "decrease", liquidity: delta, amount0Minimum: min0, amount1Minimum: min1 }
                : { kind: selectedMode, amount0Minimum: min0, amount1Minimum: min1 };
      return {
        label: t(selectedMode),
        details: [
          t("positionNumber", { id: String(positionId) }),
          `${pool.token0.symbol}/${pool.token1.symbol}`,
          ...(quote
            ? [
                `${t("maximumDebit")}: ${tokenAmount(quote.maximumAmount0, 0)} + ${tokenAmount(quote.maximumAmount1, 1)}`,
                `${t("range")}: ${tickPrice(tickLower, pool.token0.decimals, pool.token1.decimals)} – ${tickPrice(tickUpper, pool.token0.decimals, pool.token1.decimals)} ${pool.token1.symbol}/${pool.token0.symbol}`,
              ]
            : []),
          ...(withdrawals
            ? [
                `${t(selectedMode === "collect" ? "feesToCollect" : "minimum")}: ${tokenAmount(min0, 0)} + ${tokenAmount(min1, 1)}`,
              ]
            : []),
          ...(selectedMode === "collect" ? [] : [`${t("slippage")}: ${slippage}%`]),
          ...prerequisites.map((entry) => entry.label),
          ...(selectedMode === "exit" ? [t("exitHelp")] : []),
        ],
        execute: async () => {
          if (quote && (quote.maximumAmount0 > 0n || quote.maximumAmount1 > 0n))
            await approve(quote.maximumAmount0, quote.maximumAmount1);
          for (const prerequisite of prerequisites)
            await action.send({
              kind: "phase-one-checkpoint-schedule",
              label: prerequisite.label,
              amount: t("positionNumber", { id: String(positionId) }),
              to: deployment.contracts.diamond,
              data: prerequisite.data,
            });
          const expiry = await publicLiquidityDeadline(action.publicClient!);
          const transaction = change
            ? buildPublicLiquidityChangeTransaction({
                deployment,
                pool,
                positionId,
                deadline: expiry,
                change,
              })
            : buildProvidePublicLiquidityTransaction({
                deployment,
                pool,
                positionId,
                quote: quote!,
                deadline: expiry,
              });
          const kind =
            selectedMode === "provide"
              ? "phase-one-provide-liquidity"
              : selectedMode === "increase"
                ? "phase-one-increase-liquidity"
                : selectedMode === "decrease"
                  ? "phase-one-decrease-liquidity"
                  : selectedMode === "rebalance"
                    ? "phase-one-rebalance-liquidity"
                    : selectedMode === "collect"
                      ? "phase-one-collect-fees"
                      : "phase-one-exit-liquidity";
          await action.send({
            kind,
            label: t(selectedMode),
            amount: quote
              ? `${tokenAmount(quote.maximumAmount0, 0)} + ${tokenAmount(quote.maximumAmount1, 1)}`
              : `${tokenAmount(min0, 0)} + ${tokenAmount(min1, 1)}`,
            to: transaction.target,
            data: transaction.calldata,
          });
        },
      };
    });
  const resolve = (slot: number, forfeit: boolean) =>
    action.prepare(async () => {
      const latest = await readPublicManagedLiquidityPosition({
        publicClient: action.publicClient!,
        deployment,
        positionId,
        poolId,
      });
      const amount = latest.rewards.amounts[slot];
      const asset = latest.rewards.assets[slot];
      const metadata = deployment.supportedPools
        .flatMap((entry) => [entry.token0, entry.token1])
        .find((token) => token.address.toLowerCase() === asset.toLowerCase());
      const display = metadata
        ? `${formatUnits(amount, metadata.decimals)} ${metadata.symbol}`
        : `${amount} units (${asset})`;
      const transaction = buildGaugeRewardResolution({
        deployment,
        positionId,
        poolId,
        action: forfeit
          ? { kind: "forfeit-lp", slot }
          : {
              kind: "claim-lp",
              slots: [slot],
              minimumAmounts: [(amount * 995n) / 1000n],
              receiver: action.wallet!,
            },
      });
      const prerequisites =
        latest.leg.liquidity > 0n || (forfeit && slot === 0 && amount > 0n)
          ? await gaugePrerequisites(action.publicClient!, deployment)
          : [];
      return {
        label: forfeit ? t("forfeit") : t("claimReward"),
        details: [
          display,
          ...(forfeit
            ? [
                t("forfeitHelp"),
                `${t("fractionalRemainder")}: ${metadata ? fractionalRewardAmount(latest.leg.rewardRemainderRay[slot], metadata.decimals) + " " + metadata.symbol : "less than one token unit"}`,
              ]
            : [
                `${t("minimum")}: ${metadata ? formatUnits((amount * 995n) / 1000n, metadata.decimals) : String((amount * 995n) / 1000n)}`,
              ]),
          ...prerequisites.map((entry) => entry.label),
        ],
        execute: async () => {
          for (const prerequisite of prerequisites)
            await action.send({
              kind: "phase-one-checkpoint-schedule",
              label: prerequisite.label,
              amount: t("positionNumber", { id: String(positionId) }),
              to: deployment.contracts.diamond,
              data: prerequisite.data,
            });
          await action.send({
            kind: forfeit ? "phase-one-forfeit-lp-reward" : "phase-one-claim-lp-rewards",
            label: forfeit ? t("forfeit") : t("claimReward"),
            amount: display,
            to: transaction.target,
            data: transaction.calldata,
          });
        },
      };
    });
  return (
    <>
      <div className="remaining-section-heading">
        <div>
          <p className="dapp-section-label">{t("positionNumber", { id: String(positionId) })}</p>
          <h3>
            {pool.token0.symbol}/{pool.token1.symbol}
          </h3>
        </div>
      </div>
      {managed.isError && <p role="alert">{managed.error.message}</p>}
      {state.isError && <p role="alert">{state.error.message}</p>}
      <div className="dollar-tabs liquidity-tabs" aria-label={t("actions")}>
        {(
          [
            ...(active || managed.data?.claimOnly ? [] : ["provide", "attach"]),
            ...(active ? ["increase", "decrease", "collect", "rebalance", "exit"] : []),
          ] as Mode[]
        ).map((item) => (
          <button
            key={item}
            type="button"
            disabled={action.busy}
            className={selectedMode === item ? "active" : undefined}
            onClick={() => {
              action.cancel();
              setMode(item);
            }}
          >
            {t(item)}
          </button>
        ))}
      </div>
      <fieldset disabled={!action.ready || action.busy}>
        {selectedMode === "attach" ? (
          <label className="basket-field">
            {t("chooseLp")}
            <select
              value={lpId || String(lpIds.data?.[0] ?? "")}
              onChange={(event) => {
                action.cancel();
                setLpId(event.target.value);
              }}
            >
              {lpIds.data?.map((id) => (
                <option key={String(id)} value={String(id)}>
                  {t("lpNumber", { id: String(id) })}
                </option>
              ))}
            </select>
            {lpIds.isError && <span role="alert">{lpIds.error.message}</span>}
          </label>
        ) : (
          <>
            {deposits && (
              <>
                {selectedMode !== "increase" && (
                  <>
                    <label className="basket-field">
                      <input
                        type="checkbox"
                        checked={fullRange}
                        onChange={(event) => {
                          action.cancel();
                          setFullRange(event.target.checked);
                        }}
                      />
                      {t("fullRange")}
                    </label>
                    {!fullRange && (
                      <>
                        <label className="basket-field">
                          {t("lowerPrice", { pair: `${pool.token1.symbol}/${pool.token0.symbol}` })}
                          <input
                            value={lower}
                            onChange={(event) => {
                              action.cancel();
                              setLower(event.target.value);
                            }}
                            inputMode="decimal"
                          />
                        </label>
                        <label className="basket-field">
                          {t("upperPrice", { pair: `${pool.token1.symbol}/${pool.token0.symbol}` })}
                          <input
                            value={upper}
                            onChange={(event) => {
                              action.cancel();
                              setUpper(event.target.value);
                            }}
                            inputMode="decimal"
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
                <label className="basket-field">
                  {t("maximumToken", { symbol: pool.token0.symbol })}
                  <input
                    value={amount0}
                    onChange={(event) => {
                      action.cancel();
                      setAmount0(event.target.value);
                    }}
                    inputMode="decimal"
                  />
                </label>
                <label className="basket-field">
                  {t("maximumToken", { symbol: pool.token1.symbol })}
                  <input
                    value={amount1}
                    onChange={(event) => {
                      action.cancel();
                      setAmount1(event.target.value);
                    }}
                    inputMode="decimal"
                  />
                </label>
              </>
            )}
            {selectedMode === "decrease" && (
              <label className="basket-field">
                {t("withdrawPercent")}
                <input
                  value={percentage}
                  onChange={(event) => {
                    action.cancel();
                    setPercentage(event.target.value);
                  }}
                  inputMode="decimal"
                />
              </label>
            )}
            {withdrawals && selectedMode !== "collect" && (
              <>
                <label className="basket-field">
                  {t("minimumToken", { symbol: pool.token0.symbol })}
                  <input
                    value={minimum0}
                    placeholder={t("automatic")}
                    onChange={(event) => {
                      action.cancel();
                      setMinimum0(event.target.value);
                    }}
                    inputMode="decimal"
                  />
                </label>
                <label className="basket-field">
                  {t("minimumToken", { symbol: pool.token1.symbol })}
                  <input
                    value={minimum1}
                    placeholder={t("automatic")}
                    onChange={(event) => {
                      action.cancel();
                      setMinimum1(event.target.value);
                    }}
                    inputMode="decimal"
                  />
                </label>
              </>
            )}
            {selectedMode !== "collect" && (
              <label className="basket-field">
                {t("slippage")} (%)
                <input
                  value={slippage}
                  onChange={(event) => {
                    action.cancel();
                    setSlippage(event.target.value);
                  }}
                  inputMode="decimal"
                />
              </label>
            )}
          </>
        )}
        {!managed.data?.claimOnly && (
          <button
            className="dollar-submit"
            type="button"
            disabled={!state.data || !managed.data}
            onClick={() => void prepare()}
          >
            {t("reviewAction", { action: t(selectedMode) })}
          </button>
        )}
      </fieldset>
      {managed.data?.closeBlockers.map((blocker) => (
        <p key={blocker}>{blocker}</p>
      ))}
      {managed.data?.rewards.amounts.slice(0, managed.data.rewards.slotCount).map(
        (amount, slot) =>
          (amount > 0n || managed.data!.leg.rewardRemainderRay[slot] > 0n) && (
            <article className="reward-position" key={slot}>
              <p>
                {t("rewardObligation")}: {amount.toString()} ({managed.data!.rewards.assets[slot]})
              </p>
              <button
                type="button"
                disabled={!action.ready || action.busy || amount === 0n}
                onClick={() => void resolve(slot, false)}
              >
                {t("claimReward")}
              </button>
              <button
                type="button"
                disabled={!action.ready || action.busy || active}
                onClick={() => void resolve(slot, true)}
              >
                {t("forfeit")}
              </button>
            </article>
          )
      )}
      <ActionReview action={action} />
    </>
  );
}
