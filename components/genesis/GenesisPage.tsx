"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  buildActivateGenesisCall,
  buildCheckpointRewardAssetsCall,
  buildLinkGenesisCall,
  buildUnlinkGenesisCall,
  staticsAbi,
  staticsTokenAbi,
} from "@statics-protocol/sdk";

import { EmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { loadWalletGenesis } from "@/lib/indexer/statics";
import { loadPositionCatalog } from "@/lib/positions/positions";
import {
  checkpointRewardAssetBatches,
  rewardAssetsNeedingCheckpoint,
} from "@/lib/positions/staking";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

function describeGenesisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GenesisLinkedOnTransfer"))
    return "Unlink this Genesis NFT before transferring it.";
  if (message.includes("GenesisAlreadyLinked")) return "This Genesis NFT is already linked.";
  if (message.includes("PositionAlreadyLinked")) return "That Position already has a Genesis NFT.";
  if (message.includes("InvalidActivationTier")) return "Choose a higher activation tier.";
  if (message.includes("ERC20InsufficientAllowance"))
    return "Approve STATICS before activating this tier.";
  if (message.includes("User rejected") || message.includes("rejected the request"))
    return "The wallet request was rejected.";
  return message || "The Genesis action failed.";
}

export function GenesisPage() {
  if (deploymentState.status !== "configured" || !deploymentState.deployment.genesis)
    return <UnconfiguredSurface subject="Genesis" />;
  return <GenesisWalletGate />;
}

function GenesisWalletGate() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Genesis" />;
  return <GenesisRuntime />;
}

function GenesisRuntime() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [positions, setPositions] = useState<Record<string, string>>({});

  const portfolio = useQuery({
    queryKey: [
      "genesis-portfolio",
      wallet,
      deploymentState.status === "configured" ? deploymentState.deployment.protocolCommit : null,
    ],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient && wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    queryFn: async () => {
      if (
        !publicClient ||
        !wallet ||
        deploymentState.status !== "configured" ||
        !deploymentState.deployment.genesis
      ) {
        throw new Error("No verified Genesis deployment is configured.");
      }
      const deployment = deploymentState.deployment;
      const genesisDeployment = deployment.genesis;
      if (!genesisDeployment) throw new Error("No verified Genesis deployment is configured.");
      await verifyDollarDeployment(publicClient, deployment);
      const [indexed, positionCatalog, balance, allowance, costs] = await Promise.all([
        loadWalletGenesis(wallet),
        loadPositionCatalog(publicClient, deployment, wallet),
        publicClient.readContract({
          address: genesisDeployment.token,
          abi: staticsTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: genesisDeployment.token,
          abi: staticsTokenAbi,
          functionName: "allowance",
          args: [wallet, deployment.contracts.diamond],
        }),
        Promise.all(
          [1, 2, 3, 4].map((tier) =>
            publicClient.readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "genesisActivationCost",
              args: [tier],
            })
          )
        ),
      ]);
      const genesis = await Promise.all(
        indexed.map(async (item) => ({
          ...item,
          state: await publicClient.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "genesisState",
            args: [item.id],
          }),
        }))
      );
      return { genesis, positions: positionCatalog.positions, balance, allowance, costs };
    },
  });

  const availablePositions = useMemo(() => portfolio.data?.positions ?? [], [portfolio.data]);

  if (deploymentState.status !== "configured" || !deploymentState.deployment.genesis) {
    return <UnconfiguredSurface subject="Genesis" />;
  }
  if (!wallet)
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to view and activate your Genesis NFTs."
      />
    );
  if (portfolio.isLoading) return <p className="dapp-loading">Loading Genesis NFTs…</p>;
  if (portfolio.isError)
    return (
      <EmptyState
        title="Genesis data unavailable"
        description={portfolio.error.message}
        tone="error"
      />
    );
  if (!portfolio.data?.genesis.length) {
    return (
      <EmptyState
        title="No Genesis NFTs found"
        description="This wallet does not currently own a Statics Genesis NFT."
      />
    );
  }

  const deployment = deploymentState.deployment;
  const genesisDeployment = deployment.genesis!;
  const send = async (
    kind: Parameters<typeof executeProtocolTransaction>[0]["kind"],
    label: string,
    data: `0x${string}`,
    amount: string
  ) => {
    await executeProtocolTransaction({
      publicClient: publicClient!,
      wallet,
      chainId: deployment.chainId,
      kind,
      label,
      amount,
      to: deployment.contracts.diamond,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeGenesisError,
    });
  };

  const checkpointPosition = async (positionId: bigint) => {
    const selected = await publicClient!.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionRewardAssets",
      args: [positionId],
    });
    const required = await rewardAssetsNeedingCheckpoint(publicClient!, deployment, selected);
    for (const batch of checkpointRewardAssetBatches(required)) {
      await send(
        "checkpoint-rewards",
        `Checkpoint ${batch.length} reward asset${batch.length === 1 ? "" : "s"}`,
        buildCheckpointRewardAssetsCall(batch),
        `${batch.length} assets`
      );
    }
  };

  const act = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await portfolio.refetch();
    } catch (caught) {
      setError(describeGenesisError(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="genesis-page">
      <div className="genesis-summary ui-card">
        <div className="ui-stat">
          <span className="ui-stat__label">STATICS balance</span>
          <strong className="ui-stat__value">{formatEther(portfolio.data.balance)} STATICS</strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Genesis collection</span>
          <strong className="ui-stat__value">5,555 fixed NFTs</strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Activation</span>
          <strong className="ui-stat__value">Burned STATICS; resets on transfer</strong>
        </div>
      </div>
      {error && (
        <div className="dapp-error" role="alert">
          {error}
        </div>
      )}
      <div className="genesis-grid">
        {portfolio.data.genesis.map(({ id, state }) => {
          const currentTier = Number(state.tier);
          const target = targets[id.toString()] ?? Math.min(4, currentTier + 1);
          const cost = portfolio.data.costs
            .slice(currentTier, target)
            .reduce((sum, value) => sum + value, 0n);
          const selectedPosition =
            positions[id.toString()] ?? availablePositions[0]?.positionId.toString() ?? "";
          const linked = state.linkedPositionId !== 0n;
          const needsApproval = portfolio.data.allowance < cost;
          const actionKey = id.toString();
          return (
            <article className="ui-card genesis-card" key={actionKey}>
              <div className="genesis-card-heading">
                <div>
                  <h2 className="ui-section-title">Genesis #{actionKey}</h2>
                  <span className="ui-pill">
                    Tier {currentTier} · {(Number(state.multiplierBps) / 10_000).toFixed(2)}×
                  </span>
                </div>
                <NftArtwork
                  chainId={deployment.chainId}
                  expandable
                  nft={{
                    kind: "collection",
                    tokenId: id,
                    contract: genesisDeployment.collection,
                    name: `Genesis #${actionKey}`,
                    summary: `Tier ${currentTier}`,
                    carries: [],
                    blockedReason: linked ? "Unlink before transfer." : null,
                  }}
                />
              </div>
              <p className="ui-section-subtitle">
                {linked ? `Linked to Position #${state.linkedPositionId}` : "Not linked"}
              </p>
              {currentTier < 4 && (
                <div className="genesis-action">
                  <label className="ui-field">
                    Activate through tier
                    <select
                      value={target}
                      onChange={(event) => {
                        setTargets((value) => ({
                          ...value,
                          [actionKey]: Number(event.target.value),
                        }));
                        setError(null);
                      }}
                    >
                      {[1, 2, 3, 4]
                        .filter((tier) => tier > currentTier)
                        .map((tier) => (
                          <option key={tier} value={tier}>
                            Tier {tier}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p>Burn cost: {formatEther(cost)} STATICS</p>
                  {needsApproval ? (
                    <button
                      className="ui-button ui-button--primary ui-button--block"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(actionKey, async () => {
                          await executeProtocolTransaction({
                            publicClient: publicClient!,
                            wallet,
                            chainId: deployment.chainId,
                            kind: "approve-staking-token",
                            label: "Approve STATICS for Genesis activation",
                            amount: "Unlimited STATICS approval",
                            to: genesisDeployment.token,
                            data: encodeFunctionData({
                              abi: staticsTokenAbi,
                              functionName: "approve",
                              args: [deployment.contracts.diamond, MAX_ERC20_ALLOWANCE],
                            }),
                            sendTransaction: walletState.sendEvmTransaction,
                            describeError: describeGenesisError,
                          });
                        })
                      }
                    >
                      {busy === actionKey ? "Approving…" : "Approve STATICS"}
                    </button>
                  ) : (
                    <button
                      className="ui-button ui-button--primary ui-button--block"
                      disabled={busy !== null || portfolio.data.balance < cost}
                      onClick={() =>
                        void act(actionKey, async () => {
                          if (linked) await checkpointPosition(state.linkedPositionId);
                          await send(
                            "activate-genesis",
                            `Activate Genesis #${actionKey} to tier ${target}`,
                            buildActivateGenesisCall(id, target, cost),
                            `${formatEther(cost)} STATICS burned`
                          );
                        })
                      }
                    >
                      {busy === actionKey ? "Activating…" : `Activate to tier ${target}`}
                    </button>
                  )}
                </div>
              )}
              {linked ? (
                <button
                  className="ui-button ui-button--secondary ui-button--block"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(actionKey, async () => {
                      await checkpointPosition(state.linkedPositionId);
                      await send(
                        "unlink-genesis",
                        `Unlink Genesis #${actionKey}`,
                        buildUnlinkGenesisCall(id),
                        `Position #${state.linkedPositionId}`
                      );
                    })
                  }
                >
                  {busy === actionKey ? "Unlinking…" : "Unlink Genesis"}
                </button>
              ) : (
                <div className="genesis-action">
                  <label className="ui-field">
                    Position
                    <select
                      value={selectedPosition}
                      onChange={(event) =>
                        setPositions((value) => ({ ...value, [actionKey]: event.target.value }))
                      }
                    >
                      {availablePositions.map((position) => (
                        <option
                          key={position.positionId.toString()}
                          value={position.positionId.toString()}
                        >
                          Position #{position.positionId.toString()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="ui-button ui-button--primary ui-button--block"
                    disabled={busy !== null || currentTier === 0 || !selectedPosition}
                    onClick={() =>
                      void act(actionKey, async () => {
                        const positionId = BigInt(selectedPosition);
                        await checkpointPosition(positionId);
                        await send(
                          "link-genesis",
                          `Link Genesis #${actionKey}`,
                          buildLinkGenesisCall(id, positionId),
                          `Position #${positionId}`
                        );
                      })
                    }
                  >
                    {busy === actionKey
                      ? "Linking…"
                      : currentTier === 0
                        ? "Activate before linking"
                        : "Link to Position"}
                  </button>
                </div>
              )}
              <p className="genesis-warning">
                Unlink before transfer. A transfer keeps the Position NFT but resets its activation
                to tier 0.
              </p>
            </article>
          );
        })}
      </div>
      <div className="genesis-contracts ui-card">
        <AddressDisplay
          address={genesisDeployment.collection}
          chainId={deployment.chainId}
          label="Genesis NFT"
        />
        <AddressDisplay
          address={genesisDeployment.token}
          chainId={deployment.chainId}
          label="STATICS"
        />
      </div>
    </div>
  );
}
