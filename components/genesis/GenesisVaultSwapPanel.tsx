"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { useWalletState } from "@/providers/wallet-context";

type VaultDirection = "acquire" | "redeem";

/** One owned Genesis, with the credit state that decides whether it can go back. */
type RedeemableGenesis = Readonly<{ id: bigint; creditActive: boolean }>;

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("GenesisNotInVault"))
    return "That NFT was just acquired. Loading the next one.";
  if (message.includes("CreditAlreadyActive"))
    return "Repay or recover this Genesis credit before redeeming.";
  if (message.includes("GenesisLocked"))
    return "This Genesis is currently locked and cannot be redeemed.";
  return message || "The Genesis Vault transaction failed.";
}

export function GenesisVaultSwapPanel({ deployment }: { deployment: LaunchDeployment }) {
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
    queryKey: ["genesis-vault-swap", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [
        purchaseQuote,
        redemptionQuote,
        accounting,
        nextId,
        ownedIds,
        staticsBalance,
        nativeBalance,
      ] = await Promise.all([
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
        wallet ? discoverWalletGenesisIds(publicClient, deployment, wallet) : [],
        wallet
          ? publicClient.readContract({
              address: deployment.contracts.statics,
              abi: dopplerStaticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            })
          : 0n,
        wallet ? publicClient.getBalance({ address: wallet }) : 0n,
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
      return {
        purchaseQuote,
        redemptionQuote,
        accounting,
        nextId,
        owned,
        staticsBalance,
        nativeBalance,
      };
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
      if (balance < quote.staticsPrice)
        throw new Error("Buy STATICS first, then switch back to NFT.");
      if (allowance < quote.staticsPrice) {
        await transact({
          publicClient,
          wallet,
          chainId: deployment.descriptor.chainId,
          kind: "approve-staking-token",
          label: "Enable Operator NFT acquisition",
          amount: "Maximum STATICS",
          to: deployment.contracts.statics,
          data: encodeFunctionData({
            abi: dopplerStaticsTokenAbi,
            functionName: "approve",
            args: [deployment.contracts.vault, MAX_ERC20_ALLOWANCE],
          }),
          sendTransaction: walletState.sendEvmTransaction,
          describeError,
        });
      }
      const purchase = buildBuyGenesisTransaction(id, wallet, quote.requiredNative);
      await transact({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        kind: "buy-genesis",
        label: `Acquire Operators #${id}`,
        amount: `${formatEther(quote.staticsPrice)} STATICS + ${formatEther(quote.requiredNative)} ETH`,
        to: deployment.contracts.vault,
        data: purchase.data,
        value: purchase.value,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
      await refresh();
    } catch (cause) {
      setError(describeError(cause));
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
          label: `Approve Genesis #${id} redemption`,
          amount: `Genesis #${id}`,
          to: deployment.contracts.genesis,
          data: encodeFunctionData({
            abi: staticsGenesisAbi,
            functionName: "approve",
            args: [deployment.contracts.vault, id],
          }),
          sendTransaction: walletState.sendEvmTransaction,
          describeError,
        });
      }
      await transact({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        kind: "redeem-genesis",
        label: `Redeem Genesis #${id}`,
        amount: `${formatEther(redemptionQuote.staticsPayout)} STATICS + ${formatEther(redemptionQuote.reservePayout)} ETH`,
        to: deployment.contracts.vault,
        data: buildRedeemGenesisCall(id, wallet),
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
      });
      setSelectedOwnedId("");
      await refresh();
    } catch (cause) {
      setError(describeError(cause));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (vault.isLoading) return <p className="dapp-loading">Loading the Genesis Vault…</p>;
  if (vault.error)
    return (
      <EmptyState title="Genesis Vault unavailable" description={describeError(vault.error)} />
    );

  const nextId = vault.data?.nextId ?? null;
  const purchaseQuote = vault.data?.purchaseQuote;
  const redemptionQuote = vault.data?.redemptionQuote;
  const accounting = vault.data?.accounting;
  const owned = vault.data?.owned ?? [];

  const statics = (value: bigint | undefined, digits = 0) =>
    `${formatTokenAmountGrouped(value ?? 0n, 18, digits)} STATICS`;
  const eth = (value: bigint | undefined, digits = 5) =>
    `${formatTokenAmountGrouped(value ?? 0n, 18, digits)} ETH`;

  // Both legs, checked here rather than inside the click handler. The old panel
  // enabled the button regardless and reported the shortfall as a thrown error.
  const staticsNeeded = purchaseQuote?.staticsPrice ?? 0n;
  const nativeNeeded = purchaseQuote?.requiredNative ?? 0n;
  const staticsHeld = vault.data?.staticsBalance ?? 0n;
  const nativeHeld = vault.data?.nativeBalance ?? 0n;
  const staticsShort = wallet && staticsHeld < staticsNeeded ? staticsNeeded - staticsHeld : 0n;
  const nativeShort = wallet && nativeHeld < nativeNeeded ? nativeNeeded - nativeHeld : 0n;
  const cannotAfford = staticsShort > 0n || nativeShort > 0n;

  const selected = owned.find((item) => item.id.toString() === selectedOwnedId) ?? owned[0] ?? null;
  const selectedLocked = selected?.creditActive ?? false;

  return (
    <div className="genesis-vault-swap">
      <section className="portal-panel" aria-label="Genesis Vault">
        <div className="portal-direction-tabs" role="tablist" aria-label="Vault direction">
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
              {item === "acquire" ? "Acquire" : "Redeem"}
            </button>
          ))}
        </div>

        {direction === "acquire" ? (
          nextId === null ? (
            <EmptyState
              title="Vault inventory is exhausted"
              description="Every Operator NFT has been acquired. They can still be bought from holders, and redeemed back into the Vault at any time."
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
                    name: `Genesis #${nextId}`,
                    summary: "Next available Operator NFT",
                    carries: [],
                    blockedReason: null,
                  }}
                />
                <div className="vault-hero-copy">
                  <h3>Genesis #{nextId.toString()}</h3>
                  <p>Next from the Vault. Redeemable for its full backing at any time.</p>
                  <span className="ui-pill is-ready">Fully backed</span>
                </div>
              </div>

              <ul className="vault-legs">
                <li className={staticsShort > 0n ? "is-short" : undefined}>
                  <span>STATICS backing</span>
                  <strong>{statics(staticsNeeded)}</strong>
                  <small>
                    {wallet
                      ? `You hold ${formatTokenAmountGrouped(staticsHeld, 18, 2)}${staticsShort > 0n ? ` · short ${formatTokenAmountGrouped(staticsShort, 18, 2)}` : ""}`
                      : "Connect a wallet to check your balance"}
                  </small>
                </li>
                <li className={nativeShort > 0n ? "is-short" : undefined}>
                  <span>Acquisition fee + reserve buy-in</span>
                  <strong>{eth(nativeNeeded)}</strong>
                  <small>
                    {wallet
                      ? `You hold ${formatTokenAmountGrouped(nativeHeld, 18, 4)} ETH${nativeShort > 0n ? ` · short ${formatTokenAmountGrouped(nativeShort, 18, 5)}` : ""}`
                      : "Paid in the chain's native asset"}
                  </small>
                </li>
              </ul>

              {staticsShort > 0n && (
                <p className="vault-notice is-error">
                  <b>You need {formatTokenAmountGrouped(staticsShort, 18, 2)} more STATICS.</b>{" "}
                  <Link href="/app/swap">Buy STATICS on the Token tab</Link>, then come back.
                </p>
              )}
              {nativeShort > 0n && (
                <p className="vault-notice is-error">
                  <b>You need {formatTokenAmountGrouped(nativeShort, 18, 5)} more ETH</b> for the
                  acquisition fee and reserve buy-in.
                </p>
              )}

              <button
                className="portal-primary-action"
                type="button"
                disabled={busy !== null || (Boolean(wallet) && cannotAfford)}
                onClick={() => void buy()}
              >
                {busy === "buy"
                  ? "Confirming…"
                  : wallet && cannotAfford
                    ? "Not enough to acquire"
                    : `Acquire Operators #${nextId}`}
              </button>
            </>
          )
        ) : (
          <>
            {!wallet || owned.length === 0 ? (
              <EmptyState
                title="No Operators NFTs to redeem"
                description="Redeeming returns a Genesis to the Vault in exchange for its full backing. Connect a wallet holding one to continue."
              />
            ) : (
              <>
                <p className="portal-field-label">Choose a Genesis to redeem</p>
                <div className="vault-owned" role="radiogroup" aria-label="Your Operators NFTs">
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
                            name: `Genesis #${item.id}`,
                            summary: "Owned Operator NFT",
                            carries: [],
                            blockedReason: item.creditActive
                              ? "Repay secured credit before redeeming."
                              : null,
                          }}
                        />
                        <span>#{item.id.toString()}</span>
                        <small>{item.creditActive ? "Credit active" : "Redeemable"}</small>
                      </button>
                    );
                  })}
                </div>

                {selectedLocked ? (
                  <p className="vault-notice is-error">
                    <b>Genesis #{selected?.id.toString()} has active secured credit.</b> Repay it in{" "}
                    <Link href="/app/genesis">My Operators</Link> before this NFT can be redeemed.
                  </p>
                ) : (
                  <ul className="vault-legs">
                    <li>
                      <span>You receive</span>
                      <strong>{statics(redemptionQuote?.staticsPayout)}</strong>
                      <small>The full fixed backing</small>
                    </li>
                    <li>
                      <span>Reserve share</span>
                      <strong>{eth(redemptionQuote?.reservePayout)}</strong>
                      <small>
                        {accounting?.epochActive
                          ? "No reserve share is paid until the Genesis Epoch ends"
                          : `1 / ${accounting?.maximumSupply.toString() ?? "5,555"} of the native reserve`}
                      </small>
                    </li>
                  </ul>
                )}

                <button
                  className="portal-primary-action"
                  type="button"
                  disabled={busy !== null || !selected || selectedLocked}
                  onClick={() => void redeem()}
                >
                  {busy === "redeem"
                    ? "Confirming…"
                    : selectedLocked
                      ? "Repay credit first"
                      : `Redeem Genesis #${selected?.id ?? ""}`}
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
        <b>{accounting?.vaultInventory.toString() ?? "—"}</b> of{" "}
        {accounting?.maximumSupply.toString() ?? "—"} left in the Vault
        <Link href="/app">Vault detail →</Link>
      </p>
    </div>
  );
}
