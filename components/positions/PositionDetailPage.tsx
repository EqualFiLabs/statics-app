"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  buildCheckpointRewardAssetsCall,
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
  loadConfirmedRewardSelections,
  loadPositionCatalog,
  unlockedCollateral,
  validateCustomRewardAsset,
  type RewardCandidate,
} from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { useWalletState } from "@/providers/wallet-context";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { AmountPercentageSlider } from "@/components/protocol/PercentageSlider";
import { PositionCollateralSummary } from "@/components/positions/PositionCollateralSummary";
import { RewardSelectionEditor } from "@/components/positions/RewardSelectionEditor";
import { EmptyState, SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { deriveSurfaceState } from "@/lib/surface-state";
import { useAppLocale } from "@/i18n/client";
import type { AppLocale } from "@/i18n/config";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { applyPercent } from "@/lib/protocol/ux";
import {
  checkpointRewardAssetBatches,
  rewardAssetsNeedingCheckpoint,
  rewardSelectionActionPlan,
  rewardSelectionChanges,
  toggleRewardSelection,
} from "@/lib/positions/staking";

const deploymentState = readClientDollarDeployment();

type CollateralMode = "deposit" | "withdraw";

type RewardSelectionDraft = Readonly<{
  key: string;
  assets: readonly Address[];
  customCandidates: readonly RewardCandidate[];
}>;

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
  const queryClient = useQueryClient();
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
  const [rewardSelectionDraft, setRewardSelectionDraft] = useState<RewardSelectionDraft | null>(
    null
  );

  const catalogQueryKey = protocolQueryKeys.positionCatalog(
    deploymentState.status === "configured" ? deploymentState.deployment.protocolCommit : undefined,
    wallet
  );
  const catalog = useQuery({
    queryKey: catalogQueryKey,
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadPositionCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });
  const position = catalog.data?.positions.find((candidate) => candidate.positionId === positionId);
  const rewardDraftKey = `${wallet ?? "disconnected"}:${positionId.toString()}`;
  const activeRewardDraft =
    rewardSelectionDraft?.key === rewardDraftKey ? rewardSelectionDraft : null;
  const draftRewardAssets = activeRewardDraft?.assets ?? position?.selectedRewardAssets ?? [];
  const rewardChanges = rewardSelectionChanges(
    position?.selectedRewardAssets ?? [],
    draftRewardAssets
  );
  const rewardChangeCount = rewardChanges.additions.length + rewardChanges.removals.length;
  const displayedRewardCandidates = useMemo(() => {
    const candidates = [...(catalog.data?.rewardCandidates ?? [])];
    const known = new Set(candidates.map((candidate) => candidate.token.address));
    for (const candidate of activeRewardDraft?.customCandidates ?? []) {
      if (!known.has(candidate.token.address)) candidates.push(candidate);
    }
    return candidates.sort((left, right) => left.token.symbol.localeCompare(right.token.symbol));
  }, [activeRewardDraft?.customCandidates, catalog.data?.rewardCandidates]);
  const basket = catalog.data?.baskets.find(
    (candidate) => candidate.basketId.toString() === basketIdInput
  );
  const existingCollateral = position?.collateral.find(
    (item) => item.basket.basketId === basket?.basketId
  );
  const collateralAvailable =
    collateralMode === "deposit"
      ? (basket?.walletBalance ?? 0n)
      : existingCollateral
        ? unlockedCollateral(existingCollateral)
        : 0n;
  const stakingAvailable =
    stakeMode === "stake"
      ? (catalog.data?.stakingTokenBalance ?? 0n)
      : (position?.stakedBalance ?? 0n);
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
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describePositionError,
      validateSimulation,
      verifyConfirmation,
    });
  };

  const runAction = async (key: string, action: () => Promise<void>, refreshCatalog = true) => {
    setPendingAction(key);
    setActionError(null);
    try {
      await action();
      if (refreshCatalog) await catalog.refetch();
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setPendingAction(null);
    }
  };

  const verifyRewardSelections = async (
    receipt: TransactionReceipt,
    expectedSelected: readonly Address[],
    expectedUnselected: readonly Address[]
  ) => {
    if (!publicClient || !wallet || deploymentState.status !== "configured") {
      throw new Error("The connected PositionNFT is unavailable.");
    }
    const confirmedCatalog = await loadConfirmedRewardSelections(
      publicClient,
      deploymentState.deployment,
      wallet,
      positionId,
      expectedSelected,
      expectedUnselected,
      receipt.blockNumber
    );
    queryClient.setQueryData(catalogQueryKey, confirmedCatalog);
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
    const checkpoint = async (assets: readonly Address[]) => {
      const required = await rewardAssetsNeedingCheckpoint(
        publicClient!,
        deploymentState.deployment,
        assets
      );
      for (const batch of checkpointRewardAssetBatches(required)) {
        await sendTransaction({
          kind: "checkpoint-rewards",
          label: `Checkpoint ${batch.length} reward asset${batch.length === 1 ? "" : "s"}`,
          amount: `${batch.length} assets`,
          to: diamond,
          data: buildCheckpointRewardAssetsCall(batch),
        });
      }
    };
    await checkpoint(position.selectedRewardAssets);
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

  const updateRewardSelectionDraft = (
    assets: readonly Address[],
    customCandidates = activeRewardDraft?.customCandidates ?? []
  ) => {
    if (!position || !catalog.data) return;
    const changes = rewardSelectionChanges(position.selectedRewardAssets, assets);
    if (changes.additions.length === 0 && changes.removals.length === 0) {
      setRewardSelectionDraft(null);
      return;
    }
    const selected = new Set(assets);
    setRewardSelectionDraft({
      key: rewardDraftKey,
      assets,
      customCandidates: customCandidates.filter((candidate) =>
        selected.has(candidate.token.address)
      ),
    });
  };

  const stageRewardSelection = (asset: Address) => {
    if (!catalog.data) return;
    try {
      updateRewardSelectionDraft(
        toggleRewardSelection(draftRewardAssets, asset, catalog.data.maximumRewardAssets)
      );
      setActionError(null);
    } catch (error) {
      setActionError(describePositionError(error));
    }
  };

  const saveRewardSelections = async () => {
    if (!position || !catalog.data || !publicClient || deploymentState.status !== "configured") {
      throw new Error("The connected PositionNFT is unavailable.");
    }
    if (!activeRewardDraft) {
      throw new Error("Choose at least one reward selection change.");
    }
    const changes = rewardSelectionChanges(position.selectedRewardAssets, activeRewardDraft.assets);
    if (changes.additions.length === 0 && changes.removals.length === 0) return;

    const diamond = deploymentState.deployment.contracts.diamond;
    let completed = false;
    try {
      const required = await rewardAssetsNeedingCheckpoint(
        publicClient,
        deploymentState.deployment,
        [...changes.removals, ...changes.additions]
      );
      for (const batch of checkpointRewardAssetBatches(required)) {
        await sendTransaction({
          kind: "checkpoint-rewards",
          label: `Checkpoint ${batch.length} reward asset${batch.length === 1 ? "" : "s"}`,
          amount: `${batch.length} assets`,
          to: diamond,
          data: buildCheckpointRewardAssetsCall(batch),
        });
      }
      for (const action of rewardSelectionActionPlan(
        position.selectedRewardAssets,
        activeRewardDraft.assets
      )) {
        const adding = action.kind === "add";
        await sendTransaction({
          kind: adding ? "opt-in-reward-assets" : "opt-out-reward-assets",
          label: `${adding ? "Select" : "Remove"} ${action.assets.length} reward asset${action.assets.length === 1 ? "" : "s"}`,
          amount: `${action.assets.length} assets`,
          to: diamond,
          data: adding
            ? buildOptInRewardAssetsCall(position.positionId, action.assets)
            : buildOptOutRewardAssetsCall(position.positionId, action.assets),
          verifyConfirmation: (receipt) =>
            verifyRewardSelections(
              receipt,
              adding ? action.assets : [],
              adding ? changes.removals : action.assets
            ),
        });
      }
      completed = true;
    } finally {
      await catalog.refetch();
      if (completed) {
        setRewardSelectionDraft((current) => (current?.key === rewardDraftKey ? null : current));
      }
    }
  };

  const addCustomReward = async () => {
    if (!position || !publicClient || !catalog.data || deploymentState.status !== "configured") {
      return;
    }
    const metadata = await validateCustomRewardAsset(
      publicClient,
      customRewardAddress,
      draftRewardAssets,
      catalog.data.maximumRewardAssets
    );
    const nextAssets = toggleRewardSelection(
      draftRewardAssets,
      metadata.address,
      catalog.data.maximumRewardAssets
    );
    updateRewardSelectionDraft(nextAssets, [
      ...(activeRewardDraft?.customCandidates ?? []).filter(
        (candidate) => candidate.token.address !== metadata.address
      ),
      { token: metadata, sources: [t("customSource")] },
    ]);
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
            {basket && (
              <AmountPercentageSlider
                amount={collateralAmount}
                maximum={collateralAvailable}
                disabled={pendingAction !== null}
                label={t("amountShortcuts")}
                onSelect={(percent) => {
                  setCollateralAmountInput(
                    formatUnits(applyPercent(collateralAvailable, percent), basket.token.decimals)
                  );
                  setActionError(null);
                }}
              />
            )}
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
            <AmountPercentageSlider
              amount={stakeAmount}
              maximum={stakingAvailable}
              disabled={pendingAction !== null}
              label={t("amountShortcuts")}
              onSelect={(percent) => {
                setStakeAmountInput(
                  formatUnits(
                    applyPercent(stakingAvailable, percent),
                    catalog.data.stakingToken.decimals
                  )
                );
                setActionError(null);
              }}
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
        <RewardSelectionEditor
          candidates={displayedRewardCandidates}
          confirmed={position.selectedRewardAssets}
          selected={draftRewardAssets}
          rewards={position.rewards}
          maximum={catalog.data.maximumRewardAssets}
          chainId={deploymentState.deployment.chainId}
          changeCount={rewardChangeCount}
          disabled={pendingAction !== null}
          saving={pendingAction === "save-reward-selections"}
          onToggle={stageRewardSelection}
          onSave={() => void runAction("save-reward-selections", saveRewardSelections, false)}
        />
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
            onClick={() => void runAction("custom-reward", addCustomReward, false)}
          >
            {pendingAction === "custom-reward" ? t("validatingAddress") : t("stageAddress")}
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
