"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, formatUnits, parseEventLogs, encodeFunctionData, type Hex } from "viem";
import Link from "next/link";
import { LiquidityRange } from "@/components/liquidity/LiquidityRange";
import {
  maximumPairedInput,
  pairedLiquidityAmounts,
  priceFromSqrt,
} from "@/lib/phase-one/liquidity-preview";
import { wethAbi } from "@statics-protocol/sdk";
import { staticsAbi, staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { usePhaseOnePositions } from "@/hooks/usePhaseOnePositions";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { configuredIndexerUrlForDeployment, loadWalletV4PositionIds } from "@/lib/indexer/statics";
import {
  loadIndexedPhaseOnePosition,
  loadIndexedManagedLiquidity,
  type IndexedManagedLiquidity,
} from "@/lib/indexer/phase-one";
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
import { mapRewardReads } from "@/lib/phase-one/reward-portfolio";
import { useAppLocale } from "@/i18n/client";

type Mode = "provide" | "attach" | "increase" | "decrease" | "collect" | "rebalance" | "exit";

export function PhaseOneLiquidity({
  deployment,
  initialPositionId = null,
  initialPoolId = null,
}: {
  deployment: PhaseOneDeployment;
  initialPositionId?: bigint | null;
  initialPoolId?: Hex | null;
}) {
  const t = useTranslations("phaseOne");
  const ux = useTranslations("liquidityUx");
  const [screen, setView] = useState<"list" | "pool" | "deposit" | "detail" | "focus">(
    initialPositionId !== null ? "focus" : "list"
  );
  const action = usePhaseOneAction(deployment);
  const positions = usePhaseOnePositions(deployment.descriptor.deploymentId, action.wallet);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const [poolId, setPoolId] = useState(
    initialPoolId ?? deployment.supportedPools.find((pool) => pool.enabled)?.poolId ?? ""
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
        : screen === "focus"
          ? ""
          : (ownedIds[0] ?? "");
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: [
      "phase-one-liquidity-catalog",
      deployment.descriptor.deploymentId,
      action.wallet,
      items
        .map(
          (item) =>
            `${item.positionId}:${item.activeLegCount}:${item.unresolvedObligationCount}:${item.updatedAtBlock}`
        )
        .join(","),
    ],
    enabled: action.ready,
    retry: false,
    queryFn: async () =>
      (
        await mapRewardReads(
          items.filter((item) => item.activeLegCount > 0n || item.unresolvedObligationCount > 0n),
          (item) =>
            queryClient.fetchQuery({
              queryKey: [
                "phase-one-liquidity-catalog",
                deployment.descriptor.deploymentId,
                action.wallet,
                String(item.positionId),
                String(item.updatedAtBlock),
              ],
              staleTime: 30_000,
              retry: false,
              queryFn: async () => {
                const legs = await loadIndexedManagedLiquidity(
                  item.positionId,
                  deployment.descriptor.deploymentId,
                  action.wallet!
                );
                const retained: IndexedManagedLiquidity[] = [];
                for (const leg of legs) {
                  if (leg.liquidity > 0n) {
                    retained.push(leg);
                    continue;
                  }
                  if (item.unresolvedObligationCount === 0n) continue;
                  const stored = await queryClient.fetchQuery({
                    queryKey: [
                      "phase-one-liquidity",
                      deployment.descriptor.deploymentId,
                      action.wallet,
                      String(item.positionId),
                      leg.poolId,
                      "catalog-obligation",
                      String(item.updatedAtBlock),
                    ],
                    staleTime: 30_000,
                    retry: false,
                    queryFn: () =>
                      action.publicClient!.readContract({
                        address: deployment.contracts.diamond,
                        abi: staticsRangeGaugeAbi,
                        functionName: "lpLeg",
                        args: [item.positionId, leg.poolId],
                      }),
                  });
                  if (
                    stored.claimable.some((amount) => amount > 0n) ||
                    stored.rewardRemainderRay.some((amount) => amount > 0n)
                  )
                    retained.push(leg);
                }
                return retained;
              },
            })
        )
      ).flat(),
  });
  const focusedLeg =
    screen === "focus"
      ? catalog.data?.find(
          (leg) =>
            leg.positionId === initialPositionId &&
            (!initialPoolId || leg.poolId.toLowerCase() === initialPoolId.toLowerCase()) &&
            deployment.supportedPools.some(
              (pool) => pool.enabled && pool.poolId.toLowerCase() === leg.poolId.toLowerCase()
            )
        )
      : null;
  const view = screen === "focus" ? (focusedLeg ? "detail" : "deposit") : screen;
  const activePoolId = focusedLeg?.poolId ?? poolId;
  const activePoolAvailable = deployment.supportedPools.some(
    (pool) => pool.enabled && pool.poolId.toLowerCase() === activePoolId.toLowerCase()
  );
  const focusError =
    screen === "focus" &&
    (initial.isError || positions.isError || catalog.isError || (initial.isSuccess && !ownInitial));
  const loadingFocus =
    screen === "focus" && (initial.isLoading || positions.isLoading || catalog.isLoading);
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
    <div className="liquidity-experience">
      <header className="liquidity-heading">
        <div>
          {view !== "list" && (
            <button
              className="liquidity-back"
              type="button"
              disabled={action.busy}
              onClick={() => {
                action.cancel();
                setView(view === "deposit" ? "pool" : "list");
              }}
            >
              ← {ux(view === "deposit" ? "choosePool" : "yourLiquidity")}
            </button>
          )}
          <h2>
            {ux(
              view === "list"
                ? "yourLiquidity"
                : view === "detail"
                  ? "positionDetails"
                  : "addLiquidity"
            )}
          </h2>
          <p className="liquidity-muted">
            {ux(view === "list" ? "listHelp" : view === "detail" ? "detailHelp" : "depositHelp")}
          </p>
        </div>
        {view === "list" && (
          <button
            className="ui-button ui-button--primary"
            type="button"
            onClick={() => setView("pool")}
          >
            + {ux("addLiquidity")}
          </button>
        )}
      </header>
      {view === "list" ? (
        <>
          {(positions.isLoading || catalog.isLoading) && (
            <p role="status">{ux("loadingPositions")}</p>
          )}
          {(positions.isError || catalog.isError) && (
            <p role="alert">{positions.error?.message || catalog.error?.message}</p>
          )}
          {!positions.isLoading &&
            !catalog.isLoading &&
            !positions.isError &&
            !catalog.isError &&
            !positions.hasNextPage &&
            !catalog.data?.length && (
              <section className="ui-card liquidity-empty">
                <span className="liquidity-empty-icon" aria-hidden="true">
                  ↔
                </span>
                <h3>{ux("emptyTitle")}</h3>
                <p>{ux("emptyHelp")}</p>
                <button
                  className="ui-button ui-button--primary"
                  type="button"
                  onClick={() => setView("pool")}
                >
                  {ux("addLiquidity")}
                </button>
              </section>
            )}
          <div className="liquidity-position-list">
            {catalog.data?.map((leg) => (
              <LiquidityPositionCard
                key={`${leg.positionId}:${leg.poolId}`}
                deployment={deployment}
                leg={leg}
                onSelect={() => {
                  setSelectedId(String(leg.positionId));
                  setPoolId(leg.poolId);
                  setView("detail");
                }}
              />
            ))}
          </div>
          {positions.hasNextPage && (
            <button
              className="ui-button"
              type="button"
              disabled={positions.isFetchingNextPage}
              onClick={() => void positions.fetchNextPage()}
            >
              {t("loadMore")}
            </button>
          )}
          <ActionReview action={action} />
        </>
      ) : view === "pool" ? (
        <section className="ui-card liquidity-pool-step">
          <p className="liquidity-step">{ux("stepPool")}</p>
          <h3>{ux("choosePool")}</h3>
          <div className="liquidity-pool-options">
            {deployment.supportedPools
              .filter((pool) => pool.enabled)
              .map((pool) => (
                <button
                  className={`liquidity-pool-option${poolId === pool.poolId ? " is-selected" : ""}`}
                  type="button"
                  key={pool.poolId}
                  aria-pressed={poolId === pool.poolId}
                  onClick={() => setPoolId(pool.poolId)}
                >
                  <span className="liquidity-pair-icons" aria-hidden="true">
                    <span>{pool.token0.symbol.slice(0, 1)}</span>
                    <span>{pool.token1.symbol.slice(0, 1)}</span>
                  </span>
                  <strong>
                    {pool.token0.symbol} / {pool.token1.symbol}
                  </strong>
                  <span>{ux("feeTier", { fee: pool.poolKey.fee / 10000 })}</span>
                </button>
              ))}
          </div>
          <p className="liquidity-muted">{ux("poolHelp")}</p>
          <button
            className="ui-button ui-button--primary"
            disabled={
              !deployment.supportedPools.some(
                (pool) => pool.enabled && pool.poolId.toLowerCase() === poolId.toLowerCase()
              )
            }
            type="button"
            onClick={() => setView("deposit")}
          >
            {ux("continue")}
          </button>
        </section>
      ) : focusError || !activePoolAvailable ? (
        <section className="ui-card" role="alert">
          <p>{ux(focusError ? "positionUnavailable" : "poolUnavailable")}</p>
          <button
            className="ui-button"
            type="button"
            onClick={() => {
              action.cancel();
              setPoolId(deployment.supportedPools.find((pool) => pool.enabled)?.poolId ?? "");
              setView("pool");
            }}
          >
            {ux("choosePool")}
          </button>
        </section>
      ) : (
        <>
          {view === "deposit" && (
            <div className="liquidity-destination">
              <label>
                {ux("destination")}
                <select
                  aria-label={ux("destination")}
                  disabled={action.busy}
                  value={selectedId === "new" ? "new" : resolved || "new"}
                  onChange={(event) => {
                    action.cancel();
                    setSelectedId(event.target.value);
                  }}
                >
                  {ownedIds.map((id) => (
                    <option key={id} value={id}>
                      {t("positionNumber", { id })}
                    </option>
                  ))}
                  <option value="new">{ux("createNew")}</option>
                </select>
              </label>
              {positions.hasNextPage && (
                <button
                  className="ui-button"
                  type="button"
                  onClick={() => void positions.fetchNextPage()}
                  disabled={positions.isFetchingNextPage}
                >
                  {t("loadMore")}
                </button>
              )}
              {(selectedId === "new" || !resolved) && (
                <div className="liquidity-create">
                  <p>{ux("createHelp")}</p>
                  <button
                    className="ui-button"
                    type="button"
                    disabled={!action.ready || action.busy}
                    onClick={() => void create()}
                  >
                    {t("newPosition")}
                  </button>
                  <ActionReview action={action} />
                </div>
              )}
            </div>
          )}
          {loadingFocus ? (
            <p role="status">{ux("loadingPositions")}</p>
          ) : resolved && selectedId !== "new" && activePoolId ? (
            <ManagedLiquidity
              key={`${deployment.descriptor.deploymentId}:${action.wallet}:${resolved}:${activePoolId}:${view}`}
              deployment={deployment}
              positionId={BigInt(resolved)}
              poolId={activePoolId as Hex}
              detail={view === "detail"}
            />
          ) : (
            <p className="liquidity-muted">{ux("chooseDestination")}</p>
          )}
          {positions.isError && <p role="alert">{positions.error.message}</p>}
          {!action.ready && <ActionReview action={action} />}
        </>
      )}
    </div>
  );
}

function LiquidityPositionCard({
  deployment,
  leg,
  onSelect,
}: {
  deployment: PhaseOneDeployment;
  leg: IndexedManagedLiquidity;
  onSelect: () => void;
}) {
  const ux = useTranslations("liquidityUx");
  const t = useTranslations("phaseOne");
  const action = usePhaseOneAction(deployment);
  const configured = deployment.supportedPools.find(
    (pool) => pool.poolId.toLowerCase() === leg.poolId.toLowerCase()
  );
  const pool = configured?.enabled ? listedPublicPool(configured) : null;
  const state = useQuery({
    queryKey: protocolQueryKeys.phaseOnePool(deployment.descriptor.deploymentId, leg.poolId),
    enabled: action.ready && Boolean(pool),
    queryFn: () => readPublicPoolState(action.publicClient!, deployment, pool!),
  });
  const fees = useQuery({
    queryKey: [
      "phase-one-liquidity-fees",
      deployment.descriptor.deploymentId,
      action.wallet,
      leg.positionId.toString(),
      leg.poolId,
      leg.posmTokenId.toString(),
    ],
    enabled: action.ready && Boolean(pool) && leg.liquidity > 0n,
    retry: false,
    queryFn: () =>
      readPublicLiquidityFees({ publicClient: action.publicClient!, deployment, ...leg }),
  });
  if (!pool)
    return (
      <section className="ui-card">
        <strong>
          {configured ? `${configured.token0.symbol} / ${configured.token1.symbol}` : leg.poolId}
        </strong>
        <p>{ux("unavailablePool", { id: String(leg.positionId) })}</p>
        <Link href={`/app/rewards/bribes?positionId=${leg.positionId}&poolId=${leg.poolId}`}>
          {ux("manageRewards")}
        </Link>
      </section>
    );
  const amounts =
    state.data && leg.liquidity > 0n
      ? quoteWithdrawalAmounts(state.data.sqrtPriceX96, leg.tickLower, leg.tickUpper, leg.liquidity)
      : null;
  const inRange = state.data && state.data.tick >= leg.tickLower && state.data.tick < leg.tickUpper;
  return (
    <button
      type="button"
      className="ui-card liquidity-position-card"
      aria-label={`${pool.token0.symbol} / ${pool.token1.symbol} ${t("positionNumber", { id: String(leg.positionId) })}`}
      onClick={onSelect}
    >
      <div>
        <strong>
          {pool.token0.symbol} / {pool.token1.symbol}
        </strong>
        <span>
          {t("positionNumber", { id: String(leg.positionId) })} ·{" "}
          {ux("feeTier", { fee: pool.poolKey.fee / 10000 })}
        </span>
      </div>
      <div>
        {amounts ? (
          <>
            <strong>
              {formatUnits(amounts.amount0, pool.token0.decimals)} {pool.token0.symbol}
            </strong>
            <strong>
              {formatUnits(amounts.amount1, pool.token1.decimals)} {pool.token1.symbol}
            </strong>
          </>
        ) : (
          <span>{ux(leg.liquidity === 0n ? "claimRequired" : "loading")}</span>
        )}
      </div>
      {leg.liquidity > 0n && (
        <div className="liquidity-list-fees">
          <span>{ux("tradingFees")}</span>
          {fees.data ? (
            <>
              <strong>
                {formatUnits(fees.data.amount0, pool.token0.decimals)} {pool.token0.symbol}
              </strong>
              <strong>
                {formatUnits(fees.data.amount1, pool.token1.decimals)} {pool.token1.symbol}
              </strong>
            </>
          ) : (
            <span>{ux(fees.isError ? "feesUnavailable" : "loading")}</span>
          )}
        </div>
      )}
      <span className={inRange ? "liquidity-status" : "liquidity-status is-out"}>
        {ux(
          leg.liquidity === 0n
            ? "claimRequired"
            : !state.data
              ? "loading"
              : inRange
                ? "inRange"
                : "outOfRange"
        )}
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

function ManagedLiquidity({
  deployment,
  positionId,
  poolId,
  detail,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  poolId: Hex;
  detail: boolean;
}) {
  const t = useTranslations("phaseOne");
  const ux = useTranslations("liquidityUx");
  const locale = useAppLocale();
  const [editing, setEditing] = useState(!detail);
  const [completed, setCompleted] = useState(false);
  const [fundWithEth, setFundWithEth] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [exact, setExact] = useState<0 | 1>(0);
  const action = usePhaseOneAction(deployment, `${positionId}:${poolId}`);
  const queryClient = useQueryClient();
  const pool = listedPublicPool(
    deployment.supportedPools.find((entry) => entry.poolId.toLowerCase() === poolId.toLowerCase())!
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
  const selectedMode =
    mode === "decrease" && percentage === "100"
      ? "exit"
      : mode === "provide" && active
        ? "increase"
        : mode;
  const deposits =
    selectedMode === "provide" || selectedMode === "increase" || selectedMode === "rebalance";
  const withdrawals =
    selectedMode === "decrease" ||
    selectedMode === "exit" ||
    selectedMode === "rebalance" ||
    selectedMode === "collect";
  const balances = useQuery({
    queryKey: [
      "phase-one-liquidity-balances",
      deployment.descriptor.deploymentId,
      action.wallet,
      poolId,
    ],
    enabled: action.ready,
    queryFn: () =>
      Promise.all(
        [pool.token0, pool.token1].map((token) =>
          action.publicClient!.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [action.wallet!],
          })
        )
      ),
  });
  const wrappedIndex = [pool.token0, pool.token1].findIndex(
    (token) => token.address.toLowerCase() === deployment.contracts.weth?.toLowerCase()
  );
  const nativeBalance = useQuery({
    queryKey: [
      "phase-one-liquidity-native-balance",
      deployment.descriptor.deploymentId,
      action.wallet,
    ],
    enabled: action.ready && wrappedIndex >= 0,
    queryFn: () => action.publicClient!.getBalance({ address: action.wallet! }),
  });
  const spendable = (index: number) =>
    (balances.data?.[index] ?? 0n) +
    (fundWithEth && index === wrappedIndex
      ? (nativeBalance.data ?? 0n) > 10n ** 15n
        ? (nativeBalance.data ?? 0n) - 10n ** 15n
        : 0n
      : 0n);
  const fees = useQuery({
    queryKey: [
      "phase-one-liquidity-fees",
      deployment.descriptor.deploymentId,
      action.wallet,
      positionId.toString(),
      poolId,
      managed.data?.leg.posmTokenId.toString(),
    ],
    enabled: action.ready && detail && active,
    retry: false,
    queryFn: () =>
      readPublicLiquidityFees({
        publicClient: action.publicClient!,
        deployment,
        poolId,
        ...managed.data!.leg,
      }),
  });

  const rangeTicks = (): readonly [number, number] => {
    if (selectedMode === "increase" || !deposits)
      return [managed.data!.leg.tickLower, managed.data!.leg.tickUpper];
    if (fullRange) return usableTickBounds(pool.poolKey.tickSpacing);
    const prices = [parseLocalizedUnits(lower, 36, locale), parseLocalizedUnits(upper, 36, locale)];
    if (prices[0] <= 0n || prices[1] <= prices[0]) throw new Error(ux("rangeError"));
    const canonical = inverted ? [10n ** 72n / prices[1], 10n ** 72n / prices[0]] : prices;
    return [
      priceToAlignedTick(
        canonical[0],
        pool.token0.decimals,
        pool.token1.decimals,
        pool.poolKey.tickSpacing,
        "lower"
      ),
      priceToAlignedTick(
        canonical[1],
        pool.token0.decimals,
        pool.token1.decimals,
        pool.poolKey.tickSpacing,
        "upper"
      ),
    ];
  };
  let previewTicks: readonly [number, number] | null = null;
  let inputError = "";
  let inputs: readonly [bigint, bigint] = [0n, 0n];
  try {
    if (managed.data) previewTicks = rangeTicks();
    if (deposits && state.data && previewTicks) {
      const value = exact === 0 ? amount0 : amount1;
      inputs =
        selectedMode === "rebalance"
          ? [
              parseLocalizedUnits(amount0 || "0", pool.token0.decimals, locale),
              parseLocalizedUnits(amount1 || "0", pool.token1.decimals, locale),
            ]
          : pairedLiquidityAmounts({
              sqrtPriceX96: state.data.sqrtPriceX96,
              tickLower: previewTicks[0],
              tickUpper: previewTicks[1],
              exactToken: exact,
              amount: parseLocalizedUnits(
                value || "0",
                exact === 0 ? pool.token0.decimals : pool.token1.decimals,
                locale
              ),
            });
      if (balances.data && inputs.some((amount, index) => amount > spendable(index)))
        inputError = ux("insufficientBalance");
    }
  } catch (failure) {
    inputError =
      failure instanceof Error && failure.message !== "invalid localized decimal"
        ? failure.message
        : ux("amountError");
  }
  const displayAmount = (amount: bigint, decimals: number) =>
    new Intl.NumberFormat(locale, { useGrouping: false, maximumSignificantDigits: 8 }).format(
      Number(formatUnits(amount, decimals))
    );
  const displays = [
    exact === 0 || selectedMode === "rebalance"
      ? amount0
      : displayAmount(inputs[0], pool.token0.decimals),
    exact === 1 || selectedMode === "rebalance"
      ? amount1
      : displayAmount(inputs[1], pool.token1.decimals),
  ];
  const currentPrice = state.data
    ? priceFromSqrt(state.data.sqrtPriceX96, pool.token0.decimals, pool.token1.decimals)
    : 0;
  const displayPrice = inverted ? 1 / currentPrice : currentPrice;
  const pricePair = inverted
    ? `${pool.token0.symbol}/${pool.token1.symbol}`
    : `${pool.token1.symbol}/${pool.token0.symbol}`;
  const lowerPrice = previewTicks
    ? Number(
        tickPrice(
          inverted ? previewTicks[1] : previewTicks[0],
          pool.token0.decimals,
          pool.token1.decimals
        )
      )
    : 0;
  const upperPrice = previewTicks
    ? Number(
        tickPrice(
          inverted ? previewTicks[0] : previewTicks[1],
          pool.token0.decimals,
          pool.token1.decimals
        )
      )
    : 0;
  const effectiveFullRange =
    previewTicks?.[0] === usableTickBounds(pool.poolKey.tickSpacing)[0] &&
    previewTicks?.[1] === usableTickBounds(pool.poolKey.tickSpacing)[1];
  const inRange = Boolean(
    state.data &&
    previewTicks &&
    state.data.tick >= previewTicks[0] &&
    state.data.tick < previewTicks[1]
  );
  const holdings =
    active && state.data && managed.data
      ? quoteWithdrawalAmounts(
          state.data.sqrtPriceX96,
          managed.data.leg.tickLower,
          managed.data.leg.tickUpper,
          managed.data.leg.liquidity
        )
      : null;
  const share = mode === "decrease" ? Number(percentage) / 100 : 1;
  const expected = holdings
    ? [
        (holdings.amount0 * BigInt(Math.round(share * 10000))) / 10000n,
        (holdings.amount1 * BigInt(Math.round(share * 10000))) / 10000n,
      ]
    : [0n, 0n];
  const selectMode = (next: Mode) => {
    action.cancel();
    setCompleted(false);
    setMode(next);
    setEditing(true);
  };
  const setInput = (index: 0 | 1, value: string) => {
    action.cancel();
    setCompleted(false);
    setExact(index);
    (index === 0 ? setAmount0 : setAmount1)(value);
  };
  const fillMaximum = (index: 0 | 1) => {
    if (!state.data || !previewTicks) return;
    const maximum =
      selectedMode === "rebalance"
        ? spendable(index)
        : maximumPairedInput({
            sqrtPriceX96: state.data.sqrtPriceX96,
            tickLower: previewTicks[0],
            tickUpper: previewTicks[1],
            exactToken: index,
            balance0: spendable(0),
            balance1: spendable(1),
          });
    setInput(
      index,
      formatUnits(maximum, index === 0 ? pool.token0.decimals : pool.token1.decimals)
    );
  };
  const switchOrientation = () => {
    action.cancel();
    setCompleted(false);
    if (lower && upper) {
      try {
        const lo = parseLocalizedUnits(lower, 36, locale);
        const hi = parseLocalizedUnits(upper, 36, locale);
        if (lo > 0n && hi > 0n) {
          setLower(formatUnits(10n ** 72n / hi, 36));
          setUpper(formatUnits(10n ** 72n / lo, 36));
        }
      } catch {
        setLower("");
        setUpper("");
      }
    }
    setInverted(!inverted);
  };
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
      setCompleted(false);
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
          : rangeTicks();
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
      if (deposits && inputError) throw new Error(inputError);
      const maximum0 = deposits ? inputs[0] : 0n;
      const maximum1 = deposits ? inputs[1] : 0n;
      const wrapLimit =
        fundWithEth && wrappedIndex >= 0 && deposits
          ? (wrappedIndex === 0 ? maximum0 : maximum1) > (balances.data?.[wrappedIndex] ?? 0n)
            ? (wrappedIndex === 0 ? maximum0 : maximum1) - (balances.data?.[wrappedIndex] ?? 0n)
            : 0n
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
                `${t("range")}: ${effectiveFullRange ? "0 – ∞" : `${Number(tickPrice(tickLower, pool.token0.decimals, pool.token1.decimals)).toPrecision(6)} – ${Number(tickPrice(tickUpper, pool.token0.decimals, pool.token1.decimals)).toPrecision(6)}`} ${pool.token1.symbol}/${pool.token0.symbol}`,
              ]
            : []),
          ...(withdrawals
            ? [
                `${t(selectedMode === "collect" ? "feesToCollect" : "minimum")}: ${tokenAmount(min0, 0)} + ${tokenAmount(min1, 1)}`,
              ]
            : []),
          ...(selectedMode === "collect" ? [] : [`${t("slippage")}: ${slippage}%`]),
          ...(wrapLimit > 0n ? [ux("wrapReview", { amount: formatUnits(wrapLimit, 18) })] : []),
          ...(quote ? [ux("approvalReview")] : []),
          ...prerequisites.map((entry) => entry.label),
          ...(selectedMode === "exit" ? [t("exitHelp")] : []),
        ],
        execute: async () => {
          if (wrapLimit > 0n && quote) {
            const needed = wrappedIndex === 0 ? quote.maximumAmount0 : quote.maximumAmount1;
            const balance = await action.publicClient!.readContract({
              address: deployment.contracts.weth,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [action.wallet!],
            });
            const deficit = needed > balance ? needed - balance : 0n;
            if (deficit > wrapLimit) throw new Error(ux("wrapChanged"));
            if (deficit > 0n)
              await action.send({
                kind: "phase-one-wrap-native",
                label: ux("wrapEth"),
                amount: `${formatUnits(deficit, 18)} ETH`,
                to: deployment.contracts.weth,
                data: encodeFunctionData({ abi: wethAbi, functionName: "deposit" }),
                value: deficit,
              });
          }
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
          setCompleted(true);
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
          setCompleted(true);
        },
      };
    });
  return (
    <div className="liquidity-managed">
      {completed && (
        <p role="status" className="liquidity-status">
          {ux("confirmed")} <Link href="/app/activity">{ux("viewActivity")} →</Link>
        </p>
      )}
      <div className="liquidity-pair-heading">
        <span className="liquidity-pair-icons" aria-hidden="true">
          <span>{pool.token0.symbol.slice(0, 1)}</span>
          <span>{pool.token1.symbol.slice(0, 1)}</span>
        </span>
        <h3>
          {pool.token0.symbol} / {pool.token1.symbol}
        </h3>
        <span className="liquidity-fee">{ux("feeTier", { fee: pool.poolKey.fee / 10000 })}</span>
        <span className="liquidity-muted">{t("positionNumber", { id: String(positionId) })}</span>
      </div>
      {managed.isError && <p role="alert">{managed.error.message}</p>}
      {state.isError && <p role="alert">{state.error.message}</p>}
      {detail && (
        <>
          <div className="liquidity-detail-summary">
            <section className="ui-card">
              <h4>{ux("tokenHoldings")}</h4>
              <div className="liquidity-holdings">
                {[pool.token0, pool.token1].map((token, index) => (
                  <div key={token.address}>
                    <span>{token.symbol}</span>
                    <strong>
                      {holdings
                        ? formatUnits(
                            index === 0 ? holdings.amount0 : holdings.amount1,
                            token.decimals
                          )
                        : "—"}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="liquidity-muted">{ux("principalHelp")}</p>
            </section>
            <section className="ui-card">
              <h4>{ux("tradingFees")}</h4>
              {fees.data ? (
                <div className="liquidity-holdings">
                  <div>
                    <span>{pool.token0.symbol}</span>
                    <strong>{formatUnits(fees.data.amount0, pool.token0.decimals)}</strong>
                  </div>
                  <div>
                    <span>{pool.token1.symbol}</span>
                    <strong>{formatUnits(fees.data.amount1, pool.token1.decimals)}</strong>
                  </div>
                </div>
              ) : (
                <p className="liquidity-muted">
                  {ux(fees.isError ? "feesUnavailable" : "loading")}
                </p>
              )}
              <p className="liquidity-muted">{ux("feesHelp")}</p>
            </section>
            <section className="ui-card">
              <h4>{ux("incentiveRewards")}</h4>
              {managed.data?.rewards.amounts
                .slice(0, managed.data.rewards.slotCount)
                .map((amount, slot) => {
                  const token = deployment.supportedPools
                    .flatMap((entry) => [entry.token0, entry.token1])
                    .find(
                      (token) =>
                        token.address.toLowerCase() ===
                        managed.data!.rewards.assets[slot].toLowerCase()
                    );
                  return (
                    <strong className="liquidity-reward-value" key={slot}>
                      {token
                        ? `${formatUnits(amount, token.decimals)} ${token.symbol}`
                        : ux("unknownReward")}
                    </strong>
                  );
                })}
              <Link
                className="liquidity-back"
                href={`/app/rewards/gauge?positionId=${positionId}&poolId=${poolId}`}
              >
                {ux("manageRewards")} →
              </Link>
            </section>
          </div>
          <div className="liquidity-detail-actions">
            {active && (
              <>
                <button
                  className="ui-button ui-button--primary"
                  type="button"
                  disabled={action.busy}
                  onClick={() => selectMode("increase")}
                >
                  {ux("addLiquidity")}
                </button>
                <button
                  className="ui-button"
                  type="button"
                  disabled={action.busy}
                  onClick={() => selectMode("decrease")}
                >
                  {ux("removeLiquidity")}
                </button>
                <button
                  className="ui-button"
                  type="button"
                  disabled={action.busy}
                  onClick={() => selectMode("collect")}
                >
                  {t("collect")}
                </button>
                <details>
                  <summary>{ux("more")}</summary>
                  <button
                    type="button"
                    disabled={action.busy}
                    onClick={() => selectMode("rebalance")}
                  >
                    {t("rebalance")}
                  </button>
                </details>
              </>
            )}
            {managed.data && !active && !managed.data.claimOnly && (
              <button className="ui-button" type="button" onClick={() => selectMode("provide")}>
                {ux("addLiquidity")}
              </button>
            )}
          </div>
        </>
      )}
      <div className={`liquidity-editor${!editing ? " is-summary" : ""}`}>
        <section className="ui-card liquidity-price-card">
          <div className="liquidity-card-heading">
            <div>
              <p className="liquidity-step">{ux("stepRange")}</p>
              <h4>{ux("priceRange")}</h4>
            </div>
            <button
              className="ui-button liquidity-orientation"
              type="button"
              disabled={action.busy}
              onClick={switchOrientation}
            >
              {pricePair} ⇄
            </button>
          </div>
          {editing && deposits && selectedMode !== "increase" && (
            <div className="liquidity-segmented">
              <button
                type="button"
                aria-pressed={fullRange}
                disabled={action.busy}
                onClick={() => {
                  action.cancel();
                  setCompleted(false);
                  setFullRange(true);
                }}
              >
                {t("fullRange")}
              </button>
              <button
                type="button"
                aria-pressed={!fullRange}
                disabled={
                  action.busy || !state.data || !Number.isFinite(displayPrice) || displayPrice <= 0
                }
                onClick={() => {
                  action.cancel();
                  setCompleted(false);
                  setFullRange(false);
                  if (!lower || !upper) {
                    setLower(
                      new Intl.NumberFormat(locale, {
                        useGrouping: false,
                        maximumSignificantDigits: 10,
                      }).format(displayPrice * 0.8)
                    );
                    setUpper(
                      new Intl.NumberFormat(locale, {
                        useGrouping: false,
                        maximumSignificantDigits: 10,
                      }).format(displayPrice * 1.2)
                    );
                  }
                }}
              >
                {ux("customRange")}
              </button>
            </div>
          )}
          {state.data && previewTicks ? (
            <LiquidityRange
              current={displayPrice}
              lower={inverted ? 1 / lowerPrice : lowerPrice}
              upper={inverted ? 1 / upperPrice : upperPrice}
              fullRange={effectiveFullRange}
              symbol={pricePair}
              inRange={inRange}
            />
          ) : (
            <p className="liquidity-muted">{ux("loadingRange")}</p>
          )}
          {editing && deposits && selectedMode !== "increase" && !fullRange && (
            <div className="liquidity-bound-inputs">
              {[
                ["lower", lower, setLower],
                ["upper", upper, setUpper],
              ].map(([key, value, setter]) => (
                <label key={String(key)}>
                  {t(key === "lower" ? "lowerPrice" : "upperPrice", { pair: pricePair })}
                  <input
                    inputMode="decimal"
                    value={String(value)}
                    disabled={action.busy}
                    onChange={(event) => {
                      action.cancel();
                      setCompleted(false);
                      (setter as (value: string) => void)(event.target.value);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          {editing && !effectiveFullRange && deposits && (
            <p className="liquidity-muted">{ux("alignHelp")}</p>
          )}
          {inputError && (
            <p className="dapp-inline-error" role="alert">
              {inputError}
            </p>
          )}
        </section>
        {editing && (
          <section className="ui-card liquidity-deposit-card">
            <div className="liquidity-card-heading">
              <div>
                <p className="liquidity-step">{ux("stepDeposit")}</p>
                <h4>{selectedMode === "exit" ? ux("removeLiquidity") : t(selectedMode)}</h4>
              </div>
              {selectedMode !== "collect" && (
                <details className="liquidity-settings">
                  <summary aria-label={ux("settings")}>⚙</summary>
                  <label>
                    {t("slippage")} (%)
                    <input
                      value={slippage}
                      disabled={action.busy}
                      onChange={(event) => {
                        action.cancel();
                        setCompleted(false);
                        setSlippage(event.target.value);
                      }}
                      inputMode="decimal"
                    />
                  </label>
                </details>
              )}
            </div>
            {deposits && wrappedIndex >= 0 && (
              <label className="liquidity-funding">
                {ux("payWith")}
                <select
                  aria-label={ux("payWith")}
                  disabled={action.busy}
                  value={fundWithEth ? "ETH" : "WETH"}
                  onChange={(event) => {
                    action.cancel();
                    setCompleted(false);
                    setFundWithEth(event.target.value === "ETH");
                  }}
                >
                  <option value="WETH">WETH</option>
                  <option value="ETH">ETH + WETH</option>
                </select>
                {fundWithEth && <span className="liquidity-muted">{ux("nativeHelp")}</span>}
              </label>
            )}
            <fieldset disabled={!action.ready || action.busy}>
              {selectedMode === "attach" ? (
                <label className="basket-field">
                  {t("chooseLp")}
                  <select
                    value={lpId || String(lpIds.data?.[0] ?? "")}
                    onChange={(event) => {
                      action.cancel();
                      setCompleted(false);
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
                    <div className="liquidity-deposits">
                      {[pool.token0, pool.token1].map((token, index) => (
                        <div className="liquidity-token-input" key={token.address}>
                          <label htmlFor={`liquidity-amount-${index}`}>
                            {ux("depositToken", { symbol: token.symbol })}
                          </label>
                          <div>
                            <input
                              id={`liquidity-amount-${index}`}
                              value={displays[index]}
                              placeholder="0"
                              onChange={(event) => setInput(index as 0 | 1, event.target.value)}
                              inputMode="decimal"
                            />
                            <strong>{token.symbol}</strong>
                          </div>
                          <div className="liquidity-input-meta">
                            <span>
                              {ux("balance")}{" "}
                              {balances.data
                                ? new Intl.NumberFormat(locale, {
                                    maximumFractionDigits: 6,
                                  }).format(Number(formatUnits(spendable(index), token.decimals)))
                                : "—"}
                            </span>
                            <button
                              type="button"
                              disabled={!balances.data}
                              onClick={() => fillMaximum(index as 0 | 1)}
                            >
                              {ux("max")}
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="liquidity-muted">
                        {ux(selectedMode === "rebalance" ? "rebalanceHelp" : "pairedAmounts")}
                      </p>
                    </div>
                  )}
                  {mode === "decrease" && (
                    <div className="liquidity-withdrawal">
                      <strong>{percentage}%</strong>
                      <label>
                        {t("withdrawPercent")}
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={percentage}
                          onChange={(event) => {
                            action.cancel();
                            setCompleted(false);
                            setPercentage(event.target.value);
                          }}
                        />
                      </label>
                      <div className="liquidity-presets">
                        {[25, 50, 75, 100].map((value) => (
                          <button
                            type="button"
                            key={value}
                            aria-pressed={percentage === String(value)}
                            onClick={() => {
                              action.cancel();
                              setCompleted(false);
                              setPercentage(String(value));
                            }}
                          >
                            {value}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {withdrawals && selectedMode !== "collect" && (
                    <div className="liquidity-expected">
                      <p>{ux("expectedReturns")}</p>
                      <strong>{tokenAmount(expected[0], 0)}</strong>
                      <strong>{tokenAmount(expected[1], 1)}</strong>
                    </div>
                  )}
                  {withdrawals && selectedMode !== "collect" && (
                    <details className="liquidity-minimums">
                      <summary>{ux("minimumReturns")}</summary>
                      {[pool.token0, pool.token1].map((token, index) => (
                        <label className="basket-field" key={token.address}>
                          {t("minimumToken", { symbol: token.symbol })}
                          <input
                            value={index === 0 ? minimum0 : minimum1}
                            placeholder={t("automatic")}
                            onChange={(event) => {
                              action.cancel();
                              setCompleted(false);
                              (index === 0 ? setMinimum0 : setMinimum1)(event.target.value);
                            }}
                            inputMode="decimal"
                          />
                        </label>
                      ))}
                    </details>
                  )}
                </>
              )}
              {selectedMode === "exit" && <p className="liquidity-muted">{ux("exitReviewHelp")}</p>}
              {!managed.data?.claimOnly && (
                <button
                  className="ui-button ui-button--primary liquidity-review-button"
                  type="button"
                  disabled={
                    !state.data ||
                    !managed.data ||
                    Boolean(inputError) ||
                    (deposits &&
                      selectedMode !== "rebalance" &&
                      inputs[0] === 0n &&
                      inputs[1] === 0n) ||
                    (deposits && !balances.data)
                  }
                  onClick={() => void prepare()}
                >
                  {t("reviewAction", { action: t(selectedMode) })}
                </button>
              )}
            </fieldset>
            <div className="liquidity-inline-review">
              <ActionReview action={action} />
            </div>
            {!active && !managed.data?.claimOnly && selectedMode !== "attach" && (
              <button
                className="liquidity-back"
                type="button"
                disabled={action.busy}
                onClick={() => selectMode("attach")}
              >
                {ux("attachExisting")} →
              </button>
            )}
            {selectedMode === "attach" && (
              <button
                className="liquidity-back"
                type="button"
                disabled={action.busy}
                onClick={() => selectMode("provide")}
              >
                {ux("backToDeposit")}
              </button>
            )}
          </section>
        )}
      </div>
      {(managed.data?.claimOnly || selectedMode === "exit") && (
        <section className="ui-card liquidity-obligations">
          <h4>{ux("finishExit")}</h4>
          <p className="liquidity-muted">{ux("obligationHelp")}</p>
          {managed.data?.rewards.amounts
            .slice(0, managed.data.rewards.slotCount)
            .map((amount, slot) => {
              if (amount === 0n && managed.data!.leg.rewardRemainderRay[slot] === 0n) return null;
              const metadata = deployment.supportedPools
                .flatMap((entry) => [entry.token0, entry.token1])
                .find(
                  (token) =>
                    token.address.toLowerCase() === managed.data!.rewards.assets[slot].toLowerCase()
                );
              return (
                <article className="liquidity-obligation" key={slot}>
                  <strong>
                    {metadata
                      ? `${formatUnits(amount, metadata.decimals)} ${metadata.symbol}`
                      : ux("unknownReward")}
                  </strong>
                  <button
                    className="ui-button"
                    type="button"
                    disabled={!action.ready || action.busy || amount === 0n}
                    onClick={() => void resolve(slot, false)}
                  >
                    {t("claimReward")}
                  </button>
                  <button
                    className="liquidity-back"
                    type="button"
                    disabled={!action.ready || action.busy || active}
                    onClick={() => void resolve(slot, true)}
                  >
                    {t("forfeit")}
                  </button>
                </article>
              );
            })}
          {!editing && (
            <div className="liquidity-inline-review">
              <ActionReview action={action} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
