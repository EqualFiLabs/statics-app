"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
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
} from "@statics-protocol/sdk";

import { EmptyState } from "@/components/common/EmptyState";
import { GenesisCarousel } from "@/components/genesis/GenesisCarousel";
import { GenesisCreditPanel } from "@/components/genesis/GenesisCreditPanel";
import { GenesisIdentityPanel } from "@/components/genesis/GenesisIdentityPanel";
import {
  GENESIS_MAX_TIER,
  GenesisTierLadder,
  genesisTierMultiplier,
} from "@/components/genesis/GenesisTierLadder";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { genesisActivationCost, oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import {
  EMPTY_GENESIS_PORTFOLIO,
  loadOwnedGenesis,
  ownedGenesisQueryKey,
  summariseGenesisRewards,
  type OwnedGenesis,
} from "@/lib/genesis/owned";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import { useWalletState } from "@/providers/wallet-context";

function describeGenesisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("NotGenesisOwner")) return "This wallet no longer owns that Operator NFT.";
  if (message.includes("GenesisAlreadyRegistered"))
    return "That Operator NFT is already registered for rewards.";
  if (message.includes("NoRewards")) return "There is nothing to claim for that asset yet.";
  return message || "The Genesis transaction failed.";
}

type ActionTab = "activate" | "rewards" | "credit";

export function StandaloneGenesisPage({ deployment }: { deployment: LaunchDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;

  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [tab, setTab] = useState<ActionTab>("activate");
  const [targetTiers, setTargetTiers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimProgress, setClaimProgress] = useState<string | null>(null);

  const vault = useQuery({
    queryKey: ["genesis-vault-epoch", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("The deployment RPC is unavailable.");
      const accounting = await publicClient.readContract({
        address: deployment.contracts.vault,
        abi: currentGenesisVaultAbi,
        functionName: "vaultAccounting",
      });
      return {
        epochActive: accounting.epochActive,
        genesisEpochEnd: Number(accounting.genesisEpochEnd),
        vaultPrice: accounting.vaultPrice,
        maximumSupply: accounting.maximumSupply,
        circulatingGenesis: accounting.circulatingGenesis,
      };
    },
  });

  // Shared with the Overview: same key, same fetcher, one walk of the wallet.
  const owned = useQuery({
    queryKey: ownedGenesisQueryKey(deployment.descriptor.deploymentId, wallet),
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet) return EMPTY_GENESIS_PORTFOLIO;
      return loadOwnedGenesis(publicClient, deployment, wallet);
    },
  });

  const items = useMemo(() => owned.data?.items ?? [], [owned.data]);
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const summary = useMemo(() => {
    const portfolio = owned.data ?? EMPTY_GENESIS_PORTFOLIO;
    // Reward totals and the claim signature count are shared with the Overview,
    // so both surfaces quote the same figures.
    const rewards = summariseGenesisRewards(portfolio);
    const credits = items.filter((item) => item.creditActive);
    const owed = credits.reduce((total, item) => total + item.creditPrincipal, 0n);
    const soonest = credits.reduce<OwnedGenesis | null>(
      (earliest, item) =>
        !earliest || item.creditMaturity < earliest.creditMaturity ? item : earliest,
      null
    );
    return {
      ...rewards,
      claimCount: rewards.claimTransactionCount,
      owed,
      creditCount: credits.length,
      soonest,
      activated: items.filter((item) => item.tier > 0).length,
      unregistered: items.filter((item) => !item.registered).length,
    };
  }, [items, owned.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.includes(deployment.descriptor.deploymentId) &&
        ["launch-genesis", "genesis-vault"].some((prefix) =>
          String(query.queryKey[0]).startsWith(prefix)
        ),
    });
  };

  const guardChain = async (): Promise<boolean> => {
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return false;
    }
    return true;
  };

  const send = async (
    kind: Parameters<typeof executeProtocolTransaction>[0]["kind"],
    label: string,
    to: `0x${string}`,
    data: `0x${string}`,
    amount: string
  ) => {
    if (!wallet || !publicClient) return;
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deployment.descriptor.chainId,
      deploymentId: deployment.descriptor.deploymentId,
      kind,
      label,
      amount,
      to,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeGenesisError,
    });
  };

  const act = async (key: string, action: () => Promise<void>) => {
    if (!publicClient || !wallet) return;
    if (!(await guardChain())) return;
    setBusy(key);
    setError(null);
    try {
      await verifyLaunchDeployment(publicClient, deployment);
      await action();
      await refresh();
    } catch (cause) {
      setError(describeGenesisError(cause));
      await refresh();
    } finally {
      setBusy(null);
      setClaimProgress(null);
    }
  };

  const activate = async (item: OwnedGenesis, targetTier: number) => {
    if (!publicClient || !wallet) return;
    // The tier is re-read immediately before the payment: a transfer or a
    // concurrent activation between render and confirmation would otherwise
    // charge for tiers already paid for.
    const [currentTier, currentCosts] = await Promise.all([
      publicClient.readContract({
        address: deployment.contracts.activationRegistry,
        abi: genesisActivationRegistryAbi,
        functionName: "tierOf",
        args: [item.id],
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
    if (Number(currentTier) !== item.tier) {
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
      await send(
        "approve-staking-token",
        "Enable Genesis activation",
        deployment.contracts.statics,
        encodeFunctionData({
          abi: dopplerStaticsTokenAbi,
          functionName: "approve",
          args: [deployment.contracts.activationRegistry, MAX_ERC20_ALLOWANCE],
        }),
        "Maximum STATICS"
      );
    }
    await send(
      "activate-genesis",
      `Activate Operator #${item.id} to tier ${targetTier}`,
      deployment.contracts.activationRegistry,
      buildActivateGenesisCall(item.id, targetTier),
      `${formatEther(cost)} STATICS activation payment`
    );
  };

  const claimEverything = async () => {
    const jobs: { label: string; data: `0x${string}`; amount: string }[] = [];
    for (const item of items) {
      if (item.pendingStatics > 0n) {
        jobs.push({
          label: `Claim Operator #${item.id} STATICS rewards`,
          data: buildClaimGenesisLaunchRewardsCall(item.id, deployment.contracts.statics, wallet!),
          amount: `${formatEther(item.pendingStatics)} STATICS`,
        });
      }
      if (item.pendingWeth > 0n) {
        jobs.push({
          label: `Claim Operator #${item.id} WETH rewards`,
          data: buildClaimGenesisLaunchRewardsCall(item.id, deployment.contracts.weth, wallet!),
          amount: `${formatEther(item.pendingWeth)} WETH`,
        });
      }
    }
    if (summary.ownerStatics > 0n) {
      jobs.push({
        label: "Claim previous-owner STATICS rewards",
        data: buildClaimOwnerGenesisLaunchRewardsCall(deployment.contracts.statics, wallet!),
        amount: `${formatEther(summary.ownerStatics)} STATICS`,
      });
    }
    if (summary.ownerWeth > 0n) {
      jobs.push({
        label: "Claim previous-owner WETH rewards",
        data: buildClaimOwnerGenesisLaunchRewardsCall(deployment.contracts.weth, wallet!),
        amount: `${formatEther(summary.ownerWeth)} WETH`,
      });
    }
    for (const [index, job] of jobs.entries()) {
      setClaimProgress(`${index + 1} of ${jobs.length}`);
      await send(
        "claim-rewards",
        job.label,
        deployment.contracts.launchDistributor,
        job.data,
        job.amount
      );
    }
  };

  // Recovery is open to anyone once the Epoch ends, whether or not this wallet
  // holds a Genesis, so its entry point sits above the wallet gate.
  const recoveriesLink =
    vault.data?.epochActive === false ? (
      <Link className="genesis-recoveries-link" href="/app/genesis/recoveries">
        Recover matured Operator credit <span aria-hidden="true">→</span>
      </Link>
    ) : null;

  if (!wallet) {
    return (
      <div className="genesis-page">
        {recoveriesLink}
        <EmptyState
          title="Connect your wallet"
          description="Connect to view and manage your Operators NFTs."
        />
      </div>
    );
  }
  if (owned.isLoading) return <p className="dapp-loading">Loading Operators NFTs…</p>;
  if (owned.error) {
    return (
      <div className="genesis-page">
        {recoveriesLink}
        <EmptyState
          title="Operators data unavailable"
          description={describeGenesisError(owned.error)}
        />
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="genesis-page">
        {recoveriesLink}
        <EmptyState
          title="No Operators NFTs yet"
          description={
            vault.data
              ? `${vault.data.circulatingGenesis} of ${vault.data.maximumSupply} Operators NFTs are in circulation, each backed by ${formatTokenAmountGrouped(vault.data.vaultPrice, 18, 0)} STATICS.`
              : "Acquire a fully backed Operator NFT through the Vault."
          }
          action={{ label: "Acquire an Operator NFT", href: "/app/swap?mode=nft" }}
        />
        {/* Rewards earned before a Genesis changed hands stay claimable by the
            previous owner, so a wallet holding none of them still has somewhere
            to collect from. */}
        {(summary.ownerStatics > 0n || summary.ownerWeth > 0n) && (
          <section className="ui-card genesis-panel" aria-label="Rewards from past ownership">
            <div className="genesis-panel-head">
              <h3>Rewards from past ownership</h3>
              <p>
                These accrued while you held an Operator NFT that has since moved on. They remain
                yours to claim.
              </p>
            </div>
            <ul className="genesis-claims">
              {(
                [
                  [deployment.contracts.statics, "STATICS", summary.ownerStatics, 2],
                  [deployment.contracts.weth, "WETH", summary.ownerWeth, 4],
                ] as const
              ).map(([asset, symbol, amount, digits]) => (
                <li key={asset}>
                  <div>
                    <span>{symbol}</span>
                    <strong className={amount === 0n ? "is-muted" : undefined}>
                      {formatTokenAmountGrouped(amount, 18, digits)}
                    </strong>
                  </div>
                  <button
                    className="ui-button ui-button--secondary ui-button--sm"
                    type="button"
                    disabled={busy !== null || amount === 0n}
                    onClick={() =>
                      void act(`claim-owner-${symbol}`, () =>
                        send(
                          "claim-rewards",
                          `Claim previous-owner ${symbol} rewards`,
                          deployment.contracts.launchDistributor,
                          buildClaimOwnerGenesisLaunchRewardsCall(asset, wallet),
                          symbol
                        )
                      )
                    }
                  >
                    {busy === `claim-owner-${symbol}` ? "Claiming…" : "Claim"}
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <p className="dapp-inline-error" role="alert">
                {error}
              </p>
            )}
          </section>
        )}
      </div>
    );
  }

  const targetTier = selected
    ? (targetTiers[selected.id.toString()] ?? Math.min(GENESIS_MAX_TIER, selected.tier + 1))
    : 0;
  const activationCost = selected
    ? genesisActivationCost(owned.data?.tierCosts ?? [], selected.tier, targetTier)
    : 0n;

  return (
    <div className="genesis-page">
      {recoveriesLink}
      <section className="genesis-summary ui-card" aria-label="Your Operators holdings">
        <div className="ui-stat">
          <span className="ui-stat__label">Operators held</span>
          <strong className="ui-stat__value">{items.length}</strong>
          <small>
            {summary.activated} activated · {summary.unregistered} not registered
          </small>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Backed by</span>
          <strong className="ui-stat__value">
            {vault.data
              ? `${formatTokenAmountGrouped(vault.data.vaultPrice * BigInt(items.length), 18, 0)} STATICS`
              : "—"}
          </strong>
          <small>
            {vault.data ? `+ ${items.length}/${vault.data.maximumSupply} of ETH reserve` : ""}
          </small>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Claimable now</span>
          <strong className="ui-stat__value is-accent">
            {formatTokenAmountGrouped(summary.claimableStatics, 18, 2)} STATICS
          </strong>
          <small>
            {formatTokenAmountGrouped(summary.claimableWeth, 18, 4)} WETH
            {summary.ownerStatics > 0n || summary.ownerWeth > 0n
              ? " · includes past ownership"
              : ""}
          </small>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Credit outstanding</span>
          <strong className={`ui-stat__value${summary.owed > 0n ? " is-warning" : ""}`}>
            {summary.owed > 0n
              ? `${formatTokenAmountGrouped(summary.owed, 18, 0)} STATICS`
              : "None"}
          </strong>
          <small>
            {summary.soonest
              ? `${summary.creditCount} open · #${summary.soonest.id} due ${new Date(summary.soonest.creditMaturity * 1_000).toLocaleDateString()}`
              : "Nothing to repay"}
          </small>
        </div>
        <button
          className="ui-button ui-button--primary"
          type="button"
          disabled={busy !== null || summary.claimCount === 0}
          onClick={() => void act("claim-all", claimEverything)}
        >
          {busy === "claim-all"
            ? `Claiming ${claimProgress ?? ""}…`
            : summary.claimCount > 1
              ? `Claim all · ${summary.claimCount} transactions`
              : "Claim all"}
        </button>
      </section>

      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}

      <GenesisCarousel
        items={items.map((item) => ({
          id: item.id,
          tier: item.tier,
          registered: item.registered,
          hasPendingRewards: item.pendingStatics > 0n || item.pendingWeth > 0n,
          creditActive: item.creditActive,
        }))}
        selectedId={selected?.id ?? null}
        onSelect={(id) => {
          setSelectedId(id);
          setError(null);
        }}
        chainId={deployment.descriptor.chainId}
        collection={deployment.contracts.genesis}
      />

      {selected && (
        <div className="genesis-detail">
          <GenesisIdentityPanel
            id={selected.id}
            tier={selected.tier}
            registered={selected.registered}
            rewardWeight={selected.rewardWeight}
            creditActive={selected.creditActive}
            chainId={deployment.descriptor.chainId}
            collection={deployment.contracts.genesis}
            vaultPrice={vault.data?.vaultPrice ?? 0n}
            maximumSupply={vault.data?.maximumSupply ?? 0n}
          />

          <div className="genesis-actions">
            <div className="genesis-tabs" role="tablist" aria-label="Operator actions">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "activate"}
                onClick={() => setTab("activate")}
              >
                <b>Activate</b>
                <small>
                  {selected.tier === GENESIS_MAX_TIER
                    ? "Top tier reached"
                    : `Tier ${selected.tier} → ${targetTier}`}
                </small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "rewards"}
                data-alert={
                  !selected.registered || selected.pendingStatics > 0n || selected.pendingWeth > 0n
                    ? "true"
                    : undefined
                }
                onClick={() => setTab("rewards")}
              >
                <b>Rewards</b>
                <small>
                  {!selected.registered
                    ? "Not registered"
                    : `${formatTokenAmountGrouped(selected.pendingStatics, 18, 2)} STATICS pending`}
                </small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "credit"}
                onClick={() => setTab("credit")}
              >
                <b>Credit</b>
                <small>
                  {selected.creditActive
                    ? `${formatTokenAmountGrouped(selected.creditPrincipal, 18, 0)} owed`
                    : vault.data?.epochActive
                      ? "Opens after the Epoch"
                      : "Borrow against backing"}
                </small>
              </button>
            </div>

            {tab === "activate" && (
              <section className="ui-card genesis-panel" aria-label="Activation tier">
                <div className="genesis-panel-head">
                  <h3>Activation tier</h3>
                  <p>
                    A permanent multiplier on this NFT&apos;s share of launch rewards. Pay once and
                    keep it, until the NFT changes hands.
                  </p>
                </div>
                <GenesisTierLadder
                  currentTier={selected.tier}
                  targetTier={targetTier}
                  tierCosts={owned.data?.tierCosts ?? []}
                  disabled={busy !== null || selected.tier === GENESIS_MAX_TIER}
                  onSelect={(tier) => {
                    setTargetTiers((current) => ({ ...current, [selected.id.toString()]: tier }));
                    setError(null);
                  }}
                />
                {selected.tier < GENESIS_MAX_TIER ? (
                  <>
                    <dl className="genesis-figures">
                      <div>
                        <dt>Reward weight</dt>
                        <dd>
                          {genesisTierMultiplier(selected.tier).toFixed(2)}× →{" "}
                          {genesisTierMultiplier(targetTier).toFixed(2)}×
                        </dd>
                      </div>
                      <div className="is-total">
                        <dt>You pay</dt>
                        <dd>{formatTokenAmountGrouped(activationCost, 18, 0)} STATICS</dd>
                      </div>
                    </dl>
                    <p className="genesis-note">
                      <b>Paid to the Statics treasury.</b> STATICS is never burned — total supply is
                      unchanged and this NFT&apos;s backing is untouched.
                    </p>
                    <p className="genesis-note is-warning">
                      <b>Transferring resets this to Tier 0.</b> The next owner starts at 1.00×.
                      Rewards you accrued before the transfer stay claimable by you.
                    </p>
                    <button
                      className="ui-button ui-button--primary ui-button--block"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(`activate-${selected.id}`, () => activate(selected, targetTier))
                      }
                    >
                      {busy === `activate-${selected.id}`
                        ? "Confirming…"
                        : `Activate to Tier ${targetTier} · ${formatTokenAmountGrouped(activationCost, 18, 0)} STATICS`}
                    </button>
                  </>
                ) : (
                  <p className="genesis-note">
                    <b>Tier 4 reached.</b> This Operator earns the maximum 1.25× reward weight.
                  </p>
                )}
              </section>
            )}

            {tab === "rewards" && (
              <section className="ui-card genesis-panel" aria-label="Launch rewards">
                <div className="genesis-panel-head">
                  <h3>Launch rewards</h3>
                  <p>
                    Registered Operators NFTs split {Number(owned.data?.rewardShareBps ?? 0) / 100}%
                    of market fees, weighted by activation tier.
                  </p>
                </div>

                {!selected.registered ? (
                  <>
                    <p className="genesis-note is-warning">
                      <b>This Operator is earning nothing.</b> Register it to start taking a share of
                      market fees at its current {genesisTierMultiplier(selected.tier).toFixed(2)}×
                      weight.
                    </p>
                    <dl className="genesis-figures">
                      <div>
                        <dt>Weight once registered</dt>
                        <dd>{selected.multiplierBps.toString()}</dd>
                      </div>
                      <div>
                        <dt>Total registered weight</dt>
                        <dd>{(owned.data?.totalWeight ?? 0n).toString()}</dd>
                      </div>
                    </dl>
                    <button
                      className="ui-button ui-button--primary ui-button--block"
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(`register-${selected.id}`, () =>
                          send(
                            "claim-rewards",
                            `Register Operator #${selected.id}`,
                            deployment.contracts.launchDistributor,
                            buildRegisterGenesisCall(selected.id),
                            `Operator #${selected.id}`
                          )
                        )
                      }
                    >
                      {busy === `register-${selected.id}`
                        ? "Registering…"
                        : `Register Operator #${selected.id} for rewards`}
                    </button>
                  </>
                ) : (
                  <>
                    <dl className="genesis-figures">
                      <div>
                        <dt>Your weight</dt>
                        <dd>{selected.rewardWeight.toString()}</dd>
                      </div>
                      <div>
                        <dt>Share of the pool</dt>
                        <dd>
                          {owned.data?.totalWeight
                            ? `${((Number(selected.rewardWeight) / Number(owned.data.totalWeight)) * 100).toFixed(4)}%`
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <ul className="genesis-claims">
                      {(
                        [
                          [deployment.contracts.statics, "STATICS", selected.pendingStatics, 2],
                          [deployment.contracts.weth, "WETH", selected.pendingWeth, 4],
                        ] as const
                      ).map(([asset, symbol, amount, digits]) => (
                        <li key={asset}>
                          <div>
                            <span>Pending {symbol}</span>
                            <strong className={amount === 0n ? "is-muted" : undefined}>
                              {formatTokenAmountGrouped(amount, 18, digits)}
                            </strong>
                          </div>
                          <button
                            className="ui-button ui-button--secondary ui-button--sm"
                            type="button"
                            disabled={busy !== null || amount === 0n}
                            onClick={() =>
                              void act(`claim-${selected.id}-${symbol}`, () =>
                                send(
                                  "claim-rewards",
                                  `Claim Operator #${selected.id} ${symbol} rewards`,
                                  deployment.contracts.launchDistributor,
                                  buildClaimGenesisLaunchRewardsCall(selected.id, asset, wallet),
                                  symbol
                                )
                              )
                            }
                          >
                            {busy === `claim-${selected.id}-${symbol}` ? "Claiming…" : "Claim"}
                          </button>
                        </li>
                      ))}
                      {(summary.ownerStatics > 0n || summary.ownerWeth > 0n) && (
                        <li>
                          <div>
                            <span>From Operators you no longer own</span>
                            <strong>
                              {formatTokenAmountGrouped(summary.ownerStatics, 18, 2)} STATICS
                            </strong>
                          </div>
                          <button
                            className="ui-button ui-button--secondary ui-button--sm"
                            type="button"
                            disabled={busy !== null || summary.ownerStatics === 0n}
                            onClick={() =>
                              void act("claim-owner-statics", () =>
                                send(
                                  "claim-rewards",
                                  "Claim previous-owner STATICS rewards",
                                  deployment.contracts.launchDistributor,
                                  buildClaimOwnerGenesisLaunchRewardsCall(
                                    deployment.contracts.statics,
                                    wallet
                                  ),
                                  "STATICS"
                                )
                              )
                            }
                          >
                            {busy === "claim-owner-statics" ? "Claiming…" : "Claim"}
                          </button>
                        </li>
                      )}
                    </ul>
                  </>
                )}

                <p className="genesis-note">
                  <b>Rewards accrue from the moment you register.</b> Fees collected before
                  registration, or before this NFT changed hands, are not included.
                </p>
                <div className="genesis-maintenance">
                  <button
                    className="ui-button ui-button--ghost ui-button--sm"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act("accrue", () =>
                        send(
                          "accrue-genesis-rewards",
                          "Update Operators launch rewards",
                          deployment.contracts.launchDistributor,
                          buildAccrueGenesisLaunchRewardsCall(),
                          "Current market fees"
                        )
                      )
                    }
                  >
                    {busy === "accrue" ? "Updating…" : "Harvest market fees into the reward index"}
                  </button>
                  <span>Anyone can run this</span>
                </div>
              </section>
            )}

            {tab === "credit" && (
              <GenesisCreditPanel deployment={deployment} genesisId={selected.id} />
            )}
          </div>
        </div>
      )}

      <section className="genesis-contracts ui-card">
        <AddressDisplay
          address={deployment.contracts.genesis}
          chainId={deployment.descriptor.chainId}
          label="Operator NFT"
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
          label="Operators Vault"
        />
      </section>
    </div>
  );
}
