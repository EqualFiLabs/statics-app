"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  buildActivateGenesisCall,
  cumulativeGenesisActivationCost,
  dopplerStaticsTokenAbi,
  genesisActivationRegistryAbi,
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
      if (!publicClient || !wallet) return { items: [], tierCosts: [] as readonly bigint[] };
      await verifyLaunchDeployment(publicClient, deployment);
      const [ids, tierCosts] = await Promise.all([
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
      ]);
      const items = await Promise.all(
        ids.map(async (id) => {
          const [tier, multiplierBps] = await Promise.all([
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
          ]);
          return { id, tier: Number(tier), multiplierBps: Number(multiplierBps) };
        })
      );
      return { items, tierCosts };
    },
  });

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
          ["launch-genesis-rewards", "genesis-vault"].some((prefix) =>
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
          ) : !owned.data?.items.length ? (
            <EmptyState
              title="No Genesis NFTs found"
              description="Use Swap → NFT to acquire a fully backed Genesis NFT."
            />
          ) : (
            <div className="genesis-grid">
              {owned.data.items.map((item) => {
                const target = targetTiers[item.id.toString()] ?? Math.min(4, item.tier + 1);
                const cost = cumulativeGenesisActivationCost(
                  owned.data.tierCosts,
                  item.tier,
                  target
                );
                return (
                  <article className="ui-card genesis-card" key={item.id.toString()}>
                    <div className="genesis-card-heading">
                      <div>
                        <h2 className="ui-section-title">Genesis #{item.id.toString()}</h2>
                        <span className="ui-pill">
                          Tier {item.tier} · {(item.multiplierBps / 10_000).toFixed(2)}× reward
                          weight
                        </span>
                      </div>
                      <NftArtwork
                        chainId={deployment.descriptor.chainId}
                        expandable
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
                    </div>
                    {item.tier < 4 && (
                      <div className="genesis-action">
                        <label className="ui-field">
                          Activate through tier
                          <select
                            value={target}
                            onChange={(event) =>
                              setTargetTiers((current) => ({
                                ...current,
                                [item.id.toString()]: Number(event.target.value),
                              }))
                            }
                          >
                            {[1, 2, 3, 4]
                              .filter((tier) => tier > item.tier)
                              .map((tier) => (
                                <option key={tier} value={tier}>
                                  Tier {tier}
                                </option>
                              ))}
                          </select>
                        </label>
                        <p>Activation cost: {formatEther(cost)} STATICS</p>
                        <button
                          className="ui-button ui-button--primary ui-button--block"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void activate(item.id, item.tier, target)}
                        >
                          {busy === item.id ? "Confirming…" : "Activate"}
                        </button>
                        <p>Activation payments are transferred to the Statics treasury.</p>
                      </div>
                    )}
                    <GenesisCreditPanel deployment={deployment} genesisId={item.id} />
                    <p className="genesis-warning">
                      Transferring this Genesis NFT resets its activation to Tier 0. Rewards earned
                      before transfer remain claimable by the previous owner. Active secured credit
                      locks transfers until repayment or recovery.
                    </p>
                  </article>
                );
              })}
            </div>
          )}
          <section className="genesis-contracts ui-card">
            <AddressDisplay
              address={deployment.contracts.genesis}
              chainId={deployment.descriptor.chainId}
              label="Genesis NFT"
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
    </div>
  );
}
