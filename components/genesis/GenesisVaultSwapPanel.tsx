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

import { EmptyState } from "@/components/common/EmptyState";
import { NftArtwork } from "@/components/wallet/NftArtwork";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { discoverNextAvailableGenesisId, discoverWalletGenesisIds } from "@/lib/genesis/discovery";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { useWalletState } from "@/providers/wallet-context";

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
  const [busy, setBusy] = useState<"buy" | "redeem" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vault = useQuery({
    queryKey: ["genesis-vault-swap", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [purchaseQuote, redemptionQuote, accounting, nextId, ownedIds] = await Promise.all([
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
      ]);
      return { purchaseQuote, redemptionQuote, accounting, nextId, ownedIds };
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
          label: "Enable Genesis NFT acquisition",
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
        label: `Acquire Genesis #${id}`,
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
  return (
    <div className="genesis-vault-swap">
      <section className="portal-panel" aria-labelledby="genesis-vault-state-title">
        <p className="dapp-eyebrow">Genesis Vault</p>
        <h2 id="genesis-vault-state-title">Fully backed Genesis inventory</h2>
        <dl className="portal-quote-grid">
          <div>
            <dt>Remaining</dt>
            <dd>{accounting?.vaultInventory.toString() ?? "—"}</dd>
          </div>
          <div>
            <dt>Circulating</dt>
            <dd>{accounting?.circulatingGenesis.toString() ?? "—"}</dd>
          </div>
          <div>
            <dt>Native reserve</dt>
            <dd>{formatEther(accounting?.reserveETH ?? 0n)} ETH</dd>
          </div>
          <div>
            <dt>Reserve / Genesis</dt>
            <dd>{formatEther(accounting?.reserveBackingPerGenesis ?? 0n)} ETH</dd>
          </div>
          <div>
            <dt>Outstanding credit</dt>
            <dd>{formatEther(accounting?.outstandingGenesisCredit ?? 0n)} STATICS</dd>
          </div>
          <div>
            <dt>Genesis Epoch</dt>
            <dd>{accounting?.epochActive ? "Active" : "Complete"}</dd>
          </div>
        </dl>
      </section>

      <section className="portal-panel" aria-labelledby="next-genesis-title">
        <p className="dapp-eyebrow">STATICS → Genesis NFT</p>
        <h2 id="next-genesis-title">
          {nextId === null ? "Vault inventory exhausted" : `Genesis #${nextId}`}
        </h2>
        {nextId !== null && (
          <NftArtwork
            chainId={deployment.descriptor.chainId}
            expandable
            nft={{
              kind: "collection",
              tokenId: nextId,
              contract: deployment.contracts.genesis,
              name: `Genesis #${nextId}`,
              summary: "Next available Genesis NFT",
              carries: [],
              blockedReason: null,
            }}
          />
        )}
        <dl className="portal-quote-grid">
          <div>
            <dt>STATICS backing</dt>
            <dd>{formatEther(purchaseQuote?.staticsPrice ?? 0n)} STATICS</dd>
          </div>
          <div>
            <dt>Reserve buy-in</dt>
            <dd>{formatEther(purchaseQuote?.reserveBuyIn ?? 0n)} ETH</dd>
          </div>
          <div>
            <dt>Acquisition fee</dt>
            <dd>{formatEther(purchaseQuote?.nativeFee ?? 0n)} ETH</dd>
          </div>
          <div>
            <dt>Total ETH required</dt>
            <dd>{formatEther(purchaseQuote?.requiredNative ?? 0n)} ETH</dd>
          </div>
        </dl>
        <button
          className="portal-primary-action"
          type="button"
          disabled={busy !== null || nextId === null}
          onClick={() => void buy()}
        >
          {busy === "buy" ? "Confirming…" : "Acquire Genesis NFT"}
        </button>
      </section>

      <section className="portal-panel" aria-labelledby="redeem-genesis-title">
        <p className="dapp-eyebrow">Genesis NFT → backing</p>
        <h2 id="redeem-genesis-title">Redeem an owned NFT</h2>
        {wallet && (vault.data?.ownedIds.length ?? 0) > 0 ? (
          <>
            <label className="portal-field">
              <span>Genesis NFT</span>
              <select
                value={selectedOwnedId}
                onChange={(event) => setSelectedOwnedId(event.target.value)}
              >
                <option value="">Choose an NFT</option>
                {vault.data!.ownedIds.map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    Genesis #{id.toString()}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Receive {formatEther(redemptionQuote?.staticsPayout ?? 0n)} STATICS +{" "}
              {formatEther(redemptionQuote?.reservePayout ?? 0n)} ETH.
            </p>
            <button
              className="portal-primary-action"
              type="button"
              disabled={busy !== null || !selectedOwnedId}
              onClick={() => void redeem()}
            >
              {busy === "redeem" ? "Confirming…" : "Redeem Genesis"}
            </button>
          </>
        ) : (
          <p>Connect a wallet holding a Genesis NFT to redeem it.</p>
        )}
      </section>
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
