"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  buildAccrueGenesisLaunchRewardsCall,
  buildActivateGenesisCall,
  buildClaimAllGenesisLaunchRewardsCall,
  buildClaimAllGenesisLaunchTreasuryRewardsCall,
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
  batchGenesisIds,
  claimableGenesisIds,
  loadOwnedGenesis,
  ownedGenesisQueryKey,
  summariseGenesisRewards,
  type OwnedGenesis,
} from "@/lib/genesis/owned";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import { useWalletState } from "@/providers/wallet-context";

type GenesisErrorCopy = Readonly<{
  walletRejected: string;
  notOwner: string;
  alreadyRegistered: string;
  nothingToClaim: string;
  transactionFailed: string;
}>;

function describeGenesisError(error: unknown, copy: GenesisErrorCopy): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return copy.walletRejected;
  if (message.includes("NotGenesisOwner")) return copy.notOwner;
  if (message.includes("GenesisAlreadyRegistered")) return copy.alreadyRegistered;
  if (message.includes("NoRewards")) return copy.nothingToClaim;
  return message || copy.transactionFailed;
}

type ActionTab = "activate" | "rewards" | "credit";

export function StandaloneGenesisPage({ deployment }: { deployment: LaunchDeployment }) {
  const t = useTranslations("operators");
  const errorCopy: GenesisErrorCopy = {
    walletRejected: t("walletRejected"),
    notOwner: t("notOwner"),
    alreadyRegistered: t("alreadyRegistered"),
    nothingToClaim: t("nothingToClaim"),
    transactionFailed: t("transactionFailed"),
  };
  const describeTransactionError = (cause: unknown) => describeGenesisError(cause, errorCopy);
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
      describeError: describeTransactionError,
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
      setError(describeTransactionError(cause));
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
      throw new Error(t("tierChanged"));
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
    if (balance < cost) throw new Error(t("insufficientStatics"));
    if (allowance < cost) {
      await send(
        "approve-staking-token",
        t("enableActivation"),
        deployment.contracts.statics,
        encodeFunctionData({
          abi: dopplerStaticsTokenAbi,
          functionName: "approve",
          args: [deployment.contracts.activationRegistry, MAX_ERC20_ALLOWANCE],
        }),
        t("maximumStatics")
      );
    }
    await send(
      "activate-genesis",
      t("activateLabel", { id: item.id.toString(), tier: targetTier }),
      deployment.contracts.activationRegistry,
      buildActivateGenesisCall(item.id, targetTier),
      t("activationPayment", { amount: formatEther(cost) })
    );
  };

  const claimEverything = async () => {
    const batches = batchGenesisIds(claimableGenesisIds(items));
    for (const [index, genesisIds] of batches.entries()) {
      setClaimProgress(`${index + 1} of ${summary.claimCount}`);
      await send(
        "claim-rewards",
        t("claimBatch", { count: genesisIds.length }),
        deployment.contracts.launchDistributor,
        buildClaimAllGenesisLaunchRewardsCall(genesisIds, wallet!),
        `${genesisIds.length} Operator NFTs`
      );
    }
    if (summary.ownerStatics > 0n || summary.ownerWeth > 0n) {
      setClaimProgress(`${batches.length + 1} of ${summary.claimCount}`);
      await send(
        "claim-rewards",
        t("claimPreviousRewards"),
        deployment.contracts.launchDistributor,
        buildClaimAllGenesisLaunchTreasuryRewardsCall(wallet!),
        "Previous-owner rewards"
      );
    }
  };

  // Recovery is open to anyone once the Epoch ends, whether or not this wallet
  // holds a Genesis, so its entry point sits above the wallet gate.
  const recoveriesLink =
    vault.data?.epochActive === false ? (
      <Link className="genesis-recoveries-link" href="/app/genesis/recoveries">
        {t("recoverOperatorCredit")} <span aria-hidden="true">→</span>
      </Link>
    ) : null;

  if (!wallet) {
    return (
      <div className="genesis-page">
        {recoveriesLink}
        <EmptyState title={t("connectTitle")} description={t("connectDescription")} />
      </div>
    );
  }
  if (owned.isLoading) return <p className="dapp-loading">{t("loading")}</p>;
  if (owned.error) {
    return (
      <div className="genesis-page">
        {recoveriesLink}
        <EmptyState title={t("unavailable")} description={describeTransactionError(owned.error)} />
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="genesis-page">
        {recoveriesLink}
        <EmptyState
          title={t("emptyTitle")}
          description={
            vault.data
              ? t("circulationDescription", {
                  circulating: vault.data.circulatingGenesis.toString(),
                  supply: vault.data.maximumSupply.toString(),
                  backing: formatTokenAmountGrouped(vault.data.vaultPrice, 18, 0),
                })
              : t("vaultEmptyDescription")
          }
          action={{ label: t("acquire"), href: "/app/swap?mode=nft" }}
        />
        {/* Rewards earned before a Genesis changed hands stay claimable by the
            previous owner, so a wallet holding none of them still has somewhere
            to collect from. */}
        {(summary.ownerStatics > 0n || summary.ownerWeth > 0n) && (
          <section className="ui-card genesis-panel" aria-label={t("pastRewardsAria")}>
            <div className="genesis-panel-head">
              <h3>{t("pastRewardsTitle")}</h3>
              <p>{t("pastRewardsDescription")}</p>
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
                          t("claimPrevious", { asset: symbol }),
                          deployment.contracts.launchDistributor,
                          buildClaimOwnerGenesisLaunchRewardsCall(asset, wallet),
                          symbol
                        )
                      )
                    }
                  >
                    {busy === `claim-owner-${symbol}` ? t("claiming") : t("claim")}
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
      {owned.data?.stale && (
        <p className="genesis-note is-warning" role="status">
          {t("syncing")}
        </p>
      )}
      <section className="genesis-summary ui-card" aria-label={t("holdingsAria")}>
        <div className="ui-stat">
          <span className="ui-stat__label">{t("held")}</span>
          <strong className="ui-stat__value">{items.length}</strong>
          <small>
            {t("heldStatus", {
              activated: summary.activated,
              unregistered: summary.unregistered,
            })}
          </small>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">{t("backedBy")}</span>
          <strong className="ui-stat__value">
            {vault.data
              ? `${formatTokenAmountGrouped(vault.data.vaultPrice * BigInt(items.length), 18, 0)} STATICS`
              : "—"}
          </strong>
          <small>
            {vault.data
              ? t("reserveHolding", {
                  count: items.length,
                  supply: vault.data.maximumSupply.toString(),
                })
              : ""}
          </small>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">{t("claimableNow")}</span>
          <strong className="ui-stat__value is-accent">
            {formatTokenAmountGrouped(summary.claimableStatics, 18, 2)} STATICS
          </strong>
          <small>
            {formatTokenAmountGrouped(summary.claimableWeth, 18, 4)} WETH
            {summary.ownerStatics > 0n || summary.ownerWeth > 0n ? t("includesPast") : ""}
          </small>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">{t("creditOutstanding")}</span>
          <strong className={`ui-stat__value${summary.owed > 0n ? " is-warning" : ""}`}>
            {summary.owed > 0n
              ? `${formatTokenAmountGrouped(summary.owed, 18, 0)} STATICS`
              : t("none")}
          </strong>
          <small>
            {summary.soonest
              ? t("creditDue", {
                  count: summary.creditCount,
                  id: summary.soonest.id.toString(),
                  date: new Date(summary.soonest.creditMaturity * 1_000).toLocaleDateString(),
                })
              : t("nothingToRepay")}
          </small>
        </div>
        <button
          className="ui-button ui-button--primary"
          type="button"
          disabled={busy !== null || summary.claimCount === 0}
          onClick={() => void act("claim-all", claimEverything)}
        >
          {busy === "claim-all"
            ? t("claimProgress", { progress: claimProgress ?? "" })
            : summary.claimCount > 1
              ? t("claimAllTransactions", { count: summary.claimCount })
              : t("claimAllSimple")}
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
            <div className="genesis-tabs" role="tablist" aria-label={t("actionsAria")}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "activate"}
                onClick={() => setTab("activate")}
              >
                <b>{t("activate")}</b>
                <small>
                  {selected.tier === GENESIS_MAX_TIER
                    ? t("topTier")
                    : t("tierChange", { current: selected.tier, target: targetTier })}
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
                <b>{t("rewards")}</b>
                <small>
                  {!selected.registered
                    ? t("notRegistered")
                    : t("pendingAmount", {
                        amount: formatTokenAmountGrouped(selected.pendingStatics, 18, 2),
                      })}
                </small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "credit"}
                onClick={() => setTab("credit")}
              >
                <b>{t("credit")}</b>
                <small>
                  {selected.creditActive
                    ? t("owed", {
                        amount: formatTokenAmountGrouped(selected.creditPrincipal, 18, 0),
                      })
                    : vault.data?.epochActive
                      ? t("opensAfterEpoch")
                      : t("borrowAgainstBacking")}
                </small>
              </button>
            </div>

            {tab === "activate" && (
              <section className="ui-card genesis-panel" aria-label={t("activationAria")}>
                <div className="genesis-panel-head">
                  <h3>{t("activationTitle")}</h3>
                  <p>{t("activationDescription")}</p>
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
                        <dt>{t("rewardWeight")}</dt>
                        <dd>
                          {genesisTierMultiplier(selected.tier).toFixed(2)}× →{" "}
                          {genesisTierMultiplier(targetTier).toFixed(2)}×
                        </dd>
                      </div>
                      <div className="is-total">
                        <dt>{t("youPay")}</dt>
                        <dd>{formatTokenAmountGrouped(activationCost, 18, 0)} STATICS</dd>
                      </div>
                    </dl>
                    <p className="genesis-note">
                      {t.rich("treasuryNote", { strong: (chunks) => <b>{chunks}</b> })}
                    </p>
                    <p className="genesis-note is-warning">
                      {t.rich("transferResetNote", { strong: (chunks) => <b>{chunks}</b> })}
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
                        ? t("confirming")
                        : t("activateToTier", {
                            tier: targetTier,
                            amount: formatTokenAmountGrouped(activationCost, 18, 0),
                          })}
                    </button>
                  </>
                ) : (
                  <p className="genesis-note">
                    {t.rich("maxTierNote", { strong: (chunks) => <b>{chunks}</b> })}
                  </p>
                )}
              </section>
            )}

            {tab === "rewards" && (
              <section className="ui-card genesis-panel" aria-label={t("launchRewardsAria")}>
                <div className="genesis-panel-head">
                  <h3>{t("launchRewardsTitle")}</h3>
                  <p>
                    {t("launchRewardsDescription", {
                      share: Number(owned.data?.rewardShareBps ?? 0) / 100,
                    })}
                  </p>
                </div>

                {!selected.registered ? (
                  <>
                    <p className="genesis-note is-warning">
                      {t.rich("earningNothing", {
                        strong: (chunks) => <b>{chunks}</b>,
                        weight: genesisTierMultiplier(selected.tier).toFixed(2),
                      })}
                    </p>
                    <dl className="genesis-figures">
                      <div>
                        <dt>{t("weightRegistered")}</dt>
                        <dd>{selected.multiplierBps.toString()}</dd>
                      </div>
                      <div>
                        <dt>{t("totalWeight")}</dt>
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
                            t("registerLabel", { id: selected.id.toString() }),
                            deployment.contracts.launchDistributor,
                            buildRegisterGenesisCall(selected.id),
                            t("identity.operator", { id: selected.id.toString() })
                          )
                        )
                      }
                    >
                      {busy === `register-${selected.id}`
                        ? t("registering")
                        : t("register", { id: selected.id.toString() })}
                    </button>
                  </>
                ) : (
                  <>
                    <dl className="genesis-figures">
                      <div>
                        <dt>{t("yourWeight")}</dt>
                        <dd>{selected.rewardWeight.toString()}</dd>
                      </div>
                      <div>
                        <dt>{t("poolShare")}</dt>
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
                            <span>{t("pendingAsset", { asset: symbol })}</span>
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
                                  t("claimOperatorAsset", {
                                    id: selected.id.toString(),
                                    asset: symbol,
                                  }),
                                  deployment.contracts.launchDistributor,
                                  buildClaimGenesisLaunchRewardsCall(selected.id, asset, wallet),
                                  symbol
                                )
                              )
                            }
                          >
                            {busy === `claim-${selected.id}-${symbol}` ? t("claiming") : t("claim")}
                          </button>
                        </li>
                      ))}
                      {(summary.ownerStatics > 0n || summary.ownerWeth > 0n) && (
                        <li>
                          <div>
                            <span>{t("previousOperators")}</span>
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
                                  t("claimPrevious", { asset: "STATICS" }),
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
                            {busy === "claim-owner-statics" ? t("claiming") : t("claim")}
                          </button>
                        </li>
                      )}
                    </ul>
                  </>
                )}

                <p className="genesis-note">
                  {t.rich("accrualNote", { strong: (chunks) => <b>{chunks}</b> })}
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
                          t("updateRewards"),
                          deployment.contracts.launchDistributor,
                          buildAccrueGenesisLaunchRewardsCall(),
                          t("currentFees")
                        )
                      )
                    }
                  >
                    {busy === "accrue" ? t("updating") : t("harvest")}
                  </button>
                  <span>{t("anyoneCanRun")}</span>
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
          label={t("rewardsDistributor")}
        />
        <AddressDisplay
          address={deployment.contracts.activationRegistry}
          chainId={deployment.descriptor.chainId}
          label={t("activationRegistry")}
        />
        <AddressDisplay
          address={deployment.contracts.vault}
          chainId={deployment.descriptor.chainId}
          label={t("operatorsVault")}
        />
      </section>
    </div>
  );
}
