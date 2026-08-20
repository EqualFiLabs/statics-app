"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useState } from "react";
import {
  buildAccrueGenesisLaunchRewardsCall,
  buildClaimGenesisLaunchRewardsCall,
  buildClaimOwnerGenesisLaunchRewardsCall,
  buildRegisterGenesisCall,
  genesisLaunchDistributorAbi,
} from "@statics-protocol/sdk";

import { EmptyState } from "@/components/common/EmptyState";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { discoverWalletGenesisIds } from "@/lib/genesis/discovery";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  return message || "The Genesis rewards transaction failed.";
}

export function GenesisRewardsPage() {
  const { active } = useDeployment();
  if (!active.launch) {
    return (
      <EmptyState
        title="Genesis rewards unavailable"
        description={active.descriptor.unavailableReason ?? "Genesis rewards are not deployed yet."}
      />
    );
  }
  return <GenesisRewardsRuntime deployment={active.launch} />;
}

function GenesisRewardsRuntime({ deployment }: { deployment: LaunchDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rewards = useQuery({
    queryKey: ["launch-genesis-rewards", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet) throw new Error("Connect a wallet first.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [ids, rewardShare, totalWeight, ownerStatics, ownerWeth] = await Promise.all([
        discoverWalletGenesisIds(publicClient, deployment, wallet),
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
        ids.map(async (id) => {
          const [registered, weight, pendingStatics, pendingWeth] = await Promise.all([
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
          return { id, registered, weight, pendingStatics, pendingWeth };
        })
      );
      return { items, rewardShare, totalWeight, ownerStatics, ownerWeth };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["launch-genesis-rewards", deployment.descriptor.deploymentId],
    });
  };
  const send = async (key: string, label: string, data: `0x${string}`, amount: string) => {
    if (!wallet || !publicClient) return;
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setBusy(key);
    setError(null);
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
        describeError,
      });
      await refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(null);
    }
  };

  if (!wallet) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to register Genesis NFTs and claim launch rewards."
      />
    );
  }
  if (rewards.isLoading) return <p className="dapp-loading">Loading Genesis rewards…</p>;
  if (rewards.error) {
    return (
      <EmptyState title="Genesis rewards unavailable" description={describeError(rewards.error)} />
    );
  }

  return (
    <div className="genesis-page standalone-genesis">
      <section className="genesis-summary ui-card">
        <div className="ui-stat">
          <span className="ui-stat__label">Genesis reward share</span>
          <strong className="ui-stat__value">
            {Number(rewards.data?.rewardShare ?? 0) / 100}%
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Total registered weight</span>
          <strong className="ui-stat__value">{rewards.data?.totalWeight.toString() ?? "0"}</strong>
        </div>
      </section>
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="genesis-reward-layout">
        <section className="ui-card">
          <p className="dapp-eyebrow">Permissionless accounting</p>
          <h2>Update launch rewards</h2>
          <p>Harvest current market fees and add them to the Genesis reward indexes.</p>
          <button
            className="ui-button ui-button--primary"
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void send(
                "accrue",
                "Update Genesis launch rewards",
                buildAccrueGenesisLaunchRewardsCall(),
                "Current market fees"
              )
            }
          >
            {busy === "accrue" ? "Updating…" : "Update rewards"}
          </button>
        </section>
        <section className="ui-card">
          <p className="dapp-eyebrow">Previous-owner claims</p>
          <h2>Rewards retained after transfer</h2>
          <p>
            {formatEther(rewards.data?.ownerStatics ?? 0n)} STATICS ·{" "}
            {formatEther(rewards.data?.ownerWeth ?? 0n)} WETH
          </p>
          <div className="ui-inline-actions">
            {([deployment.contracts.statics, deployment.contracts.weth] as const).map((asset) => {
              const symbol = asset === deployment.contracts.statics ? "STATICS" : "WETH";
              const amount =
                symbol === "STATICS" ? rewards.data?.ownerStatics : rewards.data?.ownerWeth;
              return (
                <button
                  key={asset}
                  className="ui-button ui-button--secondary"
                  type="button"
                  disabled={busy !== null || amount === 0n}
                  onClick={() =>
                    void send(
                      `owner-${symbol}`,
                      `Claim previous-owner ${symbol} rewards`,
                      buildClaimOwnerGenesisLaunchRewardsCall(asset, wallet),
                      symbol
                    )
                  }
                >
                  {busy === `owner-${symbol}` ? "Claiming…" : `Claim ${symbol}`}
                </button>
              );
            })}
          </div>
        </section>
        {(rewards.data?.items ?? []).map((item) => (
          <article className="ui-card" key={item.id.toString()}>
            <h2>Genesis #{item.id.toString()}</h2>
            {!item.registered ? (
              <button
                className="ui-button ui-button--primary"
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void send(
                    `register-${item.id}`,
                    `Register Genesis #${item.id}`,
                    buildRegisterGenesisCall(item.id),
                    `Genesis #${item.id}`
                  )
                }
              >
                {busy === `register-${item.id}` ? "Registering…" : "Register for rewards"}
              </button>
            ) : (
              <>
                <p>Effective weight: {item.weight.toString()}</p>
                <p>
                  {formatEther(item.pendingStatics)} STATICS · {formatEther(item.pendingWeth)} WETH
                </p>
                <div className="ui-inline-actions">
                  {([deployment.contracts.statics, deployment.contracts.weth] as const).map(
                    (asset) => {
                      const symbol = asset === deployment.contracts.statics ? "STATICS" : "WETH";
                      const amount = symbol === "STATICS" ? item.pendingStatics : item.pendingWeth;
                      return (
                        <button
                          key={asset}
                          className="ui-button ui-button--secondary"
                          type="button"
                          disabled={busy !== null || amount === 0n}
                          onClick={() =>
                            void send(
                              `claim-${item.id}-${symbol}`,
                              `Claim Genesis #${item.id} ${symbol} rewards`,
                              buildClaimGenesisLaunchRewardsCall(item.id, asset, wallet),
                              symbol
                            )
                          }
                        >
                          {busy === `claim-${item.id}-${symbol}` ? "Claiming…" : `Claim ${symbol}`}
                        </button>
                      );
                    }
                  )}
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
