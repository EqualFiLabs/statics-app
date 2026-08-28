"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { encodeFunctionData, formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  buildBuyGenesisTransaction,
  buildRedeemGenesisCall,
  dopplerStaticsTokenAbi,
  staticsGenesisAbi,
} from "@statics-protocol/sdk";

import Link from "next/link";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";

import { EmptyState } from "@/components/common/EmptyState";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { discoverNextAvailableGenesisId, discoverWalletGenesisIds } from "@/lib/genesis/discovery";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import {
  verifyLaunchDeployment,
  verifyLaunchDeploymentCached,
} from "@/lib/deployments/verify-launch";
import { useWalletState } from "@/providers/wallet-context";

type VaultDirection = "acquire" | "redeem";

/** One owned Genesis, with the credit state that decides whether it can go back. */
type RedeemableGenesis = Readonly<{ id: bigint; creditActive: boolean }>;

type ErrorCopy = Readonly<{
  walletRejected: string;
  justAcquired: string;
  repayCredit: string;
  operatorLocked: string;
  transactionFailed: string;
}>;

function describeError(error: unknown, copy: ErrorCopy): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return copy.walletRejected;
  if (message.includes("GenesisNotInVault")) return copy.justAcquired;
  if (message.includes("CreditAlreadyActive")) return copy.repayCredit;
  if (message.includes("GenesisLocked")) return copy.operatorLocked;
  return message || copy.transactionFailed;
}

export function GenesisVaultSwapPanel({ deployment }: { deployment: LaunchDeployment }) {
  const t = useTranslations("operatorVault");
  const errorCopy: ErrorCopy = {
    walletRejected: t("walletRejected"),
    justAcquired: t("justAcquired"),
    repayCredit: t("repayCreditBeforeRedeeming"),
    operatorLocked: t("operatorLocked"),
    transactionFailed: t("transactionFailed"),
  };
  const describeTransactionError = (cause: unknown) => describeError(cause, errorCopy);
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [selectedOwnedId, setSelectedOwnedId] = useState<string>("");
  const [direction, setDirection] = useState<VaultDirection>("acquire");
  const [busy, setBusy] = useState<"buy" | "redeem" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vault = useQuery({
    queryKey: ["genesis-vault-swap", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      await verifyLaunchDeploymentCached(publicClient, deployment);
      const [purchaseQuote, redemptionQuote, accounting, nextId] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "quoteGenesisPurchase",
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "quoteGenesisRedemption",
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "vaultAccounting",
        }),
        discoverNextAvailableGenesisId(publicClient, deployment),
      ]);
      return { purchaseQuote, redemptionQuote, accounting, nextId };
    },
  });

  const walletData = useQuery({
    queryKey: ["genesis-vault-wallet", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet) throw new Error("Connect a wallet to view Operators.");
      await verifyLaunchDeploymentCached(publicClient, deployment);
      const [ownedIds, staticsBalance, nativeBalance] = await Promise.all([
        discoverWalletGenesisIds(publicClient, deployment, wallet),
        publicClient.readContract({
          address: deployment.contracts.statics,
          abi: dopplerStaticsTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.getBalance({ address: wallet }),
      ]);
      // Credit locks a Genesis against redemption, and the old panel only found
      // out by reverting. Resolve it with the list so a locked NFT is marked
      // before anyone selects it.
      const owned = await Promise.all(
        ownedIds.map(async (id): Promise<RedeemableGenesis> => {
          const credit = await publicClient.readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisCreditAbi,
            functionName: "credit",
            args: [id],
          });
          return { id, creditActive: credit.active };
        })
      );
      return { owned, staticsBalance, nativeBalance };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.includes(deployment.descriptor.deploymentId) &&
        (String(query.queryKey[0]).startsWith("genesis-vault") ||
          String(query.queryKey[0]).startsWith("launch-genesis")),
    });
  };

  const requireWallet = () => {
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
    return Boolean(wallet && publicClient);
  };

  const transact = async (
    request: Omit<Parameters<typeof executeProtocolTransaction>[0], "deploymentId">
  ) => {
    await verifyLaunchDeployment(request.publicClient, deployment);
    return executeProtocolTransaction({
      ...request,
      deploymentId: deployment.descriptor.deploymentId,
    });
  };

  const buy = async () => {
    if (!requireWallet() || !wallet || !publicClient || !vault.data?.nextId) return;
    setBusy("buy");
    setError(null);
    try {
      const id = vault.data.nextId;
      const [quote, balance, allowance, stillAvailable] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "quoteGenesisPurchase",
        }),
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
          args: [wallet, deployment.contracts.vault],
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "isVaultInventory",
          args: [id],
        }),
      ]);
      if (!stillAvailable) throw new Error("GenesisNotInVault");
      if (balance < quote.staticsPrice) throw new Error(t("buyStaticsFirst"));
      if (allowance < quote.staticsPrice) {
        await transact({
          publicClient,
          wallet,
          chainId: deployment.descriptor.chainId,
          kind: "approve-staking-token",
          label: t("enableAcquisition"),
          amount: t("maximumStatics"),
          to: deployment.contracts.statics,
          data: encodeFunctionData({
            abi: dopplerStaticsTokenAbi,
            functionName: "approve",
            args: [deployment.contracts.vault, MAX_ERC20_ALLOWANCE],
          }),
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describeTransactionError,
        });
      }
      const purchase = buildBuyGenesisTransaction(id, wallet, quote.requiredNative);
      await transact({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        kind: "buy-genesis",
        label: t("acquireOperator", { id: id.toString() }),
        amount: `${formatEther(quote.staticsPrice)} STATICS + ${formatEther(quote.requiredNative)} ETH`,
        to: deployment.contracts.vault,
        data: purchase.data,
        value: purchase.value,
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeTransactionError,
      });
      await refresh();
    } catch (cause) {
      setError(describeTransactionError(cause));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const redeem = async () => {
    if (!requireWallet() || !wallet || !publicClient || !selectedOwnedId) return;
    setBusy("redeem");
    setError(null);
    try {
      const id = BigInt(selectedOwnedId);
      const redemptionQuote = await publicClient.readContract({
        address: deployment.contracts.vault,
        abi: currentGenesisVaultAbi,
        functionName: "quoteGenesisRedemption",
      });
      const approved = await publicClient.readContract({
        address: deployment.contracts.genesis,
        abi: staticsGenesisAbi,
        functionName: "getApproved",
        args: [id],
      });
      if (getAddress(approved) !== getAddress(deployment.contracts.vault)) {
        await transact({
          publicClient,
          wallet,
          chainId: deployment.descriptor.chainId,
          kind: "approve-genesis",
          label: t("approveRedemption", { id: id.toString() }),
          amount: t("operatorNumber", { id: id.toString() }),
          to: deployment.contracts.genesis,
          data: encodeFunctionData({
            abi: staticsGenesisAbi,
            functionName: "approve",
            args: [deployment.contracts.vault, id],
          }),
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describeTransactionError,
        });
      }
      await transact({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        kind: "redeem-genesis",
        label: t("redeemOperator", { id: id.toString() }),
        amount: `${formatEther(redemptionQuote.staticsPayout)} STATICS + ${formatEther(redemptionQuote.reservePayout)} ETH`,
        to: deployment.contracts.vault,
        data: buildRedeemGenesisCall(id, wallet),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeTransactionError,
      });
      setSelectedOwnedId("");
      await refresh();
    } catch (cause) {
      setError(describeTransactionError(cause));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  // Keep the last complete snapshot visible during background reconciliation.
  // Only the initial load blocks the panel, so navigation and confirmed writes
  // do not flash an empty state while the RPC catches up.
  if (vault.isLoading || (Boolean(wallet) && walletData.isLoading))
    return <p className="dapp-loading">{t("loading")}</p>;
  if (vault.error && !vault.data)
    return (
      <EmptyState title={t("unavailable")} description={describeTransactionError(vault.error)} />
    );
  if (walletData.error && !walletData.data)
    return (
      <EmptyState
        title={t("unavailable")}
        description={describeTransactionError(walletData.error)}
      />
    );

  const nextId = vault.data?.nextId ?? null;
  const purchaseQuote = vault.data?.purchaseQuote;
  const redemptionQuote = vault.data?.redemptionQuote;
  const accounting = vault.data?.accounting;
  const owned = walletData.data?.owned ?? [];

  const statics = (value: bigint | undefined, digits = 0) =>
    `${formatTokenAmountGrouped(value ?? 0n, 18, digits)} STATICS`;
  const eth = (value: bigint | undefined, digits = 5) =>
    `${formatTokenAmountGrouped(value ?? 0n, 18, digits)} ETH`;

  // Both legs, checked here rather than inside the click handler. The old panel
  // enabled the button regardless and reported the shortfall as a thrown error.
  const staticsNeeded = purchaseQuote?.staticsPrice ?? 0n;
  const nativeNeeded = purchaseQuote?.requiredNative ?? 0n;
  const staticsHeld = walletData.data?.staticsBalance ?? 0n;
  const nativeHeld = walletData.data?.nativeBalance ?? 0n;
  const staticsShort = wallet && staticsHeld < staticsNeeded ? staticsNeeded - staticsHeld : 0n;
  const nativeShort = wallet && nativeHeld < nativeNeeded ? nativeNeeded - nativeHeld : 0n;
  const cannotAfford = staticsShort > 0n || nativeShort > 0n;

  const selected = owned.find((item) => item.id.toString() === selectedOwnedId) ?? owned[0] ?? null;
  const selectedLocked = selected?.creditActive ?? false;

  return (
    <div className="genesis-vault-swap">
      <section className="portal-panel" aria-label={t("aria")}>
        <div className="portal-direction-tabs" role="tablist" aria-label={t("direction")}>
          {(["acquire", "redeem"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={direction === item}
              onClick={() => {
                setDirection(item);
                setError(null);
              }}
            >
              {item === "acquire" ? t("acquire") : t("redeem")}
            </button>
          ))}
        </div>

        {direction === "acquire" ? (
          nextId === null ? (
            <EmptyState
              title={t("inventoryExhausted")}
              description={t("inventoryExhaustedDescription")}
            />
          ) : (
            <>
              <div className="vault-hero">
                <NftArtwork
                  chainId={deployment.descriptor.chainId}
                  expandable
                  size="lg"
                  nft={{
                    kind: "collection",
                    tokenId: nextId,
                    contract: deployment.contracts.genesis,
                    name: `Operator #${nextId}`,
                    summary: t("nextAvailable"),
                    carries: [],
                    blockedReason: null,
                  }}
                />
                <div className="vault-hero-copy">
                  <h3>{t("operatorNumber", { id: nextId.toString() })}</h3>
                  <p>{t("nextFromVault")}</p>
                  <span className="ui-pill is-ready">{t("fullyBacked")}</span>
                </div>
              </div>

              <ul className="vault-legs">
                <li className={staticsShort > 0n ? "is-short" : undefined}>
                  <span>{t("staticsBacking")}</span>
                  <strong>{statics(staticsNeeded)}</strong>
                  <small>
                    {wallet
                      ? staticsShort > 0n
                        ? t("walletShort", {
                            amount: formatTokenAmountGrouped(staticsHeld, 18, 2),
                            shortfall: formatTokenAmountGrouped(staticsShort, 18, 2),
                          })
                        : t("walletBalance", {
                            amount: formatTokenAmountGrouped(staticsHeld, 18, 2),
                          })
                      : t("connectForBalance")}
                  </small>
                </li>
                <li className={nativeShort > 0n ? "is-short" : undefined}>
                  <span>{t("nativeCost")}</span>
                  <strong>{eth(nativeNeeded)}</strong>
                  <small>
                    {wallet
                      ? nativeShort > 0n
                        ? t("walletShort", {
                            amount: `${formatTokenAmountGrouped(nativeHeld, 18, 4)} ETH`,
                            shortfall: `${formatTokenAmountGrouped(nativeShort, 18, 5)} ETH`,
                          })
                        : t("walletBalance", {
                            amount: `${formatTokenAmountGrouped(nativeHeld, 18, 4)} ETH`,
                          })
                      : t("paidInNative")}
                  </small>
                </li>
              </ul>

              {staticsShort > 0n && (
                <p className="vault-notice is-error">
                  <b>
                    {t("needMoreStatics", {
                      amount: formatTokenAmountGrouped(staticsShort, 18, 2),
                    })}
                  </b>{" "}
                  <Link href="/app/swap">{t("buyOnTokenTab")}</Link>
                  {t("thenReturn")}
                </p>
              )}
              {nativeShort > 0n && (
                <p className="vault-notice is-error">
                  <b>
                    {t("needMoreEth", {
                      amount: formatTokenAmountGrouped(nativeShort, 18, 5),
                    })}
                  </b>{" "}
                  {t("nativeShortfallReason")}
                </p>
              )}

              <button
                className="portal-primary-action"
                type="button"
                disabled={busy !== null || (Boolean(wallet) && cannotAfford)}
                onClick={() => void buy()}
              >
                {busy === "buy"
                  ? t("confirming")
                  : wallet && cannotAfford
                    ? t("notEnough")
                    : t("acquireOperator", { id: nextId.toString() })}
              </button>
            </>
          )
        ) : (
          <>
            {!wallet || owned.length === 0 ? (
              <EmptyState title={t("noOperators")} description={t("noOperatorsDescription")} />
            ) : (
              <>
                <p className="portal-field-label">{t("chooseOperator")}</p>
                <div className="vault-owned" role="radiogroup" aria-label={t("yourOperators")}>
                  {owned.map((item) => {
                    const isSelected = selected?.id === item.id;
                    return (
                      <button
                        key={item.id.toString()}
                        className="vault-owned-card"
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={item.creditActive}
                        onClick={() => {
                          setSelectedOwnedId(item.id.toString());
                          setError(null);
                        }}
                      >
                        <NftArtwork
                          chainId={deployment.descriptor.chainId}
                          size="lg"
                          nft={{
                            kind: "collection",
                            tokenId: item.id,
                            contract: deployment.contracts.genesis,
                            name: `Operator #${item.id}`,
                            summary: t("ownedOperator"),
                            carries: [],
                            blockedReason: item.creditActive ? t("repayBeforeRedeeming") : null,
                          }}
                        />
                        <span>#{item.id.toString()}</span>
                        <small>{item.creditActive ? t("creditActive") : t("redeemable")}</small>
                      </button>
                    );
                  })}
                </div>

                {selectedLocked ? (
                  <p className="vault-notice is-error">
                    <b>{t("activeCredit", { id: selected?.id.toString() ?? "" })}</b>{" "}
                    <Link href="/app/genesis">{t("repayInOperators")}</Link>
                  </p>
                ) : (
                  <ul className="vault-legs">
                    <li>
                      <span>{t("youReceive")}</span>
                      <strong>{statics(redemptionQuote?.staticsPayout)}</strong>
                      <small>{t("fullBacking")}</small>
                    </li>
                    <li>
                      <span>{t("reserveShare")}</span>
                      <strong>{eth(redemptionQuote?.reservePayout)}</strong>
                      <small>
                        {accounting?.epochActive
                          ? t("noReserveDuringEpoch")
                          : t("reserveFraction", {
                              supply: accounting?.maximumSupply.toString() ?? "5,555",
                            })}
                      </small>
                    </li>
                  </ul>
                )}

                <button
                  className="portal-primary-action"
                  type="button"
                  disabled={busy !== null || !selected || !selectedOwnedId || selectedLocked}
                  onClick={() => void redeem()}
                >
                  {busy === "redeem"
                    ? t("confirming")
                    : selectedLocked
                      ? t("repayFirst")
                      : t("redeemOperator", { id: selected?.id.toString() ?? "" })}
                </button>
              </>
            )}
          </>
        )}

        {error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <p className="vault-strip">
        <b>{accounting?.vaultInventory.toString() ?? "—"}</b>{" "}
        {t("vaultRemaining", {
          supply: accounting?.maximumSupply.toString() ?? "—",
        })}
        <Link href="/app">{t("vaultDetail")}</Link>
      </p>
    </div>
  );
}
