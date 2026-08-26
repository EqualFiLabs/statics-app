"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { encodeFunctionData, formatEther, getAddress, parseEther } from "viem";
import { useBlock, usePublicClient } from "wagmi";
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
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { useWalletState } from "@/providers/wallet-context";

/** StaticsGenesisVault.RECOVERY_GRACE. */
const RECOVERY_GRACE_SECONDS = 3_600;
/** StaticsGenesisVault.CREDIT_TERM. */
const CREDIT_TERM_SECONDS = 30 * 24 * 60 * 60;

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

/** "6d 04h", or "1h 12m" once it is close enough that days stop being useful. */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
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

/**
 * What happens to this NFT if the credit is not repaid, drawn to scale.
 *
 * The term, the grace hour, and the open-ended recoverable window after it are
 * the whole risk of borrowing here, and a pair of locale timestamps does not
 * convey them. `now` moves along the track once a credit is live.
 */
function RecoveryTimeline({
  openedAt,
  maturity,
  recoverableAt,
  now,
}: Readonly<{
  openedAt: number;
  maturity: number;
  recoverableAt: number;
  now: number | null;
}>) {
  // A tail past the recovery point keeps the danger band visible rather than
  // collapsing it to a hairline at the right edge.
  const tail = Math.round(CREDIT_TERM_SECONDS * 0.18);
  const span = Math.max(1, recoverableAt + tail - openedAt);
  const pct = (from: number, to: number) => ((to - from) / span) * 100;
  const nowPct =
    now === null ? null : Math.min(99.6, Math.max(0, pct(openedAt, Math.max(now, openedAt))));

  return (
    <div className="genesis-timeline">
      <p className="dapp-eyebrow">
        {now === null ? "Before you borrow, know the shape of it" : "If this is not repaid"}
      </p>
      <div className="genesis-timeline-track">
        <span
          className="genesis-timeline-segment is-safe"
          style={{ left: 0, width: `${pct(openedAt, maturity)}%` }}
        >
          30-day term
        </span>
        <span
          className="genesis-timeline-segment is-grace"
          style={{
            left: `${pct(openedAt, maturity)}%`,
            width: `${pct(maturity, recoverableAt)}%`,
          }}
        >
          1h grace
        </span>
        <span
          className="genesis-timeline-segment is-danger"
          style={{
            left: `${pct(openedAt, recoverableAt)}%`,
            width: `${100 - pct(openedAt, recoverableAt)}%`,
          }}
        >
          Recoverable
        </span>
        {nowPct !== null && (
          <span
            className="genesis-timeline-now"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="genesis-timeline-marks">
        <span>{now === null ? "Today" : "Opened"}</span>
        <span>Matures {new Date(maturity * 1_000).toLocaleDateString()}</span>
        <span>Anyone can recover</span>
      </div>
    </div>
  );
}

export function GenesisCreditPanel({
  deployment,
  genesisId,
}: {
  deployment: LaunchDeployment;
  genesisId: bigint;
}) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const { data: latestBlock } = useBlock({
    chainId: deployment.descriptor.chainId,
    watch: true,
  });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = latestBlock ? Number(latestBlock.timestamp) : null;

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
        vaultPrice: vault.vaultPrice,
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

  if (!wallet || state.isLoading || now === null) {
    return <p className="dapp-loading">Loading secured credit…</p>;
  }
  if (state.error || !state.data) {
    return <p className="dapp-inline-error">{describeCreditError(state.error)}</p>;
  }

  const credit = state.data.credit;
  const maxPrincipal = state.data.limit > 0n ? state.data.limit : GENESIS_MAX_CREDIT_PRINCIPAL;
  const backing = state.data.vaultPrice;

  if (credit.active) {
    const openedAt = credit.maturity - CREDIT_TERM_SECONDS;
    const untilMaturity = credit.maturity - now;
    const untilRecoverable = credit.recoverableAt - now;
    const overdue = untilMaturity <= 0;

    return (
      <section
        className="ui-card genesis-panel"
        aria-label={`Operator #${genesisId} secured credit`}
      >
        <div className="genesis-panel-head">
          <h3>Secured credit — active</h3>
          <p>
            You borrowed against this NFT&apos;s backing. It cannot be transferred until the credit
            is repaid.
          </p>
        </div>

        <dl className="genesis-figures">
          <div>
            <dt>Principal owed</dt>
            <dd>{formatTokenAmountGrouped(credit.principal, 18, 0)} STATICS</dd>
          </div>
          <div>
            <dt>Against backing of</dt>
            <dd>
              {formatTokenAmountGrouped(backing, 18, 0)} STATICS
              {backing > 0n ? ` · ${Number((credit.principal * 100n) / backing)}% LTV` : ""}
            </dd>
          </div>
          <div className="is-total">
            <dt>{overdue ? "Recoverable in" : "Repay within"}</dt>
            <dd>{formatCountdown(overdue ? untilRecoverable : untilMaturity)}</dd>
          </div>
        </dl>

        <RecoveryTimeline
          openedAt={openedAt}
          maturity={credit.maturity}
          recoverableAt={credit.recoverableAt}
          now={now}
        />

        <p className={`genesis-note ${overdue ? "is-error" : "is-warning"}`}>
          <b>After the grace hour, anyone can recover this Genesis.</b> They take the caller
          incentive, the NFT leaves your wallet, and you keep the residual value rather than the
          full backing.
        </p>

        <dl className="genesis-figures">
          <div>
            <dt>Matures</dt>
            <dd>{formatTimestamp(credit.maturity)}</dd>
          </div>
          <div>
            <dt>Recoverable from</dt>
            <dd>{formatTimestamp(credit.recoverableAt)}</dd>
          </div>
        </dl>

        <div className="ui-inline-actions">
          <button
            className="ui-button ui-button--secondary"
            type="button"
            disabled={busy !== null || overdue}
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
                  `Extend Operator #${genesisId} credit`,
                  transaction.data,
                  `${formatEther(quote.totalNativeFee)} ETH fee`,
                  transaction.value
                );
              })
            }
          >
            {busy === "extend" ? "Extending…" : "Extend the term"}
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
                  `Repay Operator #${genesisId} credit`,
                  buildRepayGenesisCreditCall(genesisId),
                  `${formatEther(credit.principal)} STATICS`
                );
              })
            }
          >
            {busy === "repay"
              ? "Repaying…"
              : `Repay ${formatTokenAmountGrouped(credit.principal, 18, 0)} STATICS`}
          </button>
        </div>

        {error && (
          <p className="dapp-inline-error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (state.data.epochActive) {
    return (
      <section
        className="ui-card genesis-panel"
        aria-label={`Operator #${genesisId} secured credit`}
      >
        <div className="genesis-panel-head">
          <h3>Secured credit</h3>
          <p>Borrowing against an Operator NFT opens once the Genesis Epoch ends.</p>
        </div>
        <div className="genesis-locked">
          <strong>{formatCountdown(state.data.genesisEpochEnd - now)}</strong>
          <p>
            The Epoch ends {formatTimestamp(state.data.genesisEpochEnd)}. You will then be able to
            borrow up to {formatTokenAmountGrouped(GENESIS_MAX_CREDIT_PRINCIPAL, 18, 0)} STATICS
            against this NFT.
          </p>
        </div>
      </section>
    );
  }

  if (state.data.originationsPaused) {
    return (
      <section
        className="ui-card genesis-panel"
        aria-label={`Operator #${genesisId} secured credit`}
      >
        <div className="genesis-panel-head">
          <h3>Secured credit</h3>
          <p>New Genesis credit is temporarily paused. Existing credit is unaffected.</p>
        </div>
      </section>
    );
  }

  const parsed = (() => {
    if (!amount.trim()) return 0n;
    try {
      return parseEther(amount);
    } catch {
      return 0n;
    }
  })();
  const clamped = parsed > maxPrincipal ? maxPrincipal : parsed;
  const ltv = backing > 0n ? Number((clamped * 10_000n) / backing) / 100 : 0;
  const maxLtv = backing > 0n ? Number((maxPrincipal * 10_000n) / backing) / 100 : 0;

  return (
    <section className="ui-card genesis-panel" aria-label={`Operator #${genesisId} secured credit`}>
      <div className="genesis-panel-head">
        <h3>Borrow against this Genesis</h3>
        <p>
          Take STATICS out of this NFT&apos;s backing for 30 days. The NFT stays in your wallet but
          cannot be transferred until you repay.
        </p>
      </div>

      <div className="genesis-borrow">
        <p className="genesis-borrow-amount">
          <b>{formatTokenAmountGrouped(clamped, 18, 0)}</b>
          <span>STATICS · {ltv.toFixed(0)}% of backing</span>
        </p>
        <label className="ui-field">
          <span className="sr-only">Amount to borrow</span>
          <input
            type="range"
            min={0}
            max={Number(formatEther(maxPrincipal))}
            step={1_000}
            value={Number(formatEther(clamped))}
            disabled={busy !== null}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <p className="genesis-borrow-scale">
          <span>0</span>
          <span>
            {formatTokenAmountGrouped(maxPrincipal, 18, 0)} · {maxLtv.toFixed(0)}% max
          </span>
        </p>
        <label className="ui-field">
          Or enter an exact amount
          <input
            inputMode="decimal"
            value={amount}
            placeholder="0"
            disabled={busy !== null}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
      </div>

      <RecoveryTimeline
        openedAt={now}
        maturity={now + CREDIT_TERM_SECONDS}
        recoverableAt={now + CREDIT_TERM_SECONDS + RECOVERY_GRACE_SECONDS}
        now={null}
      />

      <p className="genesis-note is-warning">
        <b>Miss the deadline and you lose the NFT.</b> One hour after maturity anyone can recover it
        for an incentive. You would keep the residual value rather than the{" "}
        {formatTokenAmountGrouped(backing, 18, 0)} STATICS backing.
      </p>

      <button
        className="ui-button ui-button--primary ui-button--block"
        type="button"
        disabled={busy !== null || clamped <= 0n}
        onClick={() =>
          void act("open", async () => {
            if (!publicClient) return;
            if (clamped <= 0n || clamped > maxPrincipal) {
              throw new Error("Choose an amount within this Genesis credit limit.");
            }
            const quote = (await publicClient.readContract({
              address: deployment.contracts.vault,
              abi: staticsGenesisCreditAbi,
              functionName: "quoteGenesisCredit",
              args: [clamped],
            })) as GenesisCreditQuote;
            const transaction = buildOpenGenesisCreditTransaction(
              genesisId,
              clamped,
              quote.totalNativeFee
            );
            await send(
              "open-genesis-credit",
              `Borrow against Operator #${genesisId}`,
              transaction.data,
              `${formatEther(clamped)} STATICS + ${formatEther(quote.totalNativeFee)} ETH fee`,
              transaction.value
            );
            setAmount("");
          })
        }
      >
        {busy === "open"
          ? "Borrowing…"
          : `Borrow ${formatTokenAmountGrouped(clamped, 18, 0)} STATICS`}
      </button>

      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
