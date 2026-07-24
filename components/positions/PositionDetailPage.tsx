"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useMemo, useState } from "react";

import {
  basketTokenAbi,
  buildClaimRewardsCall,
  buildClosePositionCall,
  buildDepositBasketCollateralCall,
  buildMintBasketCollateralCall,
  buildOptInRewardAssetsCall,
  buildOptOutRewardAssetsCall,
  buildRedeemBasketCollateralCall,
  buildStakeCall,
  buildUnstakeCall,
  buildWithdrawBasketCollateralCall,
  staticsAbi,
} from "@statics-protocol/sdk";

import {
  DEFAULT_BASKET_SLIPPAGE_BPS,
  maximumWithSlippage,
  minimumWithSlippage,
  parseSlippageBps,
} from "@/lib/baskets/baskets";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  canClosePosition,
  claimablePositionRewards,
  describePositionError,
  isUnstakeAvailable,
  loadPositionCatalog,
  unlockedCollateral,
  validateCustomRewardAsset,
} from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { PositionDetailPreview } from "@/components/preview/DappPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";

const deploymentState = readClientDollarDeployment();

type CollateralMode = "deposit" | "mint" | "withdraw" | "redeem";

function displayAmount(value: bigint, decimals = 18, precision = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function parseAmount(value: string, decimals: number): bigint {
  try {
    return value ? parseUnits(value, decimals) : 0n;
  } catch {
    return 0n;
  }
}

export function PositionDetailPage({ positionId }: { positionId: bigint }) {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <PositionDetailPreview positionId={positionId} />;
  }
  if (wallet.status === "unconfigured") return <PositionDetailPreview positionId={positionId} />;
  return <PositionDetailRuntime positionId={positionId} />;
}

function PositionDetailRuntime({ positionId }: { positionId: bigint }) {
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
  const [slippageInput, setSlippageInput] = useState(
    (DEFAULT_BASKET_SLIPPAGE_BPS / 100).toFixed(2)
  );
  const [stakeMode, setStakeMode] = useState<"stake" | "unstake">("stake");
  const [stakeAmountInput, setStakeAmountInput] = useState("");
  const [customRewardAddress, setCustomRewardAddress] = useState("");

  const catalog = useQuery({
    queryKey: [
      "position-catalog",
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : "unconfigured",
      wallet,
    ],
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
    () => parseAmount(collateralAmountInput, 18),
    [collateralAmountInput]
  );
  const stakeAmount = useMemo(
    () => parseAmount(stakeAmountInput, catalog.data?.stakingToken.decimals ?? 18),
    [stakeAmountInput, catalog.data?.stakingToken.decimals]
  );
  const slippageBps = parseSlippageBps(slippageInput);

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

  const claimRewards = async () => {
    if (!wallet || !publicClient || !position || deploymentState.status !== "configured") {
      throw new Error("The connected PositionNFT is unavailable.");
    }
    const refreshed = await catalog.refetch();
    const current = refreshed.data?.positions.find(
      (candidate) => candidate.positionId === position.positionId
    );
    if (!current) throw new Error("This PositionNFT is no longer owned by the connected wallet.");
    const rewards = claimablePositionRewards(current.rewards);
    if (!rewards.length) throw new Error("This PositionNFT has no nonzero rewards to claim.");
    const assets = rewards.map((reward) => reward.token.address);
    const minimums = rewards.map((reward) => reward.pending);
    const balancesBefore = await Promise.all(
      rewards.map((reward) =>
        publicClient.readContract({
          address: reward.token.address,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        })
      )
    );

    await sendTransaction({
      kind: "claim-rewards",
      label: `Claim rewards from Position #${current.positionId.toString()}`,
      amount: rewards
        .map(
          (reward) =>
            `${displayAmount(reward.pending, reward.token.decimals)} ${reward.token.symbol}`
        )
        .join(" + "),
      to: deploymentState.deployment.contracts.diamond,
      data: buildClaimRewardsCall(current.positionId, assets, wallet, minimums),
      validateSimulation: (result) => {
        if (!result) throw new Error("The reward claim simulation returned no amounts.");
        const amounts = decodeFunctionResult({
          abi: staticsAbi,
          functionName: "claimRewards",
          data: result,
        });
        if (amounts.some((amount, index) => amount < (minimums[index] ?? 0n))) {
          throw new Error("The reward claim simulation fell below the reviewed minimum.");
        }
      },
      verifyConfirmation: async (receipt) => {
        const events = parseEventLogs({
          abi: staticsAbi,
          eventName: "RewardClaimed",
          logs: receipt.logs,
          strict: true,
        }).filter((event) => event.args.positionId === current.positionId);
        if (
          assets.some(
            (asset) =>
              !events.some(
                (event) =>
                  getAddress(event.args.asset) === asset &&
                  getAddress(event.args.receiver) === wallet
              )
          )
        ) {
          throw new Error("The receipt did not contain every reviewed reward claim.");
        }
        const [pendingAfter, balancesAfter] = await Promise.all([
          publicClient.readContract({
            account: wallet,
            address: deploymentState.deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "pendingRewards",
            args: [current.positionId, assets],
          }),
          Promise.all(
            rewards.map((reward) =>
              publicClient.readContract({
                address: reward.token.address,
                abi: basketTokenAbi,
                functionName: "balanceOf",
                args: [wallet],
              })
            )
          ),
        ]);
        if (pendingAfter.some((amount) => amount !== 0n)) {
          throw new Error("Claimed rewards remain pending after confirmation.");
        }
        if (
          balancesAfter.some(
            (balance, index) => balance - (balancesBefore[index] ?? 0n) < (minimums[index] ?? 0n)
          )
        ) {
          throw new Error("The wallet did not receive every reviewed reward amount.");
        }
      },
    });
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
            args: [diamond, collateralAmount],
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

    if (collateralMode === "mint") {
      if (slippageBps === null) throw new Error("Slippage must be between 0% and 5%.");
      const quote = await publicClient.readContract({
        address: diamond,
        abi: staticsAbi,
        functionName: "quoteMint",
        args: [basket.basketId, collateralAmount],
      });
      const maximums = quote.map((amount) => maximumWithSlippage(amount, slippageBps));
      const approvalIndex = basket.constituents.findIndex(
        (constituent, index) =>
          constituent.walletBalance < (maximums[index] ?? 0n) ||
          constituent.allowance < (maximums[index] ?? 0n)
      );
      if (approvalIndex >= 0) {
        const constituent = basket.constituents[approvalIndex];
        const maximum = maximums[approvalIndex];
        if (!constituent || maximum === undefined) {
          throw new Error("The constituent quote is incomplete.");
        }
        if (constituent.walletBalance < maximum) {
          throw new Error(`The wallet does not hold enough ${constituent.token.symbol}.`);
        }
        await sendTransaction({
          kind: "approve-basket-asset",
          label: `Approve ${constituent.token.symbol}`,
          amount: `${displayAmount(maximum, constituent.token.decimals)} ${constituent.token.symbol}`,
          to: constituent.token.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [diamond, maximum],
          }),
        });
        return;
      }
      await sendTransaction({
        kind: "mint-basket-collateral",
        label: `Mint ${basket.symbol} into collateral`,
        amount: amountLabel,
        to: diamond,
        data: buildMintBasketCollateralCall(
          position.positionId,
          basket.basketId,
          collateralAmount,
          maximums
        ),
        validateSimulation: (result) => {
          if (!result) throw new Error("The collateral mint simulation returned no result.");
          const amounts = decodeFunctionResult({
            abi: staticsAbi,
            functionName: "mintBasketCollateral",
            data: result,
          });
          if (
            amounts.length !== basket.constituents.length ||
            amounts.some((amount) => amount <= 0n)
          ) {
            throw new Error("The collateral mint simulation returned invalid inputs.");
          }
        },
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

    if (collateralMode === "withdraw") {
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
    } else {
      if (slippageBps === null) throw new Error("Slippage must be between 0% and 5%.");
      const quote = await publicClient.readContract({
        address: diamond,
        abi: staticsAbi,
        functionName: "quoteRedeem",
        args: [basket.basketId, collateralAmount],
      });
      const minimums = quote.map((amount) => minimumWithSlippage(amount, slippageBps));
      await sendTransaction({
        kind: "redeem-basket-collateral",
        label: `Redeem ${basket.symbol} collateral`,
        amount: amountLabel,
        to: diamond,
        data: buildRedeemBasketCollateralCall(
          position.positionId,
          basket.basketId,
          collateralAmount,
          wallet,
          minimums
        ),
        validateSimulation: (result) => {
          if (!result) throw new Error("The collateral redemption simulation returned no result.");
          const amounts = decodeFunctionResult({
            abi: staticsAbi,
            functionName: "redeemBasketCollateral",
            data: result,
          });
          if (
            amounts.length !== basket.constituents.length ||
            amounts.some((amount) => amount <= 0n)
          ) {
            throw new Error("The collateral redemption simulation returned invalid outputs.");
          }
        },
      });
    }
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
            args: [diamond, stakeAmount],
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
      if (!isUnstakeAvailable(position, catalog.data.currentTimestamp)) {
        throw new Error("The 24-hour unstaking cooldown is still active.");
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

  if (
    deploymentState.status === "unavailable" ||
    walletState.status !== "ready" ||
    !walletState.isTargetChain ||
    (catalog.isPending && !catalog.data) ||
    (catalog.isError && !catalog.data)
  ) {
    return <PositionDetailPreview positionId={positionId} />;
  }
  if (!position || !catalog.data) {
    return <PositionDetailPreview positionId={positionId} />;
  }

  const cooldownRemaining = Number(position.unstakeAvailableAt - catalog.data.currentTimestamp);
  const closeReady = canClosePosition(position);

  return (
    <div className="position-detail">
      <Link className="basket-back" href="/app/positions">
        ← All positions
      </Link>
      <section className="position-hero">
        <div>
          <p className="dapp-section-label">Wallet-owned PositionNFT</p>
          <h2>Position #{position.positionId.toString()}</h2>
          <AddressDisplay
            address={position.owner}
            chainId={deploymentState.deployment.chainId}
            label="Owner"
          />
        </div>
        <dl>
          <div>
            <dt>Active legs</dt>
            <dd>{position.activeLegCount.toString()}</dd>
          </div>
          <div>
            <dt>Basket legs</dt>
            <dd>{position.collateral.length}</dd>
          </div>
          <div>
            <dt>Reward assets</dt>
            <dd>
              {position.selectedRewardAssets.length}/{catalog.data.maximumRewardAssets.toString()}
            </dd>
          </div>
        </dl>
      </section>

      <p className="dollar-warning">
        Transferring this PositionNFT transfers every attached collateral, staking, reward, loan,
        Dollar, and liquidity obligation. This release intentionally does not provide a transfer
        button.
      </p>

      <div className="position-detail-grid">
        <section className="position-panel">
          <p className="dapp-section-label">Basket collateral</p>
          <h3>Manage collateral legs</h3>
          <div className="dollar-tabs" aria-label="Collateral action">
            {(["deposit", "mint", "withdraw", "redeem"] as const).map((mode) => (
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
                {mode}
              </button>
            ))}
          </div>
          <label className="basket-field">
            <span>Basket</span>
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
          {(collateralMode === "mint" || collateralMode === "redeem") && (
            <label className="basket-field">
              <span>Slippage tolerance</span>
              <div>
                <input
                  value={slippageInput}
                  onChange={(event) => setSlippageInput(event.target.value)}
                  inputMode="decimal"
                  disabled={pendingAction !== null}
                />
                <strong>%</strong>
              </div>
              <small>Allowed range 0–5%. Fresh bounds are read immediately before signing.</small>
            </label>
          )}
          <button
            className="dollar-submit"
            type="button"
            disabled={pendingAction !== null || collateralAmount <= 0n || !basket}
            onClick={() => void runAction(`collateral-${collateralMode}`, executeCollateralAction)}
          >
            {pendingAction === `collateral-${collateralMode}`
              ? "Waiting for confirmation…"
              : collateralMode === "deposit"
                ? "Approve or deposit BasketToken"
                : collateralMode === "mint"
                  ? "Approve or mint into collateral"
                  : collateralMode === "withdraw"
                    ? "Withdraw BasketToken"
                    : "Redeem collateral to constituents"}
          </button>
        </section>

        <section className="position-panel">
          <p className="dapp-section-label">Global staking</p>
          <h3>Stake {catalog.data.stakingToken.symbol}</h3>
          <div className="dollar-tabs" aria-label="Staking action">
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
                {mode}
              </button>
            ))}
          </div>
          <dl className="position-metrics">
            <div>
              <dt>Wallet balance</dt>
              <dd>
                {displayAmount(
                  catalog.data.stakingTokenBalance,
                  catalog.data.stakingToken.decimals
                )}{" "}
                {catalog.data.stakingToken.symbol}
              </dd>
            </div>
            <div>
              <dt>Position stake</dt>
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
          <p className="position-cooldown">
            {cooldownRemaining > 0 && position.stakedBalance > 0n
              ? `Unstaking available in ${Math.ceil(cooldownRemaining / 3_600)} hours.`
              : "Unstaking is available. Adding stake or selecting a reward asset restarts the 24-hour cooldown."}
          </p>
          <button
            className="dollar-submit"
            type="button"
            disabled={pendingAction !== null || stakeAmount <= 0n}
            onClick={() => void runAction(`stake-${stakeMode}`, executeStakeAction)}
          >
            {pendingAction === `stake-${stakeMode}`
              ? "Waiting for confirmation…"
              : stakeMode === "stake"
                ? `Approve or stake ${catalog.data.stakingToken.symbol}`
                : `Unstake ${catalog.data.stakingToken.symbol}`}
          </button>
        </section>
      </div>

      <section className="position-panel position-rewards">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Position-selected rewards</p>
            <h3>Choose up to {catalog.data.maximumRewardAssets.toString()} fee assets</h3>
          </div>
          <span>{position.selectedRewardAssets.length} selected</span>
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
                  label="Token"
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
                    ? "Waiting…"
                    : selected
                      ? "Remove selection"
                      : "Select reward"}
                </button>
              </article>
            );
          })}
        </div>
        <div className="custom-reward">
          <label className="basket-field">
            <span>Custom ERC-20 reward address</span>
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
            <small>
              Contract code and ERC-20 metadata are verified before the opt-in transaction.
            </small>
          </label>
          <button
            className="dollar-submit"
            type="button"
            disabled={pendingAction !== null || customRewardAddress.length === 0}
            onClick={() => void runAction("custom-reward", addCustomReward)}
          >
            {pendingAction === "custom-reward" ? "Waiting for confirmation…" : "Select address"}
          </button>
        </div>
        <p className="dollar-warning">
          Claims use the fresh pending amounts shown above as per-asset minimums. Selecting an asset
          never grants historical rewards.
        </p>
        <button
          className="dollar-submit"
          type="button"
          disabled={
            pendingAction !== null || claimablePositionRewards(position.rewards).length === 0
          }
          onClick={() => void runAction("claim-rewards", claimRewards)}
        >
          {pendingAction === "claim-rewards" ? "Claiming rewards…" : "Claim all pending rewards"}
        </button>
      </section>

      {actionError && (
        <p className="dapp-inline-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="position-close">
        <div>
          <p className="dapp-section-label">Terminal action</p>
          <h3>Close PositionNFT</h3>
          <p>
            {closeReady
              ? "This position has no active protocol legs and can be burned."
              : `Remove all ${position.activeLegCount.toString()} active legs before closing.`}
          </p>
        </div>
        <button
          type="button"
          disabled={pendingAction !== null || !closeReady}
          onClick={() =>
            void runAction("close-position", async () => {
              await sendTransaction({
                kind: "close-position",
                label: `Close PositionNFT #${position.positionId.toString()}`,
                amount: `Position #${position.positionId.toString()}`,
                to: deploymentState.deployment.contracts.diamond,
                data: buildClosePositionCall(position.positionId),
              });
            })
          }
        >
          {pendingAction === "close-position" ? "Closing position…" : "Close PositionNFT"}
        </button>
      </section>
    </div>
  );
}
