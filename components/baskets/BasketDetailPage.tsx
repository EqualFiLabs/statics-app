"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { encodeFunctionData, formatUnits, getAddress, type Address, type Hex } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  basketTokenAbi,
  buildCreateAndMintBasketCollateralCall,
  buildMintBasketCollateralCall,
  buildMintCall,
  buildRedeemBasketCollateralCall,
  buildRedeemCall,
  staticsAbi,
} from "@statics-protocol/sdk";

import {
  DEFAULT_BASKET_SLIPPAGE_BPS,
  basketStatusLabel,
  deriveBasketActionAvailability,
  describeBasketError,
  loadBasketCatalog,
  maximumWithSlippage,
  minimumWithSlippage,
  parseSlippageBps,
  validateBasketCollateralSimulation,
  validateBasketSimulation,
  type BasketRecord,
} from "@/lib/baskets/baskets";
import {
  positionSelection,
  recommendedMintSelection,
  selectedPositionId,
  type BasketConversionAction,
  type BasketConversionSelection,
} from "@/lib/baskets/conversion-navigation";
import { BasketSwapPanel } from "@/components/baskets/BasketSwapPanel";
import { EmptyState, SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { deriveSurfaceState } from "@/lib/surface-state";
import type { ProtocolActivityKind } from "@/lib/dollar/activity";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { loadPositionCatalog, unlockedCollateral } from "@/lib/positions/positions";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals = 18, precision = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function feeTierLabel(
  tiers: BasketRecord["mintFeeTiers"],
  translate: (key: "noTier" | "tier", values?: Record<string, string>) => string
): string {
  if (tiers.length === 0) return translate("noTier");
  return tiers
    .map((tier) =>
      translate("tier", {
        fee: displayAmount(tier.feeShares),
        minimum: displayAmount(tier.minActionShares),
      })
    )
    .join(" · ");
}

export function BasketDetailPage({
  basketId,
  initialAction = "mint",
  initialPositionId = null,
}: {
  basketId: bigint;
  initialAction?: BasketConversionAction;
  initialPositionId?: bigint | null;
}) {
  const t = useTranslations("baskets");
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject={t("singular")} />;
  return (
    <BasketDetailRuntime
      basketId={basketId}
      initialAction={initialAction}
      initialPositionId={initialPositionId}
    />
  );
}

function BasketDetailRuntime({
  basketId,
  initialAction,
  initialPositionId,
}: {
  basketId: bigint;
  initialAction: BasketConversionAction;
  initialPositionId: bigint | null;
}) {
  const locale = useAppLocale();
  const t = useTranslations("baskets");
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [mode, setMode] = useState<"mint" | "redeem" | "swap">(initialAction);
  const [selectionOverride, setSelectionOverride] = useState<BasketConversionSelection | null>(
    null
  );
  const [amountInput, setAmountInput] = useState("");
  const [slippageInput, setSlippageInput] = useState(
    (DEFAULT_BASKET_SLIPPAGE_BPS / 100).toFixed(2)
  );
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const amount = useMemo(() => {
    try {
      return parseLocalizedUnits(amountInput, 18, locale);
    } catch {
      return 0n;
    }
  }, [amountInput, locale]);
  const slippageBps = parseSlippageBps(slippageInput);

  const positions = useQuery({
    queryKey: protocolQueryKeys.positionCatalog(
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : undefined,
      wallet
    ),
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      return loadPositionCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });

  const catalog = useQuery({
    queryKey: protocolQueryKeys.basketCatalog(
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : undefined,
      wallet
    ),
    enabled: deploymentState.status === "configured" && Boolean(publicClient),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadBasketCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });
  const basket = catalog.data?.baskets.find((candidate) => candidate.basketId === basketId);
  const ownedPositions = positions.data?.positions ?? [];
  const redeemablePositions = ownedPositions.filter((position) =>
    position.collateral.some(
      (collateral) => collateral.basket.basketId === basketId && unlockedCollateral(collateral) > 0n
    )
  );
  const initialSelection = initialPositionId === null ? null : positionSelection(initialPositionId);
  const availableSelections: readonly BasketConversionSelection[] =
    mode === "mint"
      ? [
          "wallet",
          "new-position",
          ...ownedPositions.map(({ positionId }) => positionSelection(positionId)),
        ]
      : ["wallet", ...redeemablePositions.map(({ positionId }) => positionSelection(positionId))];
  const requestedSelection = selectionOverride ?? initialSelection;
  const conversionSelection =
    requestedSelection && availableSelections.includes(requestedSelection)
      ? requestedSelection
      : mode === "mint"
        ? recommendedMintSelection(ownedPositions)
        : "wallet";
  const conversionPositionId = selectedPositionId(conversionSelection);
  const conversionPosition =
    conversionPositionId === null
      ? null
      : (ownedPositions.find(({ positionId }) => positionId === conversionPositionId) ?? null);
  const conversionCollateral =
    conversionPosition?.collateral.find((collateral) => collateral.basket.basketId === basketId) ??
    null;
  const sourceBalance =
    mode === "redeem" && conversionCollateral
      ? unlockedCollateral(conversionCollateral)
      : (basket?.walletBalance ?? 0n);
  const quote = useQuery({
    queryKey: ["basket-quote", basketId.toString(), mode, amount.toString()],
    enabled:
      Boolean(publicClient) &&
      deploymentState.status === "configured" &&
      Boolean(basket) &&
      mode !== "swap" &&
      amount > 0n,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      if (mode === "swap") throw new Error("Canonical swaps use the Robinhood v4 quoter.");
      const functionName = mode === "mint" ? "quoteMint" : "quoteRedeem";
      const amounts = await publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName,
        args: [basketId, amount],
      });
      return { mode, amount, amounts };
    },
  });
  const currentQuote =
    quote.data?.mode === mode && quote.data.amount === amount ? quote.data : undefined;
  const quoteState =
    amount <= 0n
      ? "idle"
      : quote.isError
        ? "error"
        : quote.isFetching || quote.isPlaceholderData || !currentQuote
          ? "refreshing"
          : "ready";
  const baseAvailability =
    basket && mode !== "swap"
      ? deriveBasketActionAvailability({
          mode,
          amount,
          status: basket.status,
          quoteState,
          slippageBps,
          walletBalance: sourceBalance,
          constituents: basket.constituents,
          quoteAmounts: currentQuote?.amounts ?? null,
        })
      : null;
  const availability =
    baseAvailability &&
    mode === "redeem" &&
    conversionCollateral &&
    positions.data &&
    positions.data.currentBlock < conversionCollateral.withdrawableAfterBlock
      ? {
          kind: "blocked" as const,
          label: "Redeem unavailable",
          reason: "Basket collateral becomes redeemable in the next block.",
          executable: false,
        }
      : baseAvailability;

  const recordAndSend = async ({
    kind,
    label,
    to,
    data,
    validate,
  }: {
    kind: ProtocolActivityKind;
    label: string;
    to: Address;
    data: Hex;
    validate?: (result: Hex | undefined) => void;
  }) => {
    if (!wallet || !publicClient || !walletClient.data || deploymentState.status !== "configured") {
      throw new Error("The connected wallet is unavailable.");
    }
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deploymentState.deployment.chainId,
      kind,
      label,
      amount: `${amountInput || "0"} ${basket?.symbol || "BasketToken"}`,
      to,
      data,
      sendTransaction: ({ to: transactionTarget, data: transactionData, value }) =>
        walletClient.data!.sendTransaction({
          account: wallet,
          chain: walletClient.data!.chain,
          to: transactionTarget,
          data: transactionData,
          value,
        }),
      describeError: describeBasketError,
      validateSimulation: validate,
    });
  };

  const executeNextAction = async () => {
    if (!basket || !availability || deploymentState.status !== "configured") return;
    if (mode === "swap") return;
    setPending(true);
    setActionError(null);
    try {
      if (!wallet) throw new Error("Connect a wallet before using a basket.");
      if (!availability.executable || !currentQuote || slippageBps === null) {
        throw new Error(availability.reason || "Wait for a fresh basket quote.");
      }
      if (availability.kind === "approve" && availability.approvalIndex !== undefined) {
        const constituent = basket.constituents[availability.approvalIndex];
        const quoted = currentQuote.amounts[availability.approvalIndex];
        if (!constituent || quoted === undefined)
          throw new Error("The approval quote is incomplete.");
        await recordAndSend({
          kind: "approve-basket-asset",
          label: `Approve ${constituent.token.symbol}`,
          to: constituent.token.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [deploymentState.deployment.contracts.diamond, MAX_ERC20_ALLOWANCE],
          }),
        });
      } else if (availability.kind === "execute") {
        const refreshed = await quote.refetch();
        if (
          !refreshed.data ||
          refreshed.data.mode !== mode ||
          refreshed.data.amount !== amount ||
          refreshed.data.amounts.length !== basket.constituents.length
        ) {
          throw new Error("The basket quote could not be refreshed for the current input.");
        }
        const bounds =
          mode === "mint"
            ? refreshed.data.amounts.map((value) => maximumWithSlippage(value, slippageBps))
            : refreshed.data.amounts.map((value) => minimumWithSlippage(value, slippageBps));
        if (mode === "mint") {
          const refreshedCatalog = await catalog.refetch();
          const currentBasket = refreshedCatalog.data?.baskets.find(
            (candidate) => candidate.basketId === basketId
          );
          if (
            !currentBasket ||
            currentBasket.constituents.some(
              (constituent, index) =>
                constituent.walletBalance < (bounds[index] ?? 0n) ||
                constituent.allowance < (bounds[index] ?? 0n)
            )
          ) {
            throw new Error("The fresh quote requires another underlying approval.");
          }
        }
        // A minted basket held in the wallet earns nothing: rewards accrue
        // against a PositionNFT. So the default mints straight into one --
        // creating the position in the same call when there is not one yet --
        // and only an explicit opt-out leaves the shares in the wallet.
        const refreshedPositions = await positions.refetch();
        const targetPositionId = selectedPositionId(conversionSelection);
        const targetPosition =
          targetPositionId === null
            ? null
            : (refreshedPositions.data?.positions.find(
                (position) => position.positionId === targetPositionId
              ) ?? null);
        if (targetPositionId !== null && !targetPosition) {
          throw new Error("The selected position is no longer owned by this wallet.");
        }
        const collateralFunction =
          mode === "mint"
            ? conversionSelection === "new-position"
              ? ("createAndMintBasketCollateral" as const)
              : targetPosition
                ? ("mintBasketCollateral" as const)
                : null
            : targetPosition
              ? ("redeemBasketCollateral" as const)
              : null;

        let data: Hex;
        if (mode === "redeem" && targetPosition) {
          const freshCollateral = targetPosition.collateral.find(
            (collateral) => collateral.basket.basketId === basketId
          );
          if (!freshCollateral || unlockedCollateral(freshCollateral) < amount) {
            throw new Error("The selected position does not have enough unlocked BasketToken.");
          }
          if (
            refreshedPositions.data &&
            refreshedPositions.data.currentBlock < freshCollateral.withdrawableAfterBlock
          ) {
            throw new Error("Basket collateral becomes redeemable in the next block.");
          }
          data = buildRedeemBasketCollateralCall(
            targetPosition.positionId,
            basketId,
            amount,
            wallet,
            bounds
          );
        } else if (mode === "redeem") {
          data = buildRedeemCall(basketId, amount, wallet, bounds);
        } else if (collateralFunction === "mintBasketCollateral") {
          data = buildMintBasketCollateralCall(
            targetPosition!.positionId,
            basketId,
            amount,
            bounds
          );
        } else if (collateralFunction === "createAndMintBasketCollateral") {
          data = buildCreateAndMintBasketCollateralCall(basketId, amount, wallet, bounds);
        } else {
          data = buildMintCall(basketId, amount, wallet, bounds);
        }

        await recordAndSend({
          kind: mode === "mint" ? "mint-basket" : "redeem-basket",
          label:
            mode === "redeem"
              ? collateralFunction === "redeemBasketCollateral"
                ? `Redeem ${basket.symbol} from position`
                : `Redeem ${basket.symbol}`
              : collateralFunction
                ? `Buy and deposit ${basket.symbol}`
                : `Buy ${basket.symbol}`,
          to: deploymentState.deployment.contracts.diamond,
          data,
          validate: (result) =>
            void (collateralFunction
              ? validateBasketCollateralSimulation(
                  collateralFunction,
                  result,
                  basket.constituents.length
                )
              : validateBasketSimulation(mode, result, basket.constituents.length)),
        });
        setAmountInput("");
      }
      await Promise.all([catalog.refetch(), positions.refetch(), quote.refetch()]);
    } catch (error) {
      setActionError(describeBasketError(error));
    } finally {
      setPending(false);
    }
  };

  if (deploymentState.status === "unavailable") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject={t("singular")}
        empty={{ title: t("unavailable"), description: t("noData") }}
      />
    );
  }
  if ((catalog.isPending || catalog.isError) && !catalog.data) {
    return (
      <SurfaceEmptyState
        state={deriveSurfaceState({
          walletStatus: "ready",
          isTargetChain: true,
          isLoading: catalog.isPending,
          isError: catalog.isError,
          isEmpty: false,
          hasData: false,
        })}
        subject={t("singular")}
        onRetry={() => void catalog.refetch()}
        empty={{ title: t("unavailable"), description: t("noData") }}
      />
    );
  }
  if (!basket) {
    return (
      <EmptyState
        title={t("notFound")}
        description={t("notFoundDescription", { id: basketId.toString() })}
        action={{ label: t("browse"), href: "/app/baskets" }}
      />
    );
  }

  const quoteLabel =
    quoteState === "ready"
      ? t("currentQuote")
      : quote.data
        ? t("previousQuote", {
            amount: formatUnits(quote.data.amount, 18),
            symbol: basket.symbol,
          })
        : t("onchainQuote");
  const quoteAmounts = currentQuote?.amounts ?? quote.data?.amounts;
  let primaryLabel = availability?.label || t("review");
  let primaryAction: (() => void) | null = () => void executeNextAction();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    primaryLabel = t("signIn");
    primaryAction = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    primaryLabel = t("createWallet");
    primaryAction = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    primaryLabel = t("switchNetwork", { network: walletState.networkName });
    primaryAction = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    primaryLabel = t("walletLoading");
    primaryAction = null;
  }

  return (
    <div className="basket-detail">
      <Link className="basket-back" href="/app/baskets">
        ← {t("all")}
      </Link>
      <section className="basket-hero">
        <div>
          <p className="dapp-section-label">
            Basket #{basket.basketId.toString()} · {basketStatusLabel(basket.status)}
          </p>
          <h2>{basket.name}</h2>
          <p>
            {basket.symbol} · {shortAddress(basket.token.address)}
          </p>
        </div>
        <dl>
          <div>
            <dt>{t("totalSupply")}</dt>
            <dd>{displayAmount(basket.totalSupply)}</dd>
          </div>
          <div>
            <dt>{t("yourBalance")}</dt>
            <dd>{wallet ? displayAmount(basket.walletBalance) : t("connect")}</dd>
          </div>
          <div>
            <dt>{t("creator")}</dt>
            <dd title={basket.creator}>{shortAddress(basket.creator)}</dd>
          </div>
        </dl>
      </section>

      <div className="basket-detail-grid">
        <section className="basket-composition" aria-labelledby="basket-composition-title">
          <div className="basket-section-heading">
            <div>
              <p className="dapp-section-label">{t("staticComposition")}</p>
              <h3 id="basket-composition-title">
                {t("underlyingCount", { count: basket.constituents.length })}
              </h3>
            </div>
          </div>
          <ol>
            {basket.constituents.map((constituent, index) => (
              <li key={constituent.token.address}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{constituent.token.symbol}</strong>
                  <small title={constituent.token.address}>
                    {constituent.token.name} · {shortAddress(constituent.token.address)}
                  </small>
                  {!constituent.token.metadataAvailable && (
                    <small className="is-warning">{t("metadataUnavailable")}</small>
                  )}
                </div>
                <div>
                  <strong>
                    {displayAmount(constituent.bundleAmount, constituent.token.decimals)}
                  </strong>
                  <small>{t("perShare")}</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="dollar-warning">{t("tokenWarning", { symbol: basket.symbol })}</p>
        </section>

        <section className="basket-action-card" aria-labelledby="basket-action-title">
          <div className="dollar-tabs" aria-label={t("action")}>
            {(["mint", "redeem", "swap"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={mode === choice ? "active" : undefined}
                onClick={() => {
                  setMode(choice);
                  setActionError(null);
                }}
                disabled={pending}
              >
                {t(choice)}
              </button>
            ))}
          </div>
          {mode === "swap" ? (
            <BasketSwapPanel basket={basket} />
          ) : (
            <>
              <h3 id="basket-action-title">
                {mode === "mint" ? t("mintTitle") : t("redeemTitle")}
              </h3>
              <label className="basket-field">
                <span>{t("amount", { symbol: basket.symbol })}</span>
                <input
                  value={amountInput}
                  onChange={(event) => {
                    setAmountInput(event.target.value);
                    setActionError(null);
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={pending}
                />
              </label>
              <label className="basket-field">
                <span>{t("slippage")}</span>
                <div>
                  <input
                    value={slippageInput}
                    onChange={(event) => {
                      setSlippageInput(event.target.value);
                      setActionError(null);
                    }}
                    inputMode="decimal"
                    aria-describedby="basket-slippage-help"
                    disabled={pending}
                  />
                  <strong>%</strong>
                </div>
                <small id="basket-slippage-help">{t("slippageHelp")}</small>
              </label>
              <label className="basket-field">
                <span>{mode === "mint" ? t("receiveIn") : t("redeemFrom")}</span>
                <select
                  value={conversionSelection}
                  onChange={(event) => {
                    setSelectionOverride(event.target.value as BasketConversionSelection);
                    setActionError(null);
                  }}
                  disabled={pending || positions.isPending}
                >
                  <option value="wallet">
                    {t("wallet")}
                    {mode === "mint" ? ` · ${t("walletNoRewards")}` : ""}
                  </option>
                  {mode === "mint" && <option value="new-position">{t("newPosition")}</option>}
                  {(mode === "mint" ? ownedPositions : redeemablePositions).map((position) => (
                    <option
                      key={position.positionId.toString()}
                      value={positionSelection(position.positionId)}
                    >
                      {t("positionNumber", { id: position.positionId.toString() })}
                    </option>
                  ))}
                </select>
                <small>
                  {mode === "mint"
                    ? conversionSelection === "wallet"
                      ? t("walletMintHelp", { symbol: basket.symbol })
                      : conversionSelection === "new-position"
                        ? t("newPositionHelp")
                        : t("existingPositionHelp", {
                            id: conversionPositionId?.toString() ?? "",
                          })
                    : conversionPositionId === null
                      ? t("walletBurnHelp", { symbol: basket.symbol })
                      : t("positionBurnHelp", {
                          symbol: basket.symbol,
                          id: conversionPositionId.toString(),
                        })}
                </small>
              </label>
              <div className="basket-quote">
                <span>{quoteLabel}</span>
                {quoteAmounts ? (
                  <ul>
                    {quoteAmounts.map((value, index) => {
                      const constituent = basket.constituents[index];
                      return (
                        <li key={constituent?.token.address || index}>
                          <span>
                            {constituent?.token.symbol || t("leg", { number: index + 1 })}
                          </span>
                          <strong>{displayAmount(value, constituent?.token.decimals ?? 18)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <strong>{t("enterAmount")}</strong>
                )}
                <small>{mode === "mint" ? t("mintProtection") : t("redeemProtection")}</small>
              </div>
              {availability?.reason && (
                <p className="dollar-action-reason">{availability.reason}</p>
              )}
              {actionError && (
                <p className="dapp-inline-error" role="alert">
                  {actionError}
                </p>
              )}
              <button
                className="dollar-submit"
                type="button"
                onClick={primaryAction ?? undefined}
                disabled={
                  pending ||
                  primaryAction === null ||
                  (walletState.status === "ready" &&
                    walletState.isTargetChain &&
                    !availability?.executable)
                }
              >
                {pending ? t("waiting") : primaryLabel}
              </button>
            </>
          )}
        </section>
      </div>

      <section className="basket-parameters" aria-labelledby="basket-parameters-title">
        <div className="basket-section-heading">
          <div>
            <p className="dapp-section-label">{t("configuration")}</p>
            <h3 id="basket-parameters-title">{t("parameters")}</h3>
          </div>
        </div>
        <dl>
          <div>
            <dt>{t("mintTiers")}</dt>
            <dd>{feeTierLabel(basket.mintFeeTiers, (key, values) => t(key, values))}</dd>
          </div>
          <div>
            <dt>{t("redemptionTiers")}</dt>
            <dd>{feeTierLabel(basket.redemptionFeeTiers, (key, values) => t(key, values))}</dd>
          </div>
          <div>
            <dt>{t("flashFee")}</dt>
            <dd>{(basket.flashFeeBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>{t("originationFee")}</dt>
            <dd>{(basket.originationFeeBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>{t("extensionFee")}</dt>
            <dd>{(basket.extensionFeeBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>{t("maximumLtv")}</dt>
            <dd>{(basket.ltvBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>{t("loanDuration")}</dt>
            <dd>{t("days", { count: Math.floor(basket.loanDuration / 86_400) })}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
