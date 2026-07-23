"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";

import { basketTokenAbi, buildCreateAndStakeCall, staticsAbi } from "@statics-protocol/sdk";

import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { describePositionError, loadPositionCatalog } from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

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

export function RewardsPage() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Wallet runtime unavailable</p>
        <h2>Configure Privy to inspect local staking and rewards.</h2>
      </section>
    );
  }
  return <RewardsRuntime />;
}

function RewardsRuntime() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [amountInput, setAmountInput] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<readonly `0x${string}`[]>([]);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
  const amount = parseAmount(amountInput, catalog.data?.stakingToken.decimals ?? 18);

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
      const token = catalog.data.stakingToken;
      const diamond = deploymentState.deployment.contracts.diamond;
      const common = {
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        sendTransaction: ({
          to,
          data,
          value,
        }: {
          to: `0x${string}`;
          data: `0x${string}`;
          value?: bigint;
        }) =>
          walletClient.data.sendTransaction({
            account: wallet,
            chain: walletClient.data.chain,
            to,
            data,
            value,
          }),
        describeError: describePositionError,
      };
      if (catalog.data.stakingTokenBalance < amount) {
        throw new Error(`The wallet does not hold enough ${token.symbol}.`);
      }
      if (catalog.data.stakingTokenAllowance < amount) {
        await executeProtocolTransaction({
          ...common,
          kind: "approve-staking-token",
          label: `Approve ${token.symbol} for staking`,
          amount: `${amountInput} ${token.symbol}`,
          to: token.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [diamond, amount],
          }),
        });
      } else {
        await executeProtocolTransaction({
          ...common,
          kind: "create-and-stake",
          label: `Create PositionNFT and stake ${token.symbol}`,
          amount: `${amountInput} ${token.symbol}`,
          to: diamond,
          data: buildCreateAndStakeCall(amount, wallet, selectedAssets),
          validateSimulation: (result) => {
            if (!result) throw new Error("The create-and-stake simulation returned no position.");
            const positionId = decodeFunctionResult({
              abi: staticsAbi,
              functionName: "createAndStake",
              data: result,
            });
            if (positionId === 0n) {
              throw new Error("The create-and-stake simulation returned an invalid ID.");
            }
          },
        });
        setAmountInput("");
        setSelectedAssets([]);
      }
      await catalog.refetch();
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setPending(false);
    }
  };

  if (deploymentState.status === "unavailable") {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Rewards unavailable</p>
        <h2>No verified local protocol deployment is configured.</h2>
      </section>
    );
  }

  let primaryLabel = "Approve or create staking position";
  let primaryAction: (() => void) | null = () => void createAndStake();
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
    <div className="rewards-page">
      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Atomic position creation</p>
            <h2>Create and stake</h2>
            <p>
              Select only the fee assets this PositionNFT should earn. New selections begin at the
              current index and cannot capture historical rewards.
            </p>
          </div>
          {catalog.data && (
            <span>
              Total staked:{" "}
              {displayAmount(catalog.data.totalStaked, catalog.data.stakingToken.decimals)}{" "}
              {catalog.data.stakingToken.symbol}
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
                Wallet balance:{" "}
                {displayAmount(
                  catalog.data.stakingTokenBalance,
                  catalog.data.stakingToken.decimals
                )}{" "}
                {catalog.data.stakingToken.symbol}
              </small>
            </label>
            <fieldset className="reward-selector" disabled={pending}>
              <legend>
                Initial reward selections · {selectedAssets.length}/
                {catalog.data.maximumRewardAssets.toString()}
              </legend>
              {catalog.data.rewardCandidates.map((candidate) => {
                const selected = selectedAssets.includes(candidate.token.address);
                return (
                  <label key={candidate.token.address}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        setSelectedAssets((current) =>
                          selected
                            ? current.filter((asset) => asset !== candidate.token.address)
                            : [...current, candidate.token.address]
                        )
                      }
                    />
                    <span>
                      <strong>{candidate.token.symbol}</strong>
                      {candidate.sources.join(" · ")}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </>
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
            (walletState.status === "ready" && walletState.isTargetChain && amount <= 0n)
          }
        >
          {pending ? "Waiting for confirmation…" : primaryLabel}
        </button>
      </section>

      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">Wallet-owned positions</p>
            <h2>Selected rewards</h2>
          </div>
          <span>Claims planned</span>
        </div>
        {catalog.isPending && wallet ? (
          <p className="dollar-loading">Loading selected reward state…</p>
        ) : catalog.isError ? (
          <p className="dapp-inline-error" role="alert">
            {describePositionError(catalog.error)}
          </p>
        ) : catalog.data?.positions.length ? (
          <div className="reward-position-list">
            {catalog.data.positions.map((position) => (
              <article key={position.positionId.toString()}>
                <div>
                  <h3>Position #{position.positionId.toString()}</h3>
                  <span>
                    {displayAmount(position.stakedBalance, catalog.data.stakingToken.decimals)}{" "}
                    {catalog.data.stakingToken.symbol} staked
                  </span>
                </div>
                {position.rewards.length ? (
                  <ul>
                    {position.rewards.map((reward) => (
                      <li key={reward.token.address}>
                        <span>{reward.token.symbol}</span>
                        <strong>
                          {displayAmount(reward.pending, reward.token.decimals)} pending
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No reward assets selected.</p>
                )}
                <Link href={`/app/positions/${position.positionId.toString()}`}>
                  Manage selections and stake →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="position-empty">
            <h3>No PositionNFT is owned by this wallet.</h3>
            <p>Create and stake above to begin.</p>
          </div>
        )}
        <button className="dollar-submit" type="button" disabled>
          Claim selected rewards · Planned
        </button>
      </section>
    </div>
  );
}
