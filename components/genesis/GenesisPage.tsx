"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  buildActivateGenesisCall,
  buildClaimGenesisOwnerRewardsCall,
  buildClaimGenesisRewardsCall,
  buildLinkGenesisCall,
  buildRegisterGenesisRewardsCall,
  buildUnlinkGenesisCall,
  genesisActivationRegistryAbi,
  staticsAbi,
  staticsTokenAbi,
} from "@statics-protocol/sdk";

import { EmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { StandaloneGenesisPage } from "@/components/genesis/StandaloneGenesisPage";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import { verifyDollarDeployment, type DollarDeployment } from "@/lib/dollar/deployment";
import { loadWalletGenesis } from "@/lib/indexer/statics";
import { loadPositionCatalog } from "@/lib/positions/positions";
import {
  checkpointRewardAssetBatches,
  rewardAssetsNeedingCheckpoint,
} from "@/lib/positions/staking";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

function describeGenesisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GenesisLinkedOnTransfer"))
    return "Unlink this Operator NFT before transferring it.";
  if (message.includes("GenesisAlreadyLinked")) return "This Operator NFT is already linked.";
  if (message.includes("PositionAlreadyLinked"))
    return "That Position already has an Operator NFT.";
  if (message.includes("InvalidActivationTier")) return "Choose a higher activation tier.";
  if (message.includes("ERC20InsufficientAllowance"))
    return "Approve STATICS before activating this tier.";
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  return message || "The Operator action failed.";
}

export function GenesisPage() {
  const { active } = useDeployment();
  if (active.protocol?.protocol.genesis) {
    return <ProtocolGenesisPage deployment={active.protocol.protocol} />;
  }
  if (active.launch) return <StandaloneGenesisPage deployment={active.launch} />;
  return <UnconfiguredSurface subject="Genesis" />;
}

function ProtocolGenesisPage({ deployment }: { deployment: DollarDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [positions, setPositions] = useState<Record<string, string>>({});
  const genesis = deployment.genesis!;

  const portfolio = useQuery({
    queryKey: ["protocol-genesis", deployment.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet && walletState.isTargetChain),
    retry: false,
    queryFn: async () => {
      if (!publicClient || !wallet) throw new Error("Wallet unavailable.");
      await verifyDollarDeployment(publicClient, deployment);
      const [indexed, positionCatalog, balance, allowance, tierCosts, ownerStatics, ownerWeth] =
        await Promise.all([
          loadWalletGenesis(wallet),
          loadPositionCatalog(publicClient, deployment, wallet),
          publicClient.readContract({
            address: genesis.token,
            abi: staticsTokenAbi,
            functionName: "balanceOf",
            args: [wallet],
          }),
          publicClient.readContract({
            address: genesis.token,
            abi: staticsTokenAbi,
            functionName: "allowance",
            args: [wallet, genesis.activationRegistry],
          }),
          Promise.all(
            [1, 2, 3, 4].map((tier) =>
              publicClient.readContract({
                address: genesis.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "tierCost",
                args: [tier],
              })
            )
          ),
          publicClient.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "genesisOwnerClaimable",
            args: [wallet, genesis.token],
          }),
          publicClient.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "genesisOwnerClaimable",
            args: [wallet, deployment.contracts.weth],
          }),
        ]);
      const items = await Promise.all(
        indexed.map(async ({ id }) => {
          const [
            tier,
            multiplierBps,
            linkedPositionId,
            registered,
            rewardWeight,
            pendingStatics,
            pendingWeth,
          ] = await Promise.all([
            publicClient.readContract({
              address: genesis.activationRegistry,
              abi: genesisActivationRegistryAbi,
              functionName: "tierOf",
              args: [id],
            }),
            publicClient.readContract({
              address: genesis.activationRegistry,
              abi: genesisActivationRegistryAbi,
              functionName: "multiplierBps",
              args: [id],
            }),
            publicClient.readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "linkedPosition",
              args: [id],
            }),
            publicClient.readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "genesisRegistered",
              args: [id],
            }),
            publicClient.readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "genesisEffectiveWeight",
              args: [id],
            }),
            publicClient.readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "pendingGenesisRewards",
              args: [id, genesis.token],
            }),
            publicClient.readContract({
              address: deployment.contracts.diamond,
              abi: staticsAbi,
              functionName: "pendingGenesisRewards",
              args: [id, deployment.contracts.weth],
            }),
          ]);
          return {
            id,
            tier: Number(tier),
            multiplierBps: Number(multiplierBps),
            linkedPositionId,
            registered,
            rewardWeight,
            pendingStatics,
            pendingWeth,
          };
        })
      );
      return {
        items,
        positions: positionCatalog.positions,
        balance,
        allowance,
        tierCosts,
        ownerStatics,
        ownerWeth,
      };
    },
  });

  const availablePositions = useMemo(() => portfolio.data?.positions ?? [], [portfolio.data]);

  const send = async (
    kind: Parameters<typeof executeProtocolTransaction>[0]["kind"],
    label: string,
    to: `0x${string}`,
    data: `0x${string}`,
    amount: string
  ) => {
    if (!publicClient || !wallet) return;
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deployment.chainId,
      deploymentId: deployment.deploymentId,
      kind,
      label,
      amount,
      to,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeGenesisError,
    });
  };

  const run = async (key: string, action: () => Promise<void>) => {
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setBusy(key);
    setError(null);
    try {
      await action();
      await portfolio.refetch();
    } catch (cause) {
      setError(describeGenesisError(cause));
    } finally {
      setBusy(null);
    }
  };

  const checkpointPosition = async (positionId: bigint) => {
    if (!publicClient || !wallet) return;
    const selected = await publicClient.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionRewardAssets",
      args: [positionId],
    });
    const required = await rewardAssetsNeedingCheckpoint(publicClient, deployment, selected);
    for (const batch of checkpointRewardAssetBatches(required)) {
      await send(
        "checkpoint-rewards",
        `Checkpoint ${batch.length} reward asset${batch.length === 1 ? "" : "s"}`,
        deployment.contracts.diamond,
        encodeFunctionData({
          abi: staticsAbi,
          functionName: "checkpointRewardAssets",
          args: [batch],
        }),
        `${batch.length} assets`
      );
    }
  };

  if (!wallet)
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect to manage your Operators NFTs."
      />
    );
  if (portfolio.isLoading) return <p className="dapp-loading">Loading Operators NFTs…</p>;
  if (portfolio.isError)
    return (
      <EmptyState
        tone="error"
        title="Operators data unavailable"
        description={describeGenesisError(portfolio.error)}
        action={{ label: "Retry", onClick: () => void portfolio.refetch() }}
      />
    );
  if (!portfolio.data?.items.length)
    return (
      <EmptyState
        title="No Operators NFTs found"
        description="This wallet does not currently own a Statics Operators NFT."
      />
    );

  return (
    <div className="genesis-page">
      <section className="genesis-summary ui-card">
        <div className="ui-stat">
          <span className="ui-stat__label">STATICS balance</span>
          <strong className="ui-stat__value">{formatEther(portfolio.data.balance)} STATICS</strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Previous-owner rewards</span>
          <strong className="ui-stat__value">
            {formatEther(portfolio.data.ownerStatics)} STATICS +{" "}
            {formatEther(portfolio.data.ownerWeth)} WETH
          </strong>
        </div>
        {(portfolio.data.ownerStatics > 0n || portfolio.data.ownerWeth > 0n) && (
          <button
            className="ui-button ui-button--secondary"
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void run("owner-claims", async () => {
                if (portfolio.data!.ownerStatics > 0n)
                  await send(
                    "claim-rewards",
                    "Claim previous-owner STATICS",
                    deployment.contracts.diamond,
                    buildClaimGenesisOwnerRewardsCall(genesis.token, wallet),
                    "STATICS rewards"
                  );
                if (portfolio.data!.ownerWeth > 0n)
                  await send(
                    "claim-rewards",
                    "Claim previous-owner WETH",
                    deployment.contracts.diamond,
                    buildClaimGenesisOwnerRewardsCall(deployment.contracts.weth, wallet),
                    "WETH rewards"
                  );
              })
            }
          >
            Claim previous-owner rewards
          </button>
        )}
      </section>
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="genesis-grid">
        {portfolio.data.items.map((item) => {
          const key = item.id.toString();
          const target = targets[key] ?? Math.min(4, item.tier + 1);
          const cost = portfolio.data.tierCosts
            .slice(item.tier, target)
            .reduce((sum, value) => sum + value, 0n);
          const selectedPosition =
            positions[key] ?? availablePositions[0]?.positionId.toString() ?? "";
          const linked = item.linkedPositionId !== 0n;
          return (
            <article className="ui-card genesis-card" key={key}>
              <div className="genesis-card-heading">
                <div>
                  <h2 className="ui-section-title">Operator #{key}</h2>
                  <span className="ui-pill">
                    Tier {item.tier} · {(item.multiplierBps / 10_000).toFixed(2)}×
                  </span>
                </div>
                <NftArtwork
                  chainId={deployment.chainId}
                  expandable
                  operatorTier={item.tier}
                  nft={{
                    kind: "collection",
                    tokenId: item.id,
                    contract: genesis.collection,
                    name: `Operator #${key}`,
                    summary: `Tier ${item.tier}`,
                    carries: [],
                    blockedReason: linked ? "Unlink before transfer." : null,
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
                        setTargets((current) => ({
                          ...current,
                          [key]: Number(event.target.value),
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
                    disabled={busy !== null || portfolio.data.balance < cost}
                    onClick={() =>
                      void run(`activate-${key}`, async () => {
                        if (portfolio.data!.allowance < cost) {
                          await send(
                            "approve-staking-token",
                            "Approve STATICS activation",
                            genesis.token,
                            encodeFunctionData({
                              abi: staticsTokenAbi,
                              functionName: "approve",
                              args: [genesis.activationRegistry, cost],
                            }),
                            `${formatEther(cost)} STATICS`
                          );
                          return;
                        }
                        await send(
                          "activate-genesis",
                          `Activate Operator #${key} to tier ${target}`,
                          genesis.activationRegistry,
                          buildActivateGenesisCall(item.id, target),
                          `${formatEther(cost)} STATICS`
                        );
                      })
                    }
                  >
                    {busy === `activate-${key}`
                      ? portfolio.data.allowance < cost
                        ? "Approving…"
                        : "Activating…"
                      : portfolio.data.allowance < cost
                        ? `Approve ${formatEther(cost)} STATICS`
                        : `Activate to tier ${target}`}
                  </button>
                </div>
              )}

              <div className="genesis-action">
                <p>
                  {item.registered
                    ? `Reward weight: ${item.rewardWeight}`
                    : "Not registered for protocol rewards"}
                </p>
                {!item.registered ? (
                  <button
                    className="ui-button ui-button--primary ui-button--block"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(`register-${key}`, () =>
                        send(
                          "claim-rewards",
                          `Register Operator #${key}`,
                          deployment.contracts.diamond,
                          buildRegisterGenesisRewardsCall(item.id),
                          `Operator #${key}`
                        )
                      )
                    }
                  >
                    {busy === `register-${key}` ? "Registering…" : "Register for rewards"}
                  </button>
                ) : (
                  <div className="testnet-faucet-actions">
                    <button
                      className="ui-button ui-button--secondary"
                      type="button"
                      disabled={busy !== null || item.pendingStatics === 0n}
                      onClick={() =>
                        void run(`claim-statics-${key}`, () =>
                          send(
                            "claim-rewards",
                            `Claim Operator #${key} STATICS`,
                            deployment.contracts.diamond,
                            buildClaimGenesisRewardsCall(item.id, genesis.token, wallet),
                            `${formatEther(item.pendingStatics)} STATICS`
                          )
                        )
                      }
                    >
                      Claim {formatEther(item.pendingStatics)} STATICS
                    </button>
                    <button
                      className="ui-button ui-button--secondary"
                      type="button"
                      disabled={busy !== null || item.pendingWeth === 0n}
                      onClick={() =>
                        void run(`claim-weth-${key}`, () =>
                          send(
                            "claim-rewards",
                            `Claim Operator #${key} WETH`,
                            deployment.contracts.diamond,
                            buildClaimGenesisRewardsCall(
                              item.id,
                              deployment.contracts.weth,
                              wallet
                            ),
                            `${formatEther(item.pendingWeth)} WETH`
                          )
                        )
                      }
                    >
                      Claim {formatEther(item.pendingWeth)} WETH
                    </button>
                  </div>
                )}
              </div>

              {linked ? (
                <button
                  className="ui-button ui-button--secondary ui-button--block"
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`unlink-${key}`, async () => {
                      await checkpointPosition(item.linkedPositionId);
                      await send(
                        "unlink-genesis",
                        `Unlink Operator #${key}`,
                        deployment.contracts.diamond,
                        buildUnlinkGenesisCall(item.linkedPositionId, item.id),
                        `Position #${item.linkedPositionId}`
                      );
                    })
                  }
                >
                  Unlink from Position #{item.linkedPositionId.toString()}
                </button>
              ) : (
                <div className="genesis-action">
                  <label className="ui-field">
                    Position
                    <select
                      value={selectedPosition}
                      onChange={(event) =>
                        setPositions((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
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
                    type="button"
                    disabled={busy !== null || item.tier === 0 || !selectedPosition}
                    onClick={() =>
                      void run(`link-${key}`, async () => {
                        const positionId = BigInt(selectedPosition);
                        await checkpointPosition(positionId);
                        await send(
                          "link-genesis",
                          `Link Operator #${key}`,
                          deployment.contracts.diamond,
                          buildLinkGenesisCall(positionId, item.id),
                          `Position #${positionId}`
                        );
                      })
                    }
                  >
                    {item.tier === 0 ? "Activate before linking" : "Link to Position"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
