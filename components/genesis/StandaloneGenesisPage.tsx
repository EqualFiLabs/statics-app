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

import { EmptyState } from "@/components/common/EmptyState";
import { GenesisCreditPanel } from "@/components/genesis/GenesisCreditPanel";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";
import { discoverWalletGenesisIds } from "@/lib/genesis/discovery";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

function describeGenesisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("NotGenesisOwner")) return "This wallet no longer owns that Genesis NFT.";
  return message || "The Genesis transaction failed.";
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

  if (!wallet) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to view and manage your Genesis NFTs."
      />
    );
  }
  if (owned.isLoading) return <p className="dapp-loading">Loading Genesis NFTs…</p>;
  if (owned.error) {
    return (
      <EmptyState
        title="Genesis data unavailable"
        description={describeGenesisError(owned.error)}
      />
    );
  }

  return (
    <div className="genesis-page standalone-genesis">
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      {!owned.data?.items.length ? (
        <EmptyState
          title="No Genesis NFTs found"
          description="Use Swap → NFT to acquire a fully backed Genesis NFT."
        />
      ) : (
        <div className="genesis-grid">
          {owned.data.items.map((item) => {
            const target = targetTiers[item.id.toString()] ?? Math.min(4, item.tier + 1);
            const cost = cumulativeGenesisActivationCost(owned.data.tierCosts, item.tier, target);
            return (
              <article className="ui-card genesis-card" key={item.id.toString()}>
                <div className="genesis-card-heading">
                  <div>
                    <h2 className="ui-section-title">Genesis #{item.id.toString()}</h2>
                    <span className="ui-pill">
                      Tier {item.tier} · {(item.multiplierBps / 10_000).toFixed(2)}× reward weight
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
    </div>
  );
}
