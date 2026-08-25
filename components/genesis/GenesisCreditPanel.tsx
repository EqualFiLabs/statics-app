"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { encodeFunctionData, formatEther, getAddress, parseEther } from "viem";
import { usePublicClient } from "wagmi";
import { dopplerStaticsTokenAbi } from "@statics-protocol/sdk";
import {
  GENESIS_MAX_CREDIT_PRINCIPAL,
  buildExtendGenesisCreditTransaction,
  buildOpenGenesisCreditTransaction,
  buildRepayGenesisCreditCall,
  staticsGenesisCreditAbi,
} from "@statics-protocol/sdk/genesis-credit";

import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { useWalletState } from "@/providers/wallet-context";

function describeCreditError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("CreditUnavailableDuringEpoch"))
    return "Secured credit opens after the Genesis Epoch.";
  if (message.includes("CreditOriginationsPaused"))
    return "New Genesis credit is temporarily paused.";
  if (message.includes("CreditExpired"))
    return "This credit has expired and can no longer be extended.";
  if (message.includes("CreditNotRecoverable")) return "This credit is not recoverable yet.";
  return message || "The Genesis credit transaction failed.";
}

function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

type GenesisCreditState = {
  owner: `0x${string}`;
  principal: bigint;
  maturity: number;
  recoverableAt: number;
  active: boolean;
};
type GenesisCreditQuote = {
  totalNativeFee: bigint;
  reserveShareBps: number;
  treasuryShareBps: number;
  reservePortion: bigint;
  treasuryPortion: bigint;
};

export function GenesisCreditPanel({
  deployment,
  genesisId,
}: {
  deployment: LaunchDeployment;
  genesisId: bigint;
}) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = useQuery({
    queryKey: [
      "launch-genesis-credit",
      deployment.descriptor.deploymentId,
      genesisId.toString(),
      wallet,
    ],
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet) throw new Error("Connect a wallet first.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [vault, originationsPaused, credit, limit] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "vaultAccounting",
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisCreditAbi,
          functionName: "creditOriginationsPaused",
        }) as Promise<boolean>,
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisCreditAbi,
          functionName: "credit",
          args: [genesisId],
        }) as Promise<GenesisCreditState>,
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisCreditAbi,
          functionName: "creditLimit",
          args: [genesisId],
        }) as Promise<bigint>,
      ]);
      return {
        epochActive: vault.epochActive,
        genesisEpochEnd: Number(vault.genesisEpochEnd),
        originationsPaused,
        credit,
        limit,
      };
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.includes(deployment.descriptor.deploymentId) &&
        (String(query.queryKey[0]).startsWith("launch-genesis-credit") ||
          String(query.queryKey[0]).startsWith("launch-genesis-owned") ||
          String(query.queryKey[0]).startsWith("genesis-vault")),
    });
  };

  const send = async (
    key: "open-genesis-credit" | "extend-genesis-credit" | "repay-genesis-credit",
    label: string,
    data: `0x${string}`,
    reviewedAmount: string,
    value?: bigint
  ) => {
    if (!wallet || !publicClient) return;
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deployment.descriptor.chainId,
      deploymentId: deployment.descriptor.deploymentId,
      kind: key,
      label,
      amount: reviewedAmount,
      to: deployment.contracts.vault,
      data,
      value,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeCreditError,
    });
  };

  const act = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      if (!publicClient || !wallet) return;
      await verifyLaunchDeployment(publicClient, deployment);
      await action();
      await refresh();
    } catch (cause) {
      setError(describeCreditError(cause));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!wallet || state.isLoading) return null;
  if (state.error || !state.data) {
    return <p className="dapp-inline-error">{describeCreditError(state.error)}</p>;
  }

  const credit = state.data.credit;

  if (!credit.active) {
    return (
      <section className="genesis-action" aria-label={`Genesis #${genesisId} secured credit`}>
        <h3>Secured credit</h3>
        {state.data.epochActive ? (
          <p>
            Genesis credit opens after the Epoch ends at{" "}
            {formatTimestamp(state.data.genesisEpochEnd)}. The maximum principal is{" "}
            {formatEther(GENESIS_MAX_CREDIT_PRINCIPAL)} STATICS.
          </p>
        ) : state.data.originationsPaused ? (
          <p>New Genesis credit is temporarily paused.</p>
        ) : (
          <>
            <p>
              Borrow up to {formatEther(state.data.limit || GENESIS_MAX_CREDIT_PRINCIPAL)} STATICS
              against this Genesis.
            </p>
            <label className="ui-field">
              Borrow STATICS
              <input
                inputMode="decimal"
                value={amount}
                placeholder="0"
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy !== null}
              />
            </label>
            <button
              className="ui-button ui-button--primary ui-button--block"
              type="button"
              disabled={busy !== null || !amount}
              onClick={() =>
                void act("open", async () => {
                  if (!publicClient) return;
                  const principal = parseEther(amount);
                  if (principal <= 0n || principal > state.data.limit) {
                    throw new Error("Choose an amount within this Genesis credit limit.");
                  }
                  const quote = (await publicClient.readContract({
                    address: deployment.contracts.vault,
                    abi: staticsGenesisCreditAbi,
                    functionName: "quoteGenesisCredit",
                    args: [principal],
                  })) as GenesisCreditQuote;
                  const transaction = buildOpenGenesisCreditTransaction(
                    genesisId,
                    principal,
                    quote.totalNativeFee
                  );
                  await send(
                    "open-genesis-credit",
                    `Borrow against Genesis #${genesisId}`,
                    transaction.data,
                    `${formatEther(principal)} STATICS + ${formatEther(quote.totalNativeFee)} ETH fee`,
                    transaction.value
                  );
                  setAmount("");
                })
              }
            >
              {busy === "open" ? "Borrowing…" : "Borrow STATICS"}
            </button>
          </>
        )}

        {error && <p className="dapp-inline-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="genesis-action" aria-label={`Genesis #${genesisId} secured credit`}>
      <h3>Secured credit</h3>
      <p>Borrowed: {formatEther(credit.principal)} STATICS</p>
      <p>Maturity: {formatTimestamp(credit.maturity)}</p>
      <p>Recovery available: {formatTimestamp(credit.recoverableAt)}</p>
      <div className="ui-inline-actions">
        <button
          className="ui-button ui-button--secondary"
          type="button"
          disabled={busy !== null || now > credit.maturity}
          onClick={() =>
            void act("extend", async () => {
              if (!publicClient) return;
              const quote = (await publicClient.readContract({
                address: deployment.contracts.vault,
                abi: staticsGenesisCreditAbi,
                functionName: "quoteGenesisCreditExtension",
                args: [genesisId],
              })) as GenesisCreditQuote;
              const transaction = buildExtendGenesisCreditTransaction(
                genesisId,
                quote.totalNativeFee
              );
              await send(
                "extend-genesis-credit",
                `Extend Genesis #${genesisId} credit`,
                transaction.data,
                `${formatEther(quote.totalNativeFee)} ETH fee`,
                transaction.value
              );
            })
          }
        >
          {busy === "extend" ? "Extending…" : "Extend until maturity"}
        </button>
        <button
          className="ui-button ui-button--primary"
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void act("repay", async () => {
              if (!publicClient || !wallet) return;
              const allowance = await publicClient.readContract({
                address: deployment.contracts.statics,
                abi: dopplerStaticsTokenAbi,
                functionName: "allowance",
                args: [wallet, deployment.contracts.vault],
              });
              if (allowance < credit.principal) {
                await executeProtocolTransaction({
                  publicClient,
                  wallet,
                  chainId: deployment.descriptor.chainId,
                  deploymentId: deployment.descriptor.deploymentId,
                  kind: "approve-staking-token",
                  label: "Enable Genesis credit repayment",
                  amount: "Maximum STATICS",
                  to: deployment.contracts.statics,
                  data: encodeFunctionData({
                    abi: dopplerStaticsTokenAbi,
                    functionName: "approve",
                    args: [deployment.contracts.vault, MAX_ERC20_ALLOWANCE],
                  }),
                  sendTransaction: walletState.sendEvmTransaction,
                  describeError: describeCreditError,
                });
              }
              await send(
                "repay-genesis-credit",
                `Repay Genesis #${genesisId} credit`,
                buildRepayGenesisCreditCall(genesisId),
                `${formatEther(credit.principal)} STATICS`
              );
            })
          }
        >
          {busy === "repay" ? "Repaying…" : "Repay"}
        </button>
      </div>
      <p>This Genesis is transfer-locked while secured credit is active.</p>
      {error && <p className="dapp-inline-error">{error}</p>}
    </section>
  );
}
