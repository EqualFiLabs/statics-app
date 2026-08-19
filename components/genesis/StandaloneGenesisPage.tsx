"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  buildActivateGenesisCall,
  buildAccrueGenesisLaunchRewardsCall,
  buildBuyGenesisTransaction,
  buildClaimGenesisLaunchRewardsCall,
  buildClaimOwnerGenesisLaunchRewardsCall,
  buildRedeemGenesisCall,
  buildRegisterGenesisCall,
  cumulativeGenesisActivationCost,
  dopplerStaticsTokenAbi,
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
  staticsGenesisAbi,
  staticsGenesisVaultAbi,
} from "@statics-protocol/sdk";

import { EmptyState } from "@/components/common/EmptyState";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  configuredIndexerUrlForDeployment,
  loadLaunchGenesisInventoryIds,
} from "@/lib/indexer/statics";
import { discoverWalletGenesisIds } from "@/lib/genesis/discovery";
import { useWalletState } from "@/providers/wallet-context";

type GenesisView = "explore" | "mine" | "rewards";

function describeGenesisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("GenesisLocked")) return "Unlink this Genesis NFT before continuing.";
  if (message.includes("NotGenesisOwner")) return "This wallet no longer owns that Genesis NFT.";
  return message || "The Genesis transaction failed.";
}

export function StandaloneGenesisPage({ deployment }: { deployment: LaunchDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [view, setView] = useState<GenesisView>("explore");
  const [inventoryStart, setInventoryStart] = useState(1);
  const [targetTiers, setTargetTiers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["launch-genesis-summary", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [quote, accounting, rewardShare, totalWeight, tierCosts, staticsBalance, allowance] =
        await Promise.all([
          publicClient.readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisVaultAbi,
            functionName: "quoteGenesisPurchase",
          }),
          publicClient.readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisVaultAbi,
            functionName: "vaultAccounting",
          }),
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
          Promise.all(
            [1, 2, 3, 4].map((tier) =>
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "tierCost",
                args: [tier],
              })
            )
          ),
          wallet
            ? publicClient.readContract({
                address: deployment.contracts.statics,
                abi: dopplerStaticsTokenAbi,
                functionName: "balanceOf",
                args: [wallet],
              })
            : 0n,
          wallet
            ? publicClient.readContract({
                address: deployment.contracts.statics,
                abi: dopplerStaticsTokenAbi,
                functionName: "allowance",
                args: [wallet, deployment.contracts.vault],
              })
            : 0n,
        ]);
      return { quote, accounting, rewardShare, totalWeight, tierCosts, staticsBalance, allowance };
    },
  });

  const inventoryIds = Array.from({ length: 12 }, (_, index) =>
    BigInt(inventoryStart + index)
  ).filter((id) => id <= 5_555n);
  const inventory = useQuery({
    queryKey: ["launch-genesis-inventory", deployment.descriptor.deploymentId, inventoryStart],
    enabled: Boolean(publicClient) && view === "explore",
    queryFn: async () => {
      if (!publicClient) return [];
      const indexed = configuredIndexerUrlForDeployment(deployment.descriptor.deploymentId)
        ? await loadLaunchGenesisInventoryIds(deployment.descriptor.deploymentId).catch(() => [])
        : [];
      const candidates = indexed.length
        ? indexed.slice(Math.max(0, inventoryStart - 1), inventoryStart + 11)
        : inventoryIds;
      const available = await publicClient.multicall({
        allowFailure: true,
        contracts: candidates.map((id) => ({
          address: deployment.contracts.vault,
          abi: staticsGenesisVaultAbi,
          functionName: "isVaultInventory" as const,
          args: [id] as const,
        })),
      });
      return candidates.filter(
        (_, index) => available[index]?.status === "success" && available[index].result === true
      );
    },
  });

  const owned = useQuery({
    queryKey: ["launch-genesis-owned", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet) && view !== "explore",
    queryFn: async () => {
      if (!publicClient || !wallet) return [];
      const ids = await discoverWalletGenesisIds(publicClient, deployment, wallet);
      return Promise.all(
        ids.map(async (id) => {
          const [tier, multiplierBps, registered, weight, pendingStatics, pendingWeth, approved] =
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
              publicClient.readContract({
                address: deployment.contracts.genesis,
                abi: staticsGenesisAbi,
                functionName: "getApproved",
                args: [id],
              }),
            ]);
          return {
            id,
            tier: Number(tier),
            multiplierBps: Number(multiplierBps),
            registered,
            weight,
            pendingStatics,
            pendingWeth,
            approved,
          };
        })
      );
    },
  });

  const previousOwnerRewards = useQuery({
    queryKey: ["launch-genesis-owner-rewards", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet) && view === "rewards",
    queryFn: async () => {
      if (!publicClient || !wallet) return { statics: 0n, weth: 0n };
      const [statics, weth] = await Promise.all([
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
      return { statics, weth };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        String(query.queryKey[0]).startsWith("launch-genesis") &&
        query.queryKey.includes(deployment.descriptor.deploymentId),
    });
  };
  const transact = async (
    key: string,
    request: Parameters<typeof executeProtocolTransaction>[0]
  ) => {
    setBusy(key);
    setError(null);
    try {
      await verifyLaunchDeployment(request.publicClient, deployment);
      await executeProtocolTransaction({
        ...request,
        deploymentId: deployment.descriptor.deploymentId,
      });
      await refresh();
    } catch (cause) {
      setError(describeGenesisError(cause));
    } finally {
      setBusy(null);
    }
  };

  const walletAction = () => {
    if (walletState.status === "signed-out" || walletState.status === "error") {
      walletState.login();
      return false;
    }
    if (walletState.status === "wallet-missing") {
      void walletState.createWallet();
      return false;
    }
    if (walletState.status === "ready" && !walletState.isTargetChain) {
      void walletState.switchNetwork();
      return false;
    }
    return walletState.status === "ready" && Boolean(wallet && publicClient);
  };

  const buy = async (id: bigint) => {
    if (!walletAction() || !wallet || !publicClient || !summary.data) return;
    const [price, nativeFee] = await publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "quoteGenesisPurchase",
    });
    if (summary.data.staticsBalance < price) {
      setError("Buy STATICS first, then return to acquire this Genesis NFT.");
      return;
    }
    if (summary.data.allowance < price) {
      await transact(`buy-${id}`, {
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        kind: "approve-staking-token",
        label: "Approve STATICS for Genesis acquisition",
        amount: "Maximum STATICS",
        to: deployment.contracts.statics,
        data: encodeFunctionData({
          abi: dopplerStaticsTokenAbi,
          functionName: "approve",
          args: [deployment.contracts.vault, MAX_ERC20_ALLOWANCE],
        }),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeGenesisError,
      });
      return;
    }
    const purchase = buildBuyGenesisTransaction(id, wallet, nativeFee);
    await transact(`buy-${id}`, {
      publicClient,
      wallet,
      chainId: deployment.descriptor.chainId,
      kind: "buy-genesis",
      label: `Acquire Genesis #${id}`,
      amount: `${formatEther(price)} STATICS + ${formatEther(nativeFee)} ETH`,
      to: deployment.contracts.vault,
      data: purchase.data,
      value: purchase.value,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeGenesisError,
    });
  };

  const sendDistributor = async (
    key: string,
    label: string,
    data: `0x${string}`,
    amount: string,
    kind: "claim-rewards" | "accrue-genesis-rewards" = "claim-rewards"
  ) => {
    if (!walletAction() || !wallet || !publicClient) return;
    await transact(key, {
      publicClient,
      wallet,
      chainId: deployment.descriptor.chainId,
      kind,
      label,
      amount,
      to: deployment.contracts.launchDistributor,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeGenesisError,
    });
  };

  return (
    <div className="genesis-page standalone-genesis">
      <section className="genesis-summary ui-card">
        <div className="ui-stat">
          <span className="ui-stat__label">Vault inventory</span>
          <strong className="ui-stat__value">
            {summary.data ? summary.data.accounting.vaultInventory.toString() : "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Fixed backing</span>
          <strong className="ui-stat__value">
            {summary.data ? `${formatEther(summary.data.quote[0])} STATICS` : "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Genesis reward share</span>
          <strong className="ui-stat__value">
            {summary.data ? `${Number(summary.data.rewardShare) / 100}%` : "—"}
          </strong>
        </div>
      </section>
      <div className="portal-direction-tabs" aria-label="Genesis views">
        {(["explore", "mine", "rewards"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
          >
            {item === "explore"
              ? "Explore the Vault"
              : item === "mine"
                ? "My Genesis NFTs"
                : "Launch rewards"}
          </button>
        ))}
      </div>
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}

      {view === "explore" && (
        <>
          <div className="genesis-grid">
            {(inventory.data ?? []).map((id) => (
              <article className="ui-card genesis-card" key={id.toString()}>
                <div className="genesis-card-heading">
                  <div>
                    <h2 className="ui-section-title">Genesis #{id.toString()}</h2>
                    <span className="ui-pill">Vault inventory</span>
                  </div>
                  <NftArtwork
                    chainId={deployment.descriptor.chainId}
                    expandable
                    nft={{
                      kind: "collection",
                      tokenId: id,
                      contract: deployment.contracts.genesis,
                      name: `Genesis #${id}`,
                      summary: "Vault inventory",
                      carries: [],
                      blockedReason: null,
                    }}
                  />
                </div>
                <p>
                  {summary.data
                    ? `${formatEther(summary.data.quote[0])} STATICS + ${formatEther(summary.data.quote[1])} ETH`
                    : "Reading current price…"}
                </p>
                <button
                  className="ui-button ui-button--primary ui-button--block"
                  type="button"
                  disabled={busy !== null || !summary.data}
                  onClick={() => void buy(id)}
                >
                  {busy === `buy-${id}`
                    ? "Confirming…"
                    : summary.data && summary.data.allowance < summary.data.quote[0]
                      ? "Approve STATICS"
                      : "Acquire Genesis"}
                </button>
              </article>
            ))}
          </div>
          <div className="genesis-pagination">
            <button
              className="ui-button ui-button--secondary"
              type="button"
              disabled={inventoryStart === 1}
              onClick={() => setInventoryStart(Math.max(1, inventoryStart - 12))}
            >
              Previous
            </button>
            <span>
              IDs {inventoryStart}–{Math.min(5_555, inventoryStart + 11)}
            </span>
            <button
              className="ui-button ui-button--secondary"
              type="button"
              disabled={inventoryStart + 12 > 5_555}
              onClick={() => setInventoryStart(inventoryStart + 12)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {view !== "explore" && !wallet && (
        <EmptyState
          title="Connect your wallet"
          description="Connect to view your Genesis NFTs and launch rewards."
        />
      )}
      {view === "mine" && wallet && owned.isLoading && (
        <p className="dapp-loading">Loading Genesis NFTs…</p>
      )}
      {view === "mine" && wallet && !owned.isLoading && !owned.data?.length && (
        <EmptyState
          title="No Genesis NFTs found"
          description="Acquire one from the Vault to activate it and earn launch rewards."
        />
      )}
      {view === "mine" && wallet && (
        <div className="genesis-grid">
          {(owned.data ?? []).map((item) => {
            const target = targetTiers[item.id.toString()] ?? Math.min(4, item.tier + 1);
            const cost = summary.data
              ? cumulativeGenesisActivationCost(summary.data.tierCosts, item.tier, target)
              : 0n;
            return (
              <article className="ui-card genesis-card" key={item.id.toString()}>
                <div className="genesis-card-heading">
                  <div>
                    <h2 className="ui-section-title">Genesis #{item.id.toString()}</h2>
                    <span className="ui-pill">
                      Tier {item.tier} · {(item.multiplierBps / 10_000).toFixed(2)}×
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
                {!item.registered && (
                  <button
                    className="ui-button ui-button--primary ui-button--block"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void sendDistributor(
                        `register-${item.id}`,
                        `Register Genesis #${item.id}`,
                        buildRegisterGenesisCall(item.id),
                        "Launch rewards"
                      )
                    }
                  >
                    {busy === `register-${item.id}`
                      ? "Registering…"
                      : "Register for launch rewards"}
                  </button>
                )}
                {item.tier < 4 && summary.data && (
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
                    <p>Burn cost: {formatEther(cost)} STATICS</p>
                    <button
                      className="ui-button ui-button--primary ui-button--block"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (!walletAction() || !publicClient || !wallet) return;
                        const activate = async () => {
                          const allowance = await publicClient.readContract({
                            address: deployment.contracts.statics,
                            abi: dopplerStaticsTokenAbi,
                            functionName: "allowance",
                            args: [wallet, deployment.contracts.activationRegistry],
                          });
                          if (allowance < cost) {
                            await transact(`activate-${item.id}`, {
                              publicClient,
                              wallet,
                              chainId: deployment.descriptor.chainId,
                              kind: "approve-staking-token",
                              label: "Approve STATICS for activation",
                              amount: "Maximum STATICS",
                              to: deployment.contracts.statics,
                              data: encodeFunctionData({
                                abi: dopplerStaticsTokenAbi,
                                functionName: "approve",
                                args: [
                                  deployment.contracts.activationRegistry,
                                  MAX_ERC20_ALLOWANCE,
                                ],
                              }),
                              sendTransaction: walletState.sendEvmTransaction,
                              describeError: describeGenesisError,
                            });
                            return;
                          }
                          await transact(`activate-${item.id}`, {
                            publicClient,
                            wallet,
                            chainId: deployment.descriptor.chainId,
                            kind: "activate-genesis",
                            label: `Activate Genesis #${item.id} to tier ${target}`,
                            amount: `${formatEther(cost)} STATICS burned`,
                            to: deployment.contracts.activationRegistry,
                            data: buildActivateGenesisCall(item.id, target),
                            sendTransaction: walletState.sendEvmTransaction,
                            describeError: describeGenesisError,
                          });
                        };
                        void activate();
                      }}
                    >
                      {busy === `activate-${item.id}` ? "Confirming…" : "Activate"}
                    </button>
                  </div>
                )}
                <button
                  className="ui-button ui-button--secondary ui-button--block"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!walletAction() || !publicClient || !wallet) return;
                    const redeem = async () => {
                      if (getAddress(item.approved) !== getAddress(deployment.contracts.vault)) {
                        await transact(`redeem-${item.id}`, {
                          publicClient,
                          wallet,
                          chainId: deployment.descriptor.chainId,
                          kind: "approve-genesis",
                          label: `Approve Genesis #${item.id} redemption`,
                          amount: `Genesis #${item.id}`,
                          to: deployment.contracts.genesis,
                          data: encodeFunctionData({
                            abi: staticsGenesisAbi,
                            functionName: "approve",
                            args: [deployment.contracts.vault, item.id],
                          }),
                          sendTransaction: walletState.sendEvmTransaction,
                          describeError: describeGenesisError,
                        });
                        return;
                      }
                      await transact(`redeem-${item.id}`, {
                        publicClient,
                        wallet,
                        chainId: deployment.descriptor.chainId,
                        kind: "redeem-genesis",
                        label: `Redeem Genesis #${item.id}`,
                        amount: `${formatEther(summary.data?.quote[0] ?? 0n)} STATICS`,
                        to: deployment.contracts.vault,
                        data: buildRedeemGenesisCall(item.id, wallet),
                        sendTransaction: walletState.sendEvmTransaction,
                        describeError: describeGenesisError,
                      });
                    };
                    void redeem();
                  }}
                >
                  {busy === `redeem-${item.id}`
                    ? "Confirming…"
                    : getAddress(item.approved) === getAddress(deployment.contracts.vault)
                      ? "Redeem for STATICS"
                      : "Approve redemption"}
                </button>
                <p className="genesis-warning">
                  Transferring this Genesis NFT resets its activation to Tier 0. Rewards earned
                  before transfer remain claimable by the previous owner.
                </p>
              </article>
            );
          })}
        </div>
      )}

      {view === "rewards" && wallet && (
        <div className="genesis-reward-layout">
          <section className="ui-card">
            <p className="dapp-eyebrow">Permissionless accounting</p>
            <h2>Update launch rewards</h2>
            <p>
              Harvest current market fees and add them to the Genesis reward indexes. This does not
              claim anyone else&apos;s rewards.
            </p>
            <button
              className="ui-button ui-button--primary"
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void sendDistributor(
                  "accrue-launch-rewards",
                  "Update Genesis launch rewards",
                  buildAccrueGenesisLaunchRewardsCall(),
                  "Current market fees",
                  "accrue-genesis-rewards"
                )
              }
            >
              {busy === "accrue-launch-rewards" ? "Updating…" : "Update rewards"}
            </button>
          </section>
          <section className="ui-card">
            <p className="dapp-eyebrow">Previous-owner claims</p>
            <h2>Rewards kept after transfer</h2>
            <p>
              {formatEther(previousOwnerRewards.data?.statics ?? 0n)} STATICS ·{" "}
              {formatEther(previousOwnerRewards.data?.weth ?? 0n)} WETH
            </p>
            {([deployment.contracts.statics, deployment.contracts.weth] as const).map((asset) => {
              const symbol = asset === deployment.contracts.statics ? "STATICS" : "WETH";
              return (
                <button
                  key={asset}
                  className="ui-button ui-button--secondary"
                  type="button"
                  disabled={
                    busy !== null ||
                    (symbol === "STATICS"
                      ? previousOwnerRewards.data?.statics
                      : previousOwnerRewards.data?.weth) === 0n
                  }
                  onClick={() =>
                    void sendDistributor(
                      `owner-${asset}`,
                      `Claim previous-owner ${symbol} rewards`,
                      buildClaimOwnerGenesisLaunchRewardsCall(asset, wallet),
                      symbol
                    )
                  }
                >
                  {busy === `owner-${asset}` ? "Claiming…" : `Claim ${symbol}`}
                </button>
              );
            })}
          </section>
          {(owned.data ?? [])
            .filter((item) => item.registered)
            .map((item) => (
              <article className="ui-card" key={item.id.toString()}>
                <h2>Genesis #{item.id.toString()}</h2>
                <p>Effective weight: {item.weight.toString()}</p>
                <p>
                  {formatEther(item.pendingStatics)} STATICS · {formatEther(item.pendingWeth)} WETH
                </p>
                <div className="ui-inline-actions">
                  <button
                    className="ui-button ui-button--secondary"
                    type="button"
                    disabled={busy !== null || item.pendingStatics === 0n}
                    onClick={() =>
                      void sendDistributor(
                        `claim-${item.id}-statics`,
                        `Claim Genesis #${item.id} STATICS rewards`,
                        buildClaimGenesisLaunchRewardsCall(
                          item.id,
                          deployment.contracts.statics,
                          wallet
                        ),
                        "STATICS"
                      )
                    }
                  >
                    Claim STATICS
                  </button>
                  <button
                    className="ui-button ui-button--secondary"
                    type="button"
                    disabled={busy !== null || item.pendingWeth === 0n}
                    onClick={() =>
                      void sendDistributor(
                        `claim-${item.id}-weth`,
                        `Claim Genesis #${item.id} WETH rewards`,
                        buildClaimGenesisLaunchRewardsCall(
                          item.id,
                          deployment.contracts.weth,
                          wallet
                        ),
                        "WETH"
                      )
                    }
                  >
                    Claim WETH
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}

      <section className="genesis-contracts ui-card">
        <AddressDisplay
          address={deployment.contracts.genesis}
          chainId={deployment.descriptor.chainId}
          label="Genesis NFT"
        />
        <AddressDisplay
          address={deployment.contracts.vault}
          chainId={deployment.descriptor.chainId}
          label="Genesis Vault"
        />
        <AddressDisplay
          address={deployment.contracts.statics}
          chainId={deployment.descriptor.chainId}
          label="STATICS"
        />
      </section>
    </div>
  );
}
