"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  buildAccrueGenesisLaunchRewardsCall,
  buildActivateGenesisCall,
  buildClaimGenesisLaunchRewardsCall,
  buildClaimOwnerGenesisLaunchRewardsCall,
  buildRegisterGenesisCall,
  cumulativeGenesisActivationCost,
  dopplerStaticsTokenAbi,
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
} from "@statics-protocol/sdk";
import {
  buildRecoverGenesisCreditCall,
  staticsGenesisCreditAbi,
} from "@statics-protocol/sdk/genesis-credit";

import { EmptyState } from "@/components/common/EmptyState";
import { GenesisCreditPanel } from "@/components/genesis/GenesisCreditPanel";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { loadRecoverableGenesisCredits } from "@/lib/indexer/statics";
import { discoverWalletGenesisIds } from "@/lib/genesis/discovery";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

function describeGenesisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("NotGenesisOwner")) return "This wallet no longer owns that Genesis NFT.";
  if (message.includes("GenesisAlreadyRegistered"))
    return "That Genesis NFT is already registered for rewards.";
  if (message.includes("CreditNotRecoverable")) return "This credit is not recoverable yet.";
  if (message.includes("CreditNotActive")) return "This Genesis credit is no longer active.";
  return message || "The Genesis transaction failed.";
}

type RecoveryCredit = Readonly<{
  genesisId: bigint;
  owner: `0x${string}`;
  principal: bigint;
  maturity: bigint;
  recoverableAt: bigint;
  unusedCredit: bigint;
  callerIncentive: bigint;
  genesisDistribution: bigint;
}>;

type OwnedGenesis = Readonly<{
  id: bigint;
  tier: number;
  multiplierBps: number;
  registered: boolean;
  rewardWeight: bigint;
  pendingStatics: bigint;
  pendingWeth: bigint;
}>;

function displayTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1_000).toLocaleString();
}

export function StandaloneGenesisPage({ deployment }: { deployment: LaunchDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [targetTiers, setTargetTiers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"owned" | "recoveries">("owned");
  const [recoveryBusy, setRecoveryBusy] = useState<bigint | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [rewardsBusy, setRewardsBusy] = useState<string | null>(null);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const epoch = useQuery({
    queryKey: ["genesis-vault-epoch", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      const accounting = await publicClient.readContract({
        address: deployment.contracts.vault,
        abi: currentGenesisVaultAbi,
        functionName: "vaultAccounting",
      });
      return accounting.epochActive;
    },
  });

  const recoveries = useQuery({
    queryKey: ["launch-genesis-recoveries", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient && epoch.data === false),
    queryFn: async (): Promise<readonly RecoveryCredit[]> => {
      if (!publicClient) return [];
      await verifyLaunchDeployment(publicClient, deployment);
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const indexed = await loadRecoverableGenesisCredits(
        block.timestamp,
        deployment.descriptor.deploymentId
      );
      const checked = await Promise.all(
        indexed.map(async (candidate): Promise<RecoveryCredit | null> => {
          const [credit, quote] = await Promise.all([
            publicClient.readContract({
              address: deployment.contracts.vault,
              abi: staticsGenesisCreditAbi,
              functionName: "credit",
              args: [candidate.genesisId],
            }),
            publicClient
              .readContract({
                address: deployment.contracts.vault,
                abi: staticsGenesisCreditAbi,
                functionName: "quoteGenesisCreditRecovery",
                args: [candidate.genesisId],
              })
              .catch(() => null),
          ]);
          if (!credit.active || !quote || BigInt(credit.recoverableAt) >= block.timestamp)
            return null;
          return {
            genesisId: candidate.genesisId,
            owner: getAddress(credit.owner),
            principal: credit.principal,
            maturity: BigInt(credit.maturity),
            recoverableAt: BigInt(credit.recoverableAt),
            unusedCredit: quote.unusedCredit,
            callerIncentive: quote.callerIncentive,
            genesisDistribution: quote.genesisDistribution,
          };
        })
      );
      return checked.filter((item): item is RecoveryCredit => item !== null);
    },
  });

  const owned = useQuery({
    queryKey: ["launch-genesis-owned", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet)
        return {
          items: [] as readonly OwnedGenesis[],
          tierCosts: [] as readonly bigint[],
          rewardShareBps: 0n,
          totalWeight: 0n,
          ownerStatics: 0n,
          ownerWeth: 0n,
        };
      await verifyLaunchDeployment(publicClient, deployment);
      const [ids, tierCosts, rewardShareBps, totalWeight, ownerStatics, ownerWeth] =
        await Promise.all([
          discoverWalletGenesisIds(publicClient, deployment, wallet),
          Promise.all(
            [1, 2, 3, 4].map((tier) =>
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "tierCost",
                args: [tier],
              })
            )
          ).then(oneIndexedGenesisTierCosts),
          publicClient.readContract({
            address: deployment.contracts.launchDistributor,
            abi: genesisLaunchDistributorAbi,
            functionName: "genesisRewardShareBps",
          }),
          publicClient.readContract({
            address: deployment.contracts.launchDistributor,
            abi: genesisLaunchDistributorAbi,
            functionName: "totalWeight",
          }),
          publicClient.readContract({
            address: deployment.contracts.launchDistributor,
            abi: genesisLaunchDistributorAbi,
            functionName: "ownerClaimable",
            args: [wallet, deployment.contracts.statics],
          }),
          publicClient.readContract({
            address: deployment.contracts.launchDistributor,
            abi: genesisLaunchDistributorAbi,
            functionName: "ownerClaimable",
            args: [wallet, deployment.contracts.weth],
          }),
        ]);
      const items = await Promise.all(
        ids.map(async (id): Promise<OwnedGenesis> => {
          const [tier, multiplierBps, registered, rewardWeight, pendingStatics, pendingWeth] =
            await Promise.all([
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "tierOf",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "multiplierBps",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.launchDistributor,
                abi: genesisLaunchDistributorAbi,
                functionName: "registered",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.launchDistributor,
                abi: genesisLaunchDistributorAbi,
                functionName: "effectiveWeight",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.launchDistributor,
                abi: genesisLaunchDistributorAbi,
                functionName: "pendingGenesis",
                args: [id, deployment.contracts.statics],
              }),
              publicClient.readContract({
                address: deployment.contracts.launchDistributor,
                abi: genesisLaunchDistributorAbi,
                functionName: "pendingGenesis",
                args: [id, deployment.contracts.weth],
              }),
            ]);
          return {
            id,
            tier: Number(tier),
            multiplierBps: Number(multiplierBps),
            registered,
            rewardWeight,
            pendingStatics,
            pendingWeth,
          };
        })
      );
      return { items, tierCosts, rewardShareBps, totalWeight, ownerStatics, ownerWeth };
    },
  });

  const items = owned.data?.items ?? [];
  const selected = items.find((item) => item.id.toString() === selectedKey) ?? items[0] ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["launch-genesis-owned", deployment.descriptor.deploymentId],
    });
  };

  const activate = async (id: bigint, displayedTier: number, targetTier: number) => {
    if (!wallet || !publicClient) return;
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setBusy(id);
    setError(null);
    try {
      await verifyLaunchDeployment(publicClient, deployment);
      const [currentTier, currentCosts] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.activationRegistry,
          abi: genesisActivationRegistryAbi,
          functionName: "tierOf",
          args: [id],
        }),
        Promise.all(
          [1, 2, 3, 4].map((tier) =>
            publicClient.readContract({
              address: deployment.contracts.activationRegistry,
              abi: genesisActivationRegistryAbi,
              functionName: "tierCost",
              args: [tier],
            })
          )
        ).then(oneIndexedGenesisTierCosts),
      ]);
      if (Number(currentTier) !== displayedTier) {
        throw new Error("The activation tier changed. Review the refreshed NFT before confirming.");
      }
      const cost = cumulativeGenesisActivationCost(currentCosts, Number(currentTier), targetTier);
      const [balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.statics,
          abi: dopplerStaticsTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: deployment.contracts.statics,
          abi: dopplerStaticsTokenAbi,
          functionName: "allowance",
          args: [wallet, deployment.contracts.activationRegistry],
        }),
      ]);
      if (balance < cost) throw new Error("Insufficient STATICS for this activation tier.");
      if (allowance < cost) {
        await executeProtocolTransaction({
          publicClient,
          wallet,
          chainId: deployment.descriptor.chainId,
          deploymentId: deployment.descriptor.deploymentId,
          kind: "approve-staking-token",
          label: "Enable Genesis activation",
          amount: "Maximum STATICS",
          to: deployment.contracts.statics,
          data: encodeFunctionData({
            abi: dopplerStaticsTokenAbi,
            functionName: "approve",
            args: [deployment.contracts.activationRegistry, MAX_ERC20_ALLOWANCE],
          }),
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describeGenesisError,
        });
      }
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        deploymentId: deployment.descriptor.deploymentId,
        kind: "activate-genesis",
        label: `Activate Genesis #${id} to tier ${targetTier}`,
        amount: `${formatEther(cost)} STATICS activation payment`,
        to: deployment.contracts.activationRegistry,
        data: buildActivateGenesisCall(id, targetTier),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeGenesisError,
      });
      await refresh();
    } catch (cause) {
      setError(describeGenesisError(cause));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const recover = async (credit: RecoveryCredit) => {
    if (!publicClient) return;
    if (!wallet) {
      if (walletState.status === "wallet-missing") void walletState.createWallet();
      else walletState.connectWallet();
      return;
    }
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setRecoveryBusy(credit.genesisId);
    setRecoveryError(null);
    try {
      await verifyLaunchDeployment(publicClient, deployment);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        deploymentId: deployment.descriptor.deploymentId,
        kind: "recover-genesis-credit",
        label: `Recover Genesis #${credit.genesisId}`,
        amount: `${formatEther(credit.callerIncentive)} STATICS caller incentive`,
        to: deployment.contracts.vault,
        data: buildRecoverGenesisCreditCall(credit.genesisId),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeGenesisError,
        verifyConfirmation: async () => {
          const current = await publicClient.readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisCreditAbi,
            functionName: "credit",
            args: [credit.genesisId],
          });
          if (current.active) throw new Error("Recovery is not reflected onchain yet.");
        },
      });
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.includes(deployment.descriptor.deploymentId) &&
          ["launch-genesis", "genesis-vault"].some((prefix) =>
            String(query.queryKey[0]).startsWith(prefix)
          ),
      });
    } catch (cause) {
      setRecoveryError(describeGenesisError(cause));
      await recoveries.refetch();
    } finally {
      setRecoveryBusy(null);
    }
  };

  const sendReward = async (key: string, label: string, data: `0x${string}`, amount: string) => {
    if (!wallet || !publicClient) return;
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setRewardsBusy(key);
    setRewardsError(null);
    try {
      await verifyLaunchDeployment(publicClient, deployment);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        deploymentId: deployment.descriptor.deploymentId,
        kind: key === "accrue" ? "accrue-genesis-rewards" : "claim-rewards",
        label,
        amount,
        to: deployment.contracts.launchDistributor,
        data,
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeGenesisError,
      });
      await refresh();
    } catch (cause) {
      setRewardsError(describeGenesisError(cause));
    } finally {
      setRewardsBusy(null);
    }
  };

  if (!wallet && epoch.data !== false) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to view and manage your Genesis NFTs."
      />
    );
  }
  if (wallet && owned.isLoading) return <p className="dapp-loading">Loading Genesis NFTs…</p>;
  if (wallet && owned.error) {
    return (
      <EmptyState
        title="Genesis data unavailable"
        description={describeGenesisError(owned.error)}
      />
    );
  }
  return (
    <div className="genesis-page standalone-genesis">
      {epoch.data === false && (
        <div className="portal-direction-tabs" role="tablist" aria-label="Genesis management view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "owned"}
            onClick={() => setView("owned")}
          >
            Owned
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "recoveries"}
            onClick={() => setView("recoveries")}
          >
            Recoveries
          </button>
        </div>
      )}
      {view === "recoveries" && epoch.data === false ? (
        <section aria-label="Recoverable Genesis credits">
          {recoveryError && (
            <p className="dapp-inline-error" role="alert">
              {recoveryError}
            </p>
          )}
          {recoveries.isLoading ? (
            <p className="dapp-loading">Loading recoverable Genesis credits…</p>
          ) : recoveries.error ? (
            <p className="dapp-inline-error" role="alert">
              Recovery discovery is temporarily unavailable because the deployment indexer could not
              be reached. Owned Genesis management remains available.
            </p>
          ) : !recoveries.data?.length ? (
            <EmptyState
              title="No recoverable Genesis credits"
              description="No indexed credit is currently eligible for permissionless recovery."
            />
          ) : (
            <div className="genesis-grid">
              {recoveries.data.map((credit) => (
                <article className="ui-card genesis-card" key={credit.genesisId.toString()}>
                  <h2 className="ui-section-title">Genesis #{credit.genesisId.toString()}</h2>
                  <AddressDisplay
                    address={credit.owner}
                    chainId={deployment.descriptor.chainId}
                    label="Previous owner"
                  />
                  <p>Principal: {formatEther(credit.principal)} STATICS</p>
                  <p>Maturity: {displayTimestamp(credit.maturity)}</p>
                  <p>Recoverable since: {displayTimestamp(credit.recoverableAt)}</p>
                  <p>Unused credit: {formatEther(credit.unusedCredit)} STATICS</p>
                  <p>Caller incentive: {formatEther(credit.callerIncentive)} STATICS</p>
                  <p>Genesis distribution: {formatEther(credit.genesisDistribution)} STATICS</p>
                  <button
                    className="ui-button ui-button--primary ui-button--block"
                    type="button"
                    disabled={recoveryBusy !== null && recoveryBusy !== credit.genesisId}
                    onClick={() => void recover(credit)}
                  >
                    {recoveryBusy === credit.genesisId
                      ? "Recovering…"
                      : `Recover Genesis #${credit.genesisId}`}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {!wallet ? (
            <EmptyState
              title="Connect your wallet"
              description="Connect to view and manage your Genesis NFTs."
            />
          ) : (
            <>
              <section
                className="ui-card genesis-rewards-strip"
                aria-label="Genesis launch rewards"
              >
                <div className="genesis-summary">
                  <div className="ui-stat">
                    <span className="ui-stat__label">Genesis reward share</span>
                    <strong className="ui-stat__value">
                      {Number(owned.data?.rewardShareBps ?? 0n) / 100}%
                    </strong>
                  </div>
                  <div className="ui-stat">
                    <span className="ui-stat__label">Total registered weight</span>
                    <strong className="ui-stat__value">
                      {(owned.data?.totalWeight ?? 0n).toString()}
                    </strong>
                  </div>
                  <div className="ui-stat">
                    <span className="ui-stat__label">Retained after transfer</span>
                    <strong className="ui-stat__value">
                      {formatEther(owned.data?.ownerStatics ?? 0n)} STATICS ·{" "}
                      {formatEther(owned.data?.ownerWeth ?? 0n)} WETH
                    </strong>
                  </div>
                </div>
                <div className="ui-inline-actions">
                  <button
                    className="ui-button ui-button--primary"
                    type="button"
                    disabled={rewardsBusy !== null}
                    onClick={() =>
                      void sendReward(
                        "accrue",
                        "Update Genesis launch rewards",
                        buildAccrueGenesisLaunchRewardsCall(),
                        "Current market fees"
                      )
                    }
                  >
                    {rewardsBusy === "accrue" ? "Updating…" : "Update rewards"}
                  </button>
                  {(
                    [
                      [deployment.contracts.statics, "STATICS", owned.data?.ownerStatics ?? 0n],
                      [deployment.contracts.weth, "WETH", owned.data?.ownerWeth ?? 0n],
                    ] as const
                  ).map(([asset, symbol, amount]) => (
                    <button
                      key={asset}
                      className="ui-button ui-button--secondary"
                      type="button"
                      disabled={rewardsBusy !== null || amount === 0n}
                      onClick={() =>
                        void sendReward(
                          `owner-${symbol}`,
                          `Claim previous-owner ${symbol} rewards`,
                          buildClaimOwnerGenesisLaunchRewardsCall(asset, wallet),
                          symbol
                        )
                      }
                    >
                      {rewardsBusy === `owner-${symbol}`
                        ? "Claiming…"
                        : `Claim ${symbol} from past ownership`}
                    </button>
                  ))}
                </div>
                <p className="genesis-rewards-note">
                  Updating rewards is permissionless: it harvests current market fees into the
                  Genesis reward indexes. Rewards accrued before a Genesis is registered, or before
                  an NFT changed hands, are not included.
                </p>
                {rewardsError && (
                  <p className="dapp-inline-error" role="alert">
                    {rewardsError}
                  </p>
                )}
              </section>
              {!items.length ? (
                <EmptyState
                  title="No Genesis NFTs found"
                  description="Use Swap → NFT to acquire a fully backed Genesis NFT."
                />
              ) : (
                <>
                  {items.length > 1 && (
                    <div className="genesis-selector" role="tablist" aria-label="Your Genesis NFTs">
                      {items.map((item) => {
                        const isSelected = selected?.id === item.id;
                        const hasPending = item.pendingStatics > 0n || item.pendingWeth > 0n;
                        return (
                          <button
                            key={item.id.toString()}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            className="genesis-selector-chip"
                            onClick={() => setSelectedKey(item.id.toString())}
                          >
                            <NftArtwork
                              chainId={deployment.descriptor.chainId}
                              nft={{
                                kind: "collection",
                                tokenId: item.id,
                                contract: deployment.contracts.genesis,
                                name: `Genesis #${item.id}`,
                                summary: `Tier ${item.tier}`,
                                carries: [],
                                blockedReason: null,
                              }}
                            />
                            <span>#{item.id.toString()}</span>
                            <span className="genesis-selector-badges">
                              {!item.registered && (
                                <span className="ui-pill genesis-selector-badge">
                                  Not registered
                                </span>
                              )}
                              {hasPending && (
                                <span className="ui-pill genesis-selector-badge">
                                  Rewards pending
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selected && (
                    <article className="ui-card genesis-card">
                      <div className="genesis-card-heading">
                        <div>
                          <h2 className="ui-section-title">Genesis #{selected.id.toString()}</h2>
                          <span className="ui-pill">
                            Tier {selected.tier} · {(selected.multiplierBps / 10_000).toFixed(2)}×
                            reward weight
                          </span>
                        </div>
                        <NftArtwork
                          chainId={deployment.descriptor.chainId}
                          expandable
                          nft={{
                            kind: "collection",
                            tokenId: selected.id,
                            contract: deployment.contracts.genesis,
                            name: `Genesis #${selected.id}`,
                            summary: `Tier ${selected.tier}`,
                            carries: [],
                            blockedReason: null,
                          }}
                        />
                      </div>
                      {selected.tier < 4 && (
                        <div className="genesis-action">
                          <label className="ui-field">
                            Activate through tier
                            <select
                              value={
                                targetTiers[selected.id.toString()] ??
                                Math.min(4, selected.tier + 1)
                              }
                              onChange={(event) =>
                                setTargetTiers((current) => ({
                                  ...current,
                                  [selected.id.toString()]: Number(event.target.value),
                                }))
                              }
                            >
                              {[1, 2, 3, 4]
                                .filter((tier) => tier > selected.tier)
                                .map((tier) => (
                                  <option key={tier} value={tier}>
                                    Tier {tier}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <p>
                            Activation cost:{" "}
                            {formatEther(
                              cumulativeGenesisActivationCost(
                                owned.data?.tierCosts ?? [],
                                selected.tier,
                                targetTiers[selected.id.toString()] ??
                                  Math.min(4, selected.tier + 1)
                              )
                            )}{" "}
                            STATICS
                          </p>
                          <button
                            className="ui-button ui-button--primary ui-button--block"
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              void activate(
                                selected.id,
                                selected.tier,
                                targetTiers[selected.id.toString()] ??
                                  Math.min(4, selected.tier + 1)
                              )
                            }
                          >
                            {busy === selected.id ? "Confirming…" : "Activate"}
                          </button>
                          <p>Activation payments are transferred to the Statics treasury.</p>
                        </div>
                      )}
                      <section
                        className="genesis-rewards-block"
                        aria-label="Genesis launch rewards"
                      >
                        <p className="dapp-eyebrow">Launch rewards</p>
                        {!selected.registered ? (
                          <>
                            <button
                              className="ui-button ui-button--secondary ui-button--block"
                              type="button"
                              disabled={rewardsBusy !== null}
                              onClick={() =>
                                void sendReward(
                                  `register-${selected.id.toString()}`,
                                  `Register Genesis #${selected.id}`,
                                  buildRegisterGenesisCall(selected.id),
                                  `Genesis #${selected.id}`
                                )
                              }
                            >
                              {rewardsBusy === `register-${selected.id.toString()}`
                                ? "Registering…"
                                : "Register for rewards"}
                            </button>
                            <p>
                              Registration starts accruing from the current reward index with this
                              NFT&apos;s activation weight. Fees earned before registration are not
                              included.
                            </p>
                          </>
                        ) : (
                          <>
                            <p>Effective reward weight: {selected.rewardWeight.toString()}</p>
                            <p>
                              Pending: {formatEther(selected.pendingStatics)} STATICS ·{" "}
                              {formatEther(selected.pendingWeth)} WETH
                            </p>
                            <div className="ui-inline-actions">
                              {(
                                [
                                  [
                                    deployment.contracts.statics,
                                    "STATICS",
                                    selected.pendingStatics,
                                  ],
                                  [deployment.contracts.weth, "WETH", selected.pendingWeth],
                                ] as const
                              ).map(([asset, symbol, amount]) => (
                                <button
                                  key={asset}
                                  className="ui-button ui-button--secondary"
                                  type="button"
                                  disabled={rewardsBusy !== null || amount === 0n}
                                  onClick={() =>
                                    void sendReward(
                                      `claim-${selected.id.toString()}-${symbol}`,
                                      `Claim Genesis #${selected.id} ${symbol} rewards`,
                                      buildClaimGenesisLaunchRewardsCall(
                                        selected.id,
                                        asset,
                                        wallet
                                      ),
                                      symbol
                                    )
                                  }
                                >
                                  {rewardsBusy === `claim-${selected.id.toString()}-${symbol}`
                                    ? "Claiming…"
                                    : `Claim ${symbol}`}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </section>
                      <GenesisCreditPanel deployment={deployment} genesisId={selected.id} />
                      <p className="genesis-warning">
                        Transferring this Genesis NFT resets its activation to Tier 0. Rewards
                        earned before transfer remain claimable by the previous owner. Active
                        secured credit locks transfers until repayment or recovery.
                      </p>
                      {error && (
                        <p className="dapp-inline-error" role="alert">
                          {error}
                        </p>
                      )}
                    </article>
                  )}
                </>
              )}
              <section className="genesis-contracts ui-card">
                <AddressDisplay
                  address={deployment.contracts.genesis}
                  chainId={deployment.descriptor.chainId}
                  label="Genesis NFT"
                />
                <AddressDisplay
                  address={deployment.contracts.launchDistributor}
                  chainId={deployment.descriptor.chainId}
                  label="Rewards distributor"
                />
                <AddressDisplay
                  address={deployment.contracts.activationRegistry}
                  chainId={deployment.descriptor.chainId}
                  label="Activation registry"
                />
                <AddressDisplay
                  address={deployment.contracts.vault}
                  chainId={deployment.descriptor.chainId}
                  label="Genesis Vault"
                />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
