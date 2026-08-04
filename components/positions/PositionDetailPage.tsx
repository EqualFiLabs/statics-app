"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  basketTokenAbi,
  buildClosePositionCall,
  buildDepositBasketCollateralCall,
  buildOptInRewardAssetsCall,
  buildOptOutRewardAssetsCall,
  buildStakeCall,
  buildUnstakeCall,
  buildWithdrawBasketCollateralCall,
} from "@statics-protocol/sdk";

import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  canClosePosition,
  describePositionError,
  loadPositionCatalog,
  unlockedCollateral,
  validateCustomRewardAsset,
} from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { useWalletState } from "@/providers/wallet-context";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { PositionCollateralSummary } from "@/components/positions/PositionCollateralSummary";
import { EmptyState, SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { deriveSurfaceState } from "@/lib/surface-state";
import { useAppLocale } from "@/i18n/client";
import type { AppLocale } from "@/i18n/config";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

const deploymentState = readClientDollarDeployment();

type CollateralMode = "deposit" | "withdraw";

function displayAmount(value: bigint, decimals = 18, precision = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function parseAmount(value: string, decimals: number, locale: AppLocale): bigint {
  try {
    return parseLocalizedUnits(value, decimals, locale);
  } catch {
    return 0n;
  }
}

export function PositionDetailPage({ positionId }: { positionId: bigint }) {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Position" />;
  return <PositionDetailRuntime positionId={positionId} />;
}

function PositionDetailRuntime({ positionId }: { positionId: bigint }) {
  const t = useTranslations("positionDetail");
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [collateralMode, setCollateralMode] = useState<CollateralMode>("deposit");
  const [basketIdInput, setBasketIdInput] = useState("0");
  const [collateralAmountInput, setCollateralAmountInput] = useState("");
  const [stakeMode, setStakeMode] = useState<"stake" | "unstake">("stake");
  const [stakeAmountInput, setStakeAmountInput] = useState("");
  const [customRewardAddress, setCustomRewardAddress] = useState("");

  const catalog = useQuery({
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
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadPositionCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });
  const position = catalog.data?.positions.find((candidate) => candidate.positionId === positionId);
  const basket = catalog.data?.baskets.find(
    (candidate) => candidate.basketId.toString() === basketIdInput
  );
  const existingCollateral = position?.collateral.find(
    (item) => item.basket.basketId === basket?.basketId
  );
  const collateralAmount = useMemo(
    () => parseAmount(collateralAmountInput, 18, locale),
    [collateralAmountInput, locale]
  );
  const stakeAmount = useMemo(
    () => parseAmount(stakeAmountInput, catalog.data?.stakingToken.decimals ?? 18, locale),
    [stakeAmountInput, catalog.data?.stakingToken.decimals, locale]
  );
  const sendTransaction = async ({
    kind,
    label,
    amount,
    to,
    data,
    value,
    validateSimulation,
    verifyConfirmation,
  }: {
    kind: Parameters<typeof executeProtocolTransaction>[0]["kind"];
    label: string;
    amount: string;
    to: Address;
    data: Hex;
    value?: bigint;
    validateSimulation?: (result: Hex | undefined) => void;
    verifyConfirmation?: (receipt: TransactionReceipt) => Promise<void>;
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
      amount,
      to,
      data,
      value,
      sendTransaction: ({ to: target, data: transactionData, value: transactionValue }) =>
        walletClient.data.sendTransaction({
          account: wallet,
          chain: walletClient.data.chain,
          to: target,
          data: transactionData,
          value: transactionValue,
        }),
      describeError: describePositionError,
      validateSimulation,
      verifyConfirmation,
    });
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setPendingAction(key);
    setActionError(null);
    try {
      await action();
      await catalog.refetch();
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setPendingAction(null);
    }
  };

  const executeCollateralAction = async () => {
    if (
      !position ||
      !basket ||
      !catalog.data ||
      collateralAmount <= 0n ||
      deploymentState.status !== "configured" ||
      !publicClient ||
      !wallet
    ) {
      throw new Error("Choose a basket and enter a valid share amount.");
    }
    const amountLabel = `${collateralAmountInput} ${basket.symbol}`;
    const diamond = deploymentState.deployment.contracts.diamond;

    if (collateralMode === "deposit") {
      if (basket.walletBalance < collateralAmount) {
        throw new Error("The wallet does not hold enough BasketToken.");
      }
      const allowance = catalog.data.basketTokenAllowances[basket.basketId.toString()] ?? 0n;
      if (allowance < collateralAmount) {
        await sendTransaction({
          kind: "approve-basket-token",
          label: `Approve ${basket.symbol}`,
          amount: amountLabel,
          to: basket.token.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [diamond, MAX_ERC20_ALLOWANCE],
          }),
        });
        return;
      }
      await sendTransaction({
        kind: "deposit-basket-collateral",
        label: `Deposit ${basket.symbol} collateral`,
        amount: amountLabel,
        to: diamond,
        data: buildDepositBasketCollateralCall(
          position.positionId,
          basket.basketId,
          collateralAmount
        ),
      });
      setCollateralAmountInput("");
      return;
    }

    if (!existingCollateral || unlockedCollateral(existingCollateral) < collateralAmount) {
      throw new Error("The position does not have enough unlocked basket collateral.");
    }
    if (catalog.data.currentBlock < existingCollateral.withdrawableAfterBlock) {
      throw new Error("Basket collateral becomes removable in the next block.");
    }

    await sendTransaction({
      kind: "withdraw-basket-collateral",
      label: `Withdraw ${basket.symbol} collateral`,
      amount: amountLabel,
      to: diamond,
      data: buildWithdrawBasketCollateralCall(
        position.positionId,
        basket.basketId,
        collateralAmount,
        wallet
      ),
    });
    setCollateralAmountInput("");
  };

  const executeStakeAction = async () => {
    if (
      !position ||
      !catalog.data ||
      stakeAmount <= 0n ||
      deploymentState.status !== "configured"
    ) {
      throw new Error("Enter a valid staking amount.");
    }
    const token = catalog.data.stakingToken;
    const amountLabel = `${stakeAmountInput} ${token.symbol}`;
    const diamond = deploymentState.deployment.contracts.diamond;
    if (stakeMode === "stake") {
      if (catalog.data.stakingTokenBalance < stakeAmount) {
        throw new Error(`The wallet does not hold enough ${token.symbol}.`);
      }
      if (catalog.data.stakingTokenAllowance < stakeAmount) {
        await sendTransaction({
          kind: "approve-staking-token",
          label: `Approve ${token.symbol} for staking`,
          amount: amountLabel,
          to: token.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [diamond, MAX_ERC20_ALLOWANCE],
          }),
        });
        return;
      }
      await sendTransaction({
        kind: "stake-position",
        label: `Stake ${token.symbol}`,
        amount: amountLabel,
        to: diamond,
        data: buildStakeCall(position.positionId, stakeAmount),
      });
    } else {
      if (position.stakedBalance < stakeAmount) {
        throw new Error("The position does not contain that much stake.");
      }
      await sendTransaction({
        kind: "unstake-position",
        label: `Unstake ${token.symbol}`,
        amount: amountLabel,
        to: diamond,
        data: buildUnstakeCall(position.positionId, stakeAmount, position.owner),
      });
    }
    setStakeAmountInput("");
  };

  const changeRewardSelection = async (asset: Address, selected: boolean) => {
    if (!position || deploymentState.status !== "configured") return;
    const candidate = catalog.data?.rewardCandidates.find((item) => item.token.address === asset);
    await sendTransaction({
      kind: selected ? "opt-out-reward-assets" : "opt-in-reward-assets",
      label: `${selected ? "Remove" : "Select"} ${candidate?.token.symbol || "reward asset"}`,
      amount: candidate?.token.symbol || asset,
      to: deploymentState.deployment.contracts.diamond,
      data: selected
        ? buildOptOutRewardAssetsCall(position.positionId, [asset])
        : buildOptInRewardAssetsCall(position.positionId, [asset]),
    });
  };

  const addCustomReward = async () => {
    if (!position || !publicClient || !catalog.data || deploymentState.status !== "configured") {
      return;
    }
    const metadata = await validateCustomRewardAsset(
      publicClient,
      customRewardAddress,
      position.selectedRewardAssets,
      catalog.data.maximumRewardAssets
    );
    await sendTransaction({
      kind: "opt-in-reward-assets",
      label: `Select ${metadata.symbol}`,
      amount: metadata.symbol,
      to: deploymentState.deployment.contracts.diamond,
      data: buildOptInRewardAssetsCall(position.positionId, [metadata.address]),
    });
    setCustomRewardAddress("");
  };

  if (deploymentState.status === "unavailable") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject="position"
        empty={{ title: "Position unavailable", description: "No deployment is configured." }}
      />
    );
  }
  const detailState = deriveSurfaceState({
    walletStatus: walletState.status,
    isTargetChain: walletState.isTargetChain,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    isEmpty: false,
    hasData: Boolean(catalog.data),
  });
  if (detailState !== "ready") {
    return (
      <SurfaceEmptyState
        state={detailState}
        subject="position"
        onRetry={() => void catalog.refetch()}
        empty={{ title: "Position unavailable", description: "No position data is available." }}
      />
    );
  }
  if (!position || !catalog.data) {
    return (
      <EmptyState
        title="Position not found"
        description={`Position #${positionId.toString()} is not owned by the connected wallet.`}
        action={{ label: "View your positions", href: "/app/positions" }}
      />
    );
  }

  const closeReady = canClosePosition(position);

  return (
    <div className="position-detail">
      <Link className="basket-back" href="/app/positions">
        ← {t("allPositions")}
      </Link>
      <section className="position-hero">
        <div>
          <p className="dapp-section-label">{t("yourPosition")}</p>
          <h2>Position #{position.positionId.toString()}</h2>
          <AddressDisplay
            address={position.owner}
            chainId={deploymentState.deployment.chainId}
            label={t("owner")}
          />
        </div>
        <dl>
          <div>
            <dt>{t("activeLegs")}</dt>
            <dd>{position.activeLegCount.toString()}</dd>
          </div>
          <div>
            <dt>{t("basketLegs")}</dt>
            <dd>{position.collateral.length}</dd>
          </div>
          <div>
            <dt>{t("rewardAssets")}</dt>
            <dd>
              {position.selectedRewardAssets.length}/{catalog.data.maximumRewardAssets.toString()}
            </dd>
          </div>
        </dl>
      </section>

      {position.unresolvedObligationCount > 0n && (
        <p className="dollar-warning">
          {t("unresolvedObligations", {
            count: position.unresolvedObligationCount.toString(),
          })}
        </p>
      )}

      <p className="dollar-warning">{t("transferWarning")}</p>

      <PositionCollateralSummary
        collateral={position.collateral}
        currentBlock={catalog.data.currentBlock}
      />

      <div className="position-detail-grid">
        <section className="position-panel">
          <p className="dapp-section-label">{t("basketCollateral")}</p>
          <h3>{t("manageCollateral")}</h3>
          <div className="dollar-tabs" aria-label={t("collateralAction")}>
            {(["deposit", "withdraw"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={collateralMode === mode ? "active" : undefined}
                onClick={() => {
                  setCollateralMode(mode);
                  setActionError(null);
                }}
                disabled={pendingAction !== null}
              >
                {mode === "deposit" ? t("deposit") : t("withdraw")}
              </button>
            ))}
          </div>
          <label className="basket-field">
            <span>{t("basket")}</span>
            <select
              value={basketIdInput}
              onChange={(event) => setBasketIdInput(event.target.value)}
              disabled={pendingAction !== null}
            >
              {catalog.data.baskets.map((item) => (
                <option key={item.basketId.toString()} value={item.basketId.toString()}>
                  #{item.basketId.toString()} · {item.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="basket-field">
            <span>{basket?.symbol || "BasketToken"} shares</span>
            <input
              value={collateralAmountInput}
              onChange={(event) => {
                setCollateralAmountInput(event.target.value);
                setActionError(null);
              }}
              inputMode="decimal"
              placeholder="0.00"
              disabled={pendingAction !== null}
            />
            <small>
              Wallet: {basket ? displayAmount(basket.walletBalance) : "0"} · Position unlocked:{" "}
              {existingCollateral ? displayAmount(unlockedCollateral(existingCollateral)) : "0"}
            </small>
          </label>
          <button
            className="dollar-submit"
            type="button"
            disabled={pendingAction !== null || collateralAmount <= 0n || !basket}
            onClick={() => void runAction(`collateral-${collateralMode}`, executeCollateralAction)}
          >
            {pendingAction === `collateral-${collateralMode}`
              ? t("waiting")
              : collateralMode === "deposit"
                ? t("approveDeposit")
                : t("withdrawBasket")}
          </button>
          {basket && (
            <div className="position-action-links">
              <Link
                className="dollar-primary-link"
                href={`/app/baskets/${basket.basketId.toString()}?action=mint&positionId=${position.positionId.toString()}`}
              >
                {t("mintInto", { symbol: basket.symbol })} →
              </Link>
              <Link
                className="dollar-primary-link"
                href={`/app/baskets/${basket.basketId.toString()}?action=redeem&positionId=${position.positionId.toString()}`}
              >
                {t("redeemFrom", { symbol: basket.symbol })} →
              </Link>
            </div>
          )}
        </section>

        <section className="position-panel">
          <p className="dapp-section-label">{t("globalStaking")}</p>
          <h3>{t("stakeToken", { symbol: catalog.data.stakingToken.symbol })}</h3>
          <div className="dollar-tabs" aria-label={t("stakingAction")}>
            {(["stake", "unstake"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={stakeMode === mode ? "active" : undefined}
                onClick={() => {
                  setStakeMode(mode);
                  setActionError(null);
                }}
                disabled={pendingAction !== null}
              >
                {mode === "stake" ? t("stake") : t("unstake")}
              </button>
            ))}
          </div>
          <dl className="position-metrics">
            <div>
              <dt>{t("walletBalance")}</dt>
              <dd>
                {displayAmount(
                  catalog.data.stakingTokenBalance,
                  catalog.data.stakingToken.decimals
                )}{" "}
                {catalog.data.stakingToken.symbol}
              </dd>
            </div>
            <div>
              <dt>{t("positionStake")}</dt>
              <dd>
                {displayAmount(position.stakedBalance, catalog.data.stakingToken.decimals)}{" "}
                {catalog.data.stakingToken.symbol}
              </dd>
            </div>
          </dl>
          <label className="basket-field">
            <span>{catalog.data.stakingToken.symbol} amount</span>
            <input
              value={stakeAmountInput}
              onChange={(event) => {
                setStakeAmountInput(event.target.value);
                setActionError(null);
              }}
              inputMode="decimal"
              placeholder="0.00"
              disabled={pendingAction !== null}
            />
          </label>
          <p className="position-cooldown">{t("maturityDescription")}</p>
          <button
            className="dollar-submit"
            type="button"
            disabled={pendingAction !== null || stakeAmount <= 0n}
            onClick={() => void runAction(`stake-${stakeMode}`, executeStakeAction)}
          >
            {pendingAction === `stake-${stakeMode}`
              ? t("waiting")
              : stakeMode === "stake"
                ? t("approveStake", { symbol: catalog.data.stakingToken.symbol })
                : t("unstakeToken", { symbol: catalog.data.stakingToken.symbol })}
          </button>
        </section>
      </div>

      <section className="position-panel position-rewards">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("selectedRewards")}</p>
            <h3>{t("chooseAssets", { count: catalog.data.maximumRewardAssets.toString() })}</h3>
          </div>
          <span>{t("selectedCount", { count: position.selectedRewardAssets.length })}</span>
        </div>
        <div className="reward-grid">
          {catalog.data.rewardCandidates.map((candidate) => {
            const selected = position.selectedRewardAssets.includes(candidate.token.address);
            const reward = position.rewards.find(
              (item) => item.token.address === candidate.token.address
            );
            return (
              <article
                key={candidate.token.address}
                className={selected ? "is-selected" : undefined}
              >
                <div>
                  <strong>{candidate.token.symbol}</strong>
                  <span>{candidate.sources.join(" · ")}</span>
                </div>
                <AddressDisplay
                  address={candidate.token.address}
                  chainId={deploymentState.deployment.chainId}
                  label={t("token")}
                />
                <p>
                  Pending: {displayAmount(reward?.pending ?? 0n, candidate.token.decimals)}{" "}
                  {candidate.token.symbol}
                </p>
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void runAction(`reward-${candidate.token.address}`, () =>
                      changeRewardSelection(candidate.token.address, selected)
                    )
                  }
                >
                  {pendingAction === `reward-${candidate.token.address}`
                    ? t("waitingShort")
                    : selected
                      ? t("removeSelection")
                      : t("selectReward")}
                </button>
              </article>
            );
          })}
        </div>
        <div className="custom-reward">
          <label className="basket-field">
            <span>{t("customReward")}</span>
            <input
              value={customRewardAddress}
              onChange={(event) => {
                setCustomRewardAddress(event.target.value);
                setActionError(null);
              }}
              placeholder="0x…"
              autoComplete="off"
              disabled={pendingAction !== null}
            />
            <small>{t("customRewardHelp")}</small>
          </label>
          <button
            className="dollar-submit"
            type="button"
            disabled={pendingAction !== null || customRewardAddress.length === 0}
            onClick={() => void runAction("custom-reward", addCustomReward)}
          >
            {pendingAction === "custom-reward" ? t("waiting") : t("selectAddress")}
          </button>
        </div>
        <p className="dollar-warning">{t("historicalWarning")}</p>
        <Link
          className="dollar-primary-link"
          href={`/app/rewards?positionId=${position.positionId.toString()}`}
        >
          {t("viewRewards")} →
        </Link>
      </section>

      {actionError && (
        <p className="dapp-inline-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="position-close">
        <div>
          <p className="dapp-section-label">{t("terminalAction")}</p>
          <h3>{t("closePosition")}</h3>
          <p>
            {closeReady
              ? t("closeReady")
              : t("closeBlocked", {
                  legs: position.activeLegCount.toString(),
                  obligations: position.unresolvedObligationCount.toString(),
                })}
          </p>
        </div>
        <button
          type="button"
          disabled={pendingAction !== null || !closeReady}
          onClick={() =>
            void runAction("close-position", async () => {
              await sendTransaction({
                kind: "close-position",
                label: `Close position #${position.positionId.toString()}`,
                amount: `Position #${position.positionId.toString()}`,
                to: deploymentState.deployment.contracts.diamond,
                data: buildClosePositionCall(position.positionId),
              });
            })
          }
        >
          {pendingAction === "close-position" ? t("closing") : t("closePosition")}
        </button>
      </section>
    </div>
  );
}
