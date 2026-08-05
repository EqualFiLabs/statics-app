"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  parseEventLogs,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  basketTokenAbi,
  buildClaimRewardsCall,
  buildClaimBasketRewardsCall,
  buildCreateAndStakeCall,
  buildStakeCall,
  staticsAbi,
} from "@statics-protocol/sdk";

import { SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { loadBasketRewardSummary, type BasketRewardEntry } from "@/lib/baskets/rewards";
import { StakeMaturity } from "@/components/rewards/StakeMaturity";
import { loadStakingSnapshot } from "@/lib/positions/staking";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  claimablePositionRewards,
  describePositionError,
  loadPositionCatalog,
} from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { focusRewardPositions } from "@/lib/rewards/navigation";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import type { AppLocale } from "@/i18n/config";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

const deploymentState = readClientDollarDeployment();

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

export function RewardsPage({ initialPositionId = null }: { initialPositionId?: bigint | null }) {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Rewards" />;
  return <RewardsRuntime initialPositionId={initialPositionId} />;
}

function RewardsRuntime({ initialPositionId }: { initialPositionId: bigint | null }) {
  const t = useTranslations("rewards");
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [amountInput, setAmountInput] = useState("");
  const [stakePositionOverride, setStakePositionOverride] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [claimingBasketKey, setClaimingBasketKey] = useState<string | null>(null);
  const [claimingPositionId, setClaimingPositionId] = useState<bigint | null>(null);
  const [claimSelections, setClaimSelections] = useState<Record<string, readonly `0x${string}`[]>>(
    {}
  );
  const [actionError, setActionError] = useState<string | null>(null);
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
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadPositionCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });

  // Which part of each stake is earning, and when the rest starts. The
  // position catalog reports only a total, which cannot explain why rewards
  // look lower than expected right after staking.
  const stakingSnapshots = useQuery({
    queryKey: [
      "staking-snapshots",
      wallet,
      (catalog.data?.positions ?? [])
        .map((position) => `${position.positionId}:${position.rewards.length}`)
        .join(","),
    ],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      Boolean(catalog.data),
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured" || !catalog.data) {
        throw new Error("No verified Statics deployment is configured.");
      }
      const entries = await Promise.all(
        catalog.data.positions.map(
          async (position) =>
            [
              position.positionId.toString(),
              await loadStakingSnapshot(
                publicClient,
                deploymentState.deployment,
                wallet,
                position.positionId,
                position.rewards
              ),
            ] as const
        )
      );
      return Object.fromEntries(entries);
    },
  });

  // What deposited baskets have earned, in the assets they hold. Separate from
  // the Statics staking rewards below: a deposited basket earns without the
  // Statics token being staked at all, and the two claim through different
  // calls. Keyed off the loaded positions so it refetches when they change.
  const basketRewards = useQuery({
    queryKey: [
      "basket-rewards",
      wallet,
      (catalog.data?.positions ?? [])
        .map((position) => `${position.positionId}:${position.collateral.length}`)
        .join(","),
    ],
    enabled:
      deploymentState.status === "configured" && Boolean(publicClient) && Boolean(catalog.data),
    queryFn: () => {
      if (!publicClient || deploymentState.status !== "configured" || !catalog.data) {
        throw new Error("No verified Statics deployment is configured.");
      }
      return loadBasketRewardSummary(
        publicClient,
        deploymentState.deployment,
        catalog.data.positions
      );
    },
  });
  const amount = parseAmount(amountInput, catalog.data?.stakingToken.decimals ?? 18, locale);
  const ownedPositionIds = catalog.data?.positions.map((position) => position.positionId) ?? [];
  const requestedStakePosition =
    stakePositionOverride ??
    (initialPositionId !== null && ownedPositionIds.includes(initialPositionId)
      ? initialPositionId.toString()
      : (ownedPositionIds[0]?.toString() ?? "new"));
  const stakePositionId = requestedStakePosition === "new" ? null : BigInt(requestedStakePosition);

  const createAndStake = async () => {
    if (
      !wallet ||
      !publicClient ||
      !walletClient.data ||
      !catalog.data ||
      amount <= 0n ||
      deploymentState.status !== "configured"
    ) {
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const refreshed = await catalog.refetch();
      if (!refreshed.data) throw new Error("The current Position state is unavailable.");
      const token = refreshed.data.stakingToken;
      const diamond = deploymentState.deployment.contracts.diamond;
      const targetPosition =
        stakePositionId === null
          ? null
          : refreshed.data.positions.find((position) => position.positionId === stakePositionId);
      if (stakePositionId !== null && !targetPosition) {
        throw new Error("The selected position is no longer owned by this wallet.");
      }
      const common = {
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describePositionError,
      };
      if (refreshed.data.stakingTokenBalance < amount) {
        throw new Error(`The wallet does not hold enough ${token.symbol}.`);
      }
      if (refreshed.data.stakingTokenAllowance < amount) {
        await executeProtocolTransaction({
          ...common,
          kind: "approve-staking-token",
          label: `Approve ${token.symbol} for staking`,
          amount: `${amountInput} ${token.symbol}`,
          to: token.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [diamond, MAX_ERC20_ALLOWANCE],
          }),
        });
      }
      await executeProtocolTransaction({
        ...common,
        kind: stakePositionId === null ? "create-and-stake" : "stake-position",
        label:
          stakePositionId === null
            ? `Create position and stake ${token.symbol}`
            : `Stake ${token.symbol} in Position #${stakePositionId.toString()}`,
        amount:
          stakePositionId === null
            ? `${amountInput} ${token.symbol} + ${formatEther(refreshed.data.positionCreationFee)} ETH account fee`
            : `${amountInput} ${token.symbol}`,
        to: diamond,
        data:
          stakePositionId === null
            ? buildCreateAndStakeCall(amount, wallet, [])
            : buildStakeCall(stakePositionId, amount),
        value: stakePositionId === null ? refreshed.data.positionCreationFee : 0n,
        validateSimulation:
          stakePositionId === null
            ? (result) => {
                if (!result)
                  throw new Error("The create-and-stake simulation returned no position.");
                const positionId = decodeFunctionResult({
                  abi: staticsAbi,
                  functionName: "createAndStake",
                  data: result,
                });
                if (positionId === 0n) {
                  throw new Error("The create-and-stake simulation returned an invalid ID.");
                }
              }
            : undefined,
      });
      setAmountInput("");
      await catalog.refetch();
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setPending(false);
    }
  };

  const claimPositionRewards = async (positionId: bigint) => {
    if (!wallet || !publicClient || !walletClient.data || deploymentState.status !== "configured") {
      return;
    }
    setClaimingPositionId(positionId);
    setActionError(null);
    try {
      const refreshed = await catalog.refetch();
      const position = refreshed.data?.positions.find((item) => item.positionId === positionId);
      if (!position) throw new Error("The selected position is no longer owned by this wallet.");
      const key = positionId.toString();
      const defaultAssets = claimablePositionRewards(position.rewards).map(
        (reward) => reward.token.address
      );
      const requested = claimSelections[key] ?? defaultAssets;
      const rewards = claimablePositionRewards(position.rewards, requested);
      if (!rewards.length) throw new Error("Select at least one nonzero reward.");
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
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind: "claim-rewards",
        label: `Claim rewards from Position #${key}`,
        amount: rewards
          .map(
            (reward) =>
              `${displayAmount(reward.pending, reward.token.decimals)} ${reward.token.symbol}`
          )
          .join(" + "),
        to: deploymentState.deployment.contracts.diamond,
        data: buildClaimRewardsCall(positionId, assets, wallet, minimums),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describePositionError,
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
          }).filter((event) => event.args.positionId === positionId);
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
              args: [positionId, assets],
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
      setClaimSelections((current) => ({ ...current, [key]: [] }));
      await catalog.refetch();
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setClaimingPositionId(null);
    }
  };

  const claimBasketRewards = async (entry: BasketRewardEntry) => {
    if (!wallet || !publicClient || !walletClient.data || deploymentState.status !== "configured") {
      return;
    }
    const key = `${entry.positionId}:${entry.basketId}`;
    setClaimingBasketKey(key);
    setActionError(null);
    try {
      const expected = entry.amounts.filter((item) => item.amount > 0n);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind: "claim-basket-rewards",
        label: `Claim ${entry.basketSymbol} rewards`,
        amount: expected
          .map((item) => `${displayAmount(item.amount, item.token.decimals)} ${item.token.symbol}`)
          .join(" + "),
        to: deploymentState.deployment.contracts.diamond,
        data: buildClaimBasketRewardsCall(entry.positionId, entry.basketId, wallet),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describePositionError,
        validateSimulation: (result) => {
          if (!result) throw new Error("The basket reward claim simulation returned no amounts.");
          const [, amounts] = decodeFunctionResult({
            abi: staticsAbi,
            functionName: "claimBasketRewards",
            data: result,
          });
          if (amounts.every((amount) => amount === 0n)) {
            throw new Error("The basket reward claim simulation returned nothing to claim.");
          }
        },
        verifyConfirmation: async (receipt) => {
          // Confirm the chain actually paid this position and basket, rather
          // than trusting that a successful transaction did what was reviewed.
          const events = parseEventLogs({
            abi: staticsAbi,
            eventName: "BasketRewardClaimed",
            logs: receipt.logs,
            strict: true,
          }).filter(
            (event) =>
              event.args.positionId === entry.positionId && event.args.basketId === entry.basketId
          );
          if (events.length === 0) {
            throw new Error("The receipt did not contain the reviewed basket reward claim.");
          }
        },
      });
      await Promise.all([catalog.refetch(), basketRewards.refetch()]);
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setClaimingBasketKey(null);
    }
  };

  if (deploymentState.status === "unavailable") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject="rewards"
        empty={{ title: "Rewards unavailable", description: "No deployment is configured." }}
      />
    );
  }

  const surfaceState = deriveSurfaceState({
    walletStatus: walletState.status,
    isTargetChain: walletState.isTargetChain,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    isEmpty: (catalog.data?.positions.length ?? 0) === 0,
    hasData: Boolean(catalog.data),
  });
  const orderedPositions = focusRewardPositions(catalog.data?.positions ?? [], initialPositionId);

  let primaryLabel = t("approveOrCreate");
  let primaryAction: (() => void) | null = () => void createAndStake();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    primaryLabel = t("signIn");
    primaryAction = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    primaryLabel = t("createWallet");
    primaryAction = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    primaryLabel = t("switchTo", { network: walletState.networkName });
    primaryAction = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    primaryLabel = t("walletLoading");
    primaryAction = null;
  }

  return (
    <div className="rewards-page">
      {actionError && (
        <p className="dapp-inline-error" role="alert">
          {actionError}
        </p>
      )}
      {/* Basket rewards come first because they are what a deposited basket
          earns, and they need no Statics staking at all. Someone who bought a
          basket and came here looking for their earnings previously landed on
          the staking panel below and reasonably concluded it was not working. */}
      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("basketSource")}</p>
            <h2>{t("basketTitle")}</h2>
            <p>{t("basketDescription")}</p>
          </div>
        </div>

        {basketRewards.data && basketRewards.data.entries.length > 0 ? (
          <div className="reward-position-list">
            {basketRewards.data.entries.map((entry) => {
              const key = `${entry.positionId}:${entry.basketId}`;
              const earned = entry.amounts.filter((item) => item.amount > 0n);
              return (
                <article className="reward-position" key={key}>
                  <div className="reward-position-heading">
                    <div>
                      <h3>{entry.basketName}</h3>
                      <span>
                        {displayAmount(entry.depositedShares, 18)} {entry.basketSymbol} deposited ·
                        Position #{entry.positionId.toString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void claimBasketRewards(entry)}
                      disabled={!entry.claimable || claimingBasketKey !== null}
                    >
                      {claimingBasketKey === key ? t("claiming") : t("claim")}
                    </button>
                  </div>
                  {earned.length > 0 ? (
                    <dl>
                      {earned.map((item) => (
                        <div key={item.token.address}>
                          <dt>{item.token.symbol}</dt>
                          <dd>{displayAmount(item.amount, item.token.decimals)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="reward-position-idle">
                      {t("earningNoClaim", {
                        assets:
                          entry.amounts.map((item) => item.token.symbol).join(", ") ||
                          t("itsAssets"),
                      })}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <SurfaceEmptyState
            state={deriveSurfaceState({
              walletStatus: walletState.status,
              isTargetChain: walletState.isTargetChain,
              isLoading: catalog.isPending || basketRewards.isPending,
              isError: catalog.isError || basketRewards.isError,
              isEmpty: (basketRewards.data?.entries.length ?? 0) === 0,
              hasData: Boolean(basketRewards.data),
            })}
            subject={t("basketSubject")}
            onRetry={() => void basketRewards.refetch()}
            empty={{
              title: t("noBaskets"),
              description: t("noBasketsDescription"),
              action: { label: t("browseBaskets"), href: "/app/baskets" },
            }}
          />
        )}
      </section>

      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("startEarning")}</p>
            <h2>{t("createAndStakeTitle")}</h2>
            <p>{t("createAndStakeDescription")}</p>
          </div>
          {catalog.data && (
            <span>
              {t("totalStaked", {
                amount: displayAmount(catalog.data.totalStaked, catalog.data.stakingToken.decimals),
                symbol: catalog.data.stakingToken.symbol,
              })}
            </span>
          )}
        </div>
        {catalog.data && (
          <>
            <label className="basket-field">
              <span>{catalog.data.stakingToken.symbol} amount</span>
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
              <small>
                {t("walletBalance", {
                  amount: displayAmount(
                    catalog.data.stakingTokenBalance,
                    catalog.data.stakingToken.decimals
                  ),
                  symbol: catalog.data.stakingToken.symbol,
                })}
              </small>
            </label>
            <label className="basket-field">
              <span>{t("stakeIn")}</span>
              <select
                value={requestedStakePosition}
                onChange={(event) => {
                  setStakePositionOverride(event.target.value);
                  setActionError(null);
                }}
                disabled={pending}
              >
                {ownedPositionIds.map((positionId) => (
                  <option key={positionId.toString()} value={positionId.toString()}>
                    {t("positionNumber", { id: positionId.toString() })}
                  </option>
                ))}
                <option value="new">
                  {t("openNewPosition", {
                    fee: formatEther(catalog.data.positionCreationFee),
                  })}
                </option>
              </select>
              <small>{t("reusePositionHelp")}</small>
            </label>
          </>
        )}
        <button
          className="dollar-submit"
          type="button"
          onClick={primaryAction ?? undefined}
          disabled={
            pending ||
            primaryAction === null ||
            (walletState.status === "ready" && walletState.isTargetChain && amount <= 0n)
          }
        >
          {pending ? t("waiting") : primaryLabel}
        </button>
      </section>

      <section className="position-panel is-wide">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("stakingSource")}</p>
            <h2>{t("stakedPositions")}</h2>
          </div>
          <span>{t("multiAssetClaims")}</span>
        </div>
        {catalog.isError && catalog.data && (
          <p className="dollar-warning" role="status">
            Reward data is temporarily unavailable. Showing the last received state.
          </p>
        )}
        {catalog.data && isSurfaceReady(surfaceState) ? (
          <div className="reward-position-list">
            {orderedPositions.map((position) => {
              const key = position.positionId.toString();
              const defaults = claimablePositionRewards(position.rewards).map(
                (reward) => reward.token.address
              );
              const selected = claimSelections[key] ?? defaults;
              return (
                <article
                  key={key}
                  className={initialPositionId === position.positionId ? "is-focused" : undefined}
                >
                  <div>
                    <h3>Position #{position.positionId.toString()}</h3>
                    <span>
                      {displayAmount(position.stakedBalance, catalog.data.stakingToken.decimals)}{" "}
                      {catalog.data.stakingToken.symbol} staked
                      {initialPositionId === position.positionId ? " · selected position" : ""}
                    </span>
                  </div>
                  <StakeMaturity
                    snapshot={stakingSnapshots.data?.[key]}
                    stakingToken={catalog.data.stakingToken}
                    now={catalog.data.currentTimestamp}
                  />
                  {position.rewards.length ? (
                    <ul>
                      {position.rewards.map((reward) => (
                        <li key={reward.token.address}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selected.includes(reward.token.address)}
                              disabled={reward.pending === 0n || claimingPositionId !== null}
                              onChange={() =>
                                setClaimSelections((current) => ({
                                  ...current,
                                  [key]: selected.includes(reward.token.address)
                                    ? selected.filter((asset) => asset !== reward.token.address)
                                    : [...selected, reward.token.address],
                                }))
                              }
                            />
                            <span>{reward.token.symbol}</span>
                          </label>
                          <strong>
                            {displayAmount(reward.pending, reward.token.decimals)} pending
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("noAssetsSelected")}</p>
                  )}
                  <Link href={`/app/positions/${position.positionId.toString()}`}>
                    {t("configure")} →
                  </Link>
                  <button
                    className="dollar-submit"
                    type="button"
                    disabled={
                      claimingPositionId !== null ||
                      claimablePositionRewards(position.rewards, selected).length === 0
                    }
                    onClick={() => void claimPositionRewards(position.positionId)}
                  >
                    {claimingPositionId === position.positionId
                      ? t("claimingSelected")
                      : t("claimSelected")}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <SurfaceEmptyState
            state={surfaceState}
            subject={t("subject")}
            onRetry={() => void catalog.refetch()}
            empty={{
              title: t("nothingStaked"),
              description: t("nothingStakedDescription"),
              action: {
                label: pending ? t("working") : t("createAndStake"),
                onClick: () => void createAndStake(),
                disabled: pending,
              },
              secondary: { label: t("viewPositions"), href: "/app/positions" },
            }}
          />
        )}
      </section>

      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("liquiditySource")}</p>
            <h2>{t("liquidityTitle")}</h2>
            <p>{t("liquidityDescription")}</p>
          </div>
          <Link className="dollar-primary-link" href="/app/liquidity">
            {t("reviewLiquidity")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
