"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useMemo, useState } from "react";

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

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals = 18, precision = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function feeTierLabel(tiers: BasketRecord["mintFeeTiers"]): string {
  if (tiers.length === 0) return "No configured tier";
  return tiers
    .map(
      (tier) =>
        `${displayAmount(tier.feeShares)} shares from ${displayAmount(tier.minActionShares)}`
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
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Basket" />;
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
      return amountInput ? parseUnits(amountInput, 18) : 0n;
    } catch {
      return 0n;
    }
  }, [amountInput]);
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
        subject="basket"
        empty={{ title: "Basket unavailable", description: "No basket data is available." }}
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
        subject="basket"
        onRetry={() => void catalog.refetch()}
        empty={{ title: "Basket unavailable", description: "No basket data is available." }}
      />
    );
  }
  if (!basket) {
    return (
      <EmptyState
        title="Basket not found"
        description={`Basket #${basketId.toString()} is not part of this verified deployment.`}
        action={{ label: "Browse baskets", href: "/app/baskets" }}
      />
    );
  }

  const quoteLabel =
    quoteState === "ready"
      ? "Current onchain quote"
      : quote.data
        ? `Previous quote · ${formatUnits(quote.data.amount, 18)} ${basket.symbol}`
        : "Onchain quote";
  const quoteAmounts = currentQuote?.amounts ?? quote.data?.amounts;
  let primaryLabel = availability?.label || "Review basket";
  let primaryAction: (() => void) | null = () => void executeNextAction();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    primaryLabel = "Sign in to continue";
    primaryAction = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    primaryLabel = "Create embedded wallet";
    primaryAction = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    primaryLabel = `Switch to ${walletState.networkName}`;
    primaryAction = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    primaryLabel = "Wallet loading…";
    primaryAction = null;
  }

  return (
    <div className="basket-detail">
      <Link className="basket-back" href="/app/baskets">
        ← All baskets
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
            <dt>Total supply</dt>
            <dd>{displayAmount(basket.totalSupply)}</dd>
          </div>
          <div>
            <dt>Your balance</dt>
            <dd>{wallet ? displayAmount(basket.walletBalance) : "Connect"}</dd>
          </div>
          <div>
            <dt>Creator</dt>
            <dd title={basket.creator}>{shortAddress(basket.creator)}</dd>
          </div>
        </dl>
      </section>

      <div className="basket-detail-grid">
        <section className="basket-composition" aria-labelledby="basket-composition-title">
          <div className="basket-section-heading">
            <div>
              <p className="dapp-section-label">Static composition</p>
              <h3 id="basket-composition-title">{basket.constituents.length} underlyings</h3>
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
                    <small className="is-warning">
                      Token metadata unavailable; address is authoritative.
                    </small>
                  )}
                </div>
                <div>
                  <strong>
                    {displayAmount(constituent.bundleAmount, constituent.token.decimals)}
                  </strong>
                  <small>per basket share</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="dollar-warning">
            Underlyings may implement transfer fees, rebasing, unusual approvals, or other
            nonstandard behavior. Review every token address. Holding {basket.symbol} does not earn
            basket-specific fees.
          </p>
        </section>

        <section className="basket-action-card" aria-labelledby="basket-action-title">
          <div className="dollar-tabs" aria-label="Basket action">
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
                {choice}
              </button>
            ))}
          </div>
          {mode === "swap" ? (
            <BasketSwapPanel basket={basket} />
          ) : (
            <>
              <h3 id="basket-action-title">{mode === "mint" ? "Mint basket" : "Redeem basket"}</h3>
              <label className="basket-field">
                <span>{basket.symbol} amount</span>
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
                <span>Slippage tolerance</span>
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
                <small id="basket-slippage-help">Allowed range 0–5%. Default 0.50%.</small>
              </label>
              <label className="basket-field">
                <span>{mode === "mint" ? "Receive basket in" : "Redeem basket from"}</span>
                <select
                  value={conversionSelection}
                  onChange={(event) => {
                    setSelectionOverride(event.target.value as BasketConversionSelection);
                    setActionError(null);
                  }}
                  disabled={pending || positions.isPending}
                >
                  <option value="wallet">
                    Wallet{mode === "mint" ? " · does not earn basket rewards" : ""}
                  </option>
                  {mode === "mint" && <option value="new-position">New earning position</option>}
                  {(mode === "mint" ? ownedPositions : redeemablePositions).map((position) => (
                    <option
                      key={position.positionId.toString()}
                      value={positionSelection(position.positionId)}
                    >
                      Position #{position.positionId.toString()}
                    </option>
                  ))}
                </select>
                <small>
                  {mode === "mint"
                    ? conversionSelection === "wallet"
                      ? `The ${basket.symbol} remains liquid in your wallet and earns no basket rewards.`
                      : conversionSelection === "new-position"
                        ? "Creates a PositionNFT and deposits the minted basket in the same transaction."
                        : `Mints directly into Position #${conversionPositionId?.toString()} so it can earn selected rewards.`
                    : conversionPositionId === null
                      ? `Burns ${basket.symbol} held in your wallet.`
                      : `Burns unlocked ${basket.symbol} collateral from Position #${conversionPositionId.toString()}.`}
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
                          <span>{constituent?.token.symbol || `Leg ${index + 1}`}</span>
                          <strong>{displayAmount(value, constituent?.token.decimals ?? 18)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <strong>Enter an amount for a fresh quote</strong>
                )}
                <small>
                  {mode === "mint"
                    ? "Approvals use the displayed caller-side maximums."
                    : "Redemption enforces receiver-side minimum outputs."}
                </small>
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
                {pending ? "Waiting for confirmation…" : primaryLabel}
              </button>
            </>
          )}
        </section>
      </div>

      <section className="basket-parameters" aria-labelledby="basket-parameters-title">
        <div className="basket-section-heading">
          <div>
            <p className="dapp-section-label">Current configuration</p>
            <h3 id="basket-parameters-title">Fees and lending parameters</h3>
          </div>
        </div>
        <dl>
          <div>
            <dt>Mint tiers</dt>
            <dd>{feeTierLabel(basket.mintFeeTiers)}</dd>
          </div>
          <div>
            <dt>Redemption tiers</dt>
            <dd>{feeTierLabel(basket.redemptionFeeTiers)}</dd>
          </div>
          <div>
            <dt>Flash fee</dt>
            <dd>{(basket.flashFeeBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>Origination fee</dt>
            <dd>{(basket.originationFeeBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>Extension fee</dt>
            <dd>{(basket.extensionFeeBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>Maximum LTV</dt>
            <dd>{(basket.ltvBps / 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>Loan duration</dt>
            <dd>{Math.floor(basket.loanDuration / 86_400)} days</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
