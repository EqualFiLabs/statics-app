"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
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

type CreditErrorCopy = Readonly<{
  walletRejected: string;
  afterEpoch: string;
  paused: string;
  expired: string;
  notRecoverable: string;
  transactionFailed: string;
}>;

function describeCreditError(error: unknown, copy: CreditErrorCopy): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return copy.walletRejected;
  if (message.includes("CreditUnavailableDuringEpoch")) return copy.afterEpoch;
  if (message.includes("CreditOriginationsPaused")) return copy.paused;
  if (message.includes("CreditExpired")) return copy.expired;
  if (message.includes("CreditNotRecoverable")) return copy.notRecoverable;
  return message || copy.transactionFailed;
}

function formatTimestamp(timestamp: number, locale: string): string {
  if (timestamp === 0) return "—";
  return new Date(timestamp * 1000).toLocaleString(locale);
}

/** "6d 04h", or "1h 12m" once it is close enough that days stop being useful. */
function formatCountdown(
  seconds: number,
  labels: Readonly<{ now: string; day: string; hour: string; minute: string }>
): string {
  if (seconds <= 0) return labels.now;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}${labels.day} ${String(hours).padStart(2, "0")}${labels.hour}`;
  if (hours > 0)
    return `${hours}${labels.hour} ${String(minutes).padStart(2, "0")}${labels.minute}`;
  return `${minutes}${labels.minute}`;
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
  const t = useTranslations("operators.creditPanel");
  const locale = useLocale();
  // A tail past the recovery point keeps the danger band visible rather than
  // collapsing it to a hairline at the right edge.
  const tail = Math.round(CREDIT_TERM_SECONDS * 0.18);
  const span = Math.max(1, recoverableAt + tail - openedAt);
  const pct = (from: number, to: number) => ((to - from) / span) * 100;
  const nowPct =
    now === null ? null : Math.min(99.6, Math.max(0, pct(openedAt, Math.max(now, openedAt))));

  return (
    <div className="genesis-timeline">
      <p className="dapp-eyebrow">{now === null ? t("beforeBorrow") : t("ifNotRepaid")}</p>
      <div className="genesis-timeline-track">
        <span
          className="genesis-timeline-segment is-safe"
          style={{ left: 0, width: `${pct(openedAt, maturity)}%` }}
        >
          {t("term")}
        </span>
        <span
          className="genesis-timeline-segment is-grace"
          style={{
            left: `${pct(openedAt, maturity)}%`,
            width: `${pct(maturity, recoverableAt)}%`,
          }}
        >
          {t("grace")}
        </span>
        <span
          className="genesis-timeline-segment is-danger"
          style={{
            left: `${pct(openedAt, recoverableAt)}%`,
            width: `${100 - pct(openedAt, recoverableAt)}%`,
          }}
        >
          {t("recoverable")}
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
        <span>{now === null ? t("today") : t("opened")}</span>
        <span>
          {t("maturityDate", { date: new Date(maturity * 1_000).toLocaleDateString(locale) })}
        </span>
        <span>{t("anyoneRecover")}</span>
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
  const t = useTranslations("operators.creditPanel");
  const locale = useLocale();
  const countdownLabels = {
    now: t("now"),
    day: t("dayUnit"),
    hour: t("hourUnit"),
    minute: t("minuteUnit"),
  };
  const errorCopy: CreditErrorCopy = {
    walletRejected: t("walletRejected"),
    afterEpoch: t("afterEpoch"),
    paused: t("paused"),
    expired: t("expired"),
    notRecoverable: t("notRecoverable"),
    transactionFailed: t("transactionFailed"),
  };
  const describeTransactionError = (cause: unknown) => describeCreditError(cause, errorCopy);
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
      if (!publicClient || !wallet) throw new Error(t("connect"));
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
      describeError: describeTransactionError,
    });
  };

  const act = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      if (!publicClient || !wallet || !walletState.isTargetChain) return;
      await verifyLaunchDeployment(publicClient, deployment);
      await action();
      await refresh();
    } catch (cause) {
      setError(describeTransactionError(cause));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!wallet || state.isLoading || now === null) {
    return <p className="dapp-loading">{t("loading")}</p>;
  }
  if (state.error || !state.data) {
    return <p className="dapp-inline-error">{describeTransactionError(state.error)}</p>;
  }

  const credit = state.data.credit;
  const maxPrincipal = state.data.limit;
  const backing = state.data.vaultPrice;

  if (credit.active) {
    const openedAt = credit.maturity - CREDIT_TERM_SECONDS;
    const untilMaturity = credit.maturity - now;
    const untilRecoverable = credit.recoverableAt - now;
    const overdue = untilMaturity <= 0;

    return (
      <section
        className="ui-card genesis-panel"
        aria-label={t("aria", { id: genesisId.toString() })}
      >
        <div className="genesis-panel-head">
          <h3>{t("active")}</h3>
          <p>{t("activeDescription")}</p>
        </div>

        <dl className="genesis-figures">
          <div>
            <dt>{t("principal")}</dt>
            <dd>{formatTokenAmountGrouped(credit.principal, 18, 0)} STATICS</dd>
          </div>
          <div>
            <dt>{t("againstBacking")}</dt>
            <dd>
              {formatTokenAmountGrouped(backing, 18, 0)} STATICS
              {backing > 0n ? ` · ${Number((credit.principal * 100n) / backing)}% LTV` : ""}
            </dd>
          </div>
          <div className="is-total">
            <dt>{overdue ? t("recoverableIn") : t("repayWithin")}</dt>
            <dd>{formatCountdown(overdue ? untilRecoverable : untilMaturity, countdownLabels)}</dd>
          </div>
        </dl>

        <RecoveryTimeline
          openedAt={openedAt}
          maturity={credit.maturity}
          recoverableAt={credit.recoverableAt}
          now={now}
        />

        <p className={`genesis-note ${overdue ? "is-error" : "is-warning"}`}>
          {t.rich("recoveryWarning", { strong: (chunks) => <b>{chunks}</b> })}
        </p>

        <dl className="genesis-figures">
          <div>
            <dt>{t("matures")}</dt>
            <dd>{formatTimestamp(credit.maturity, locale)}</dd>
          </div>
          <div>
            <dt>{t("recoverableFrom")}</dt>
            <dd>{formatTimestamp(credit.recoverableAt, locale)}</dd>
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
                  t("extendLabel", { id: genesisId.toString() }),
                  transaction.data,
                  t("ethFee", { amount: formatEther(quote.totalNativeFee) }),
                  transaction.value
                );
              })
            }
          >
            {busy === "extend" ? t("extending") : t("extend")}
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
                    label: t("enableRepayment"),
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
                await send(
                  "repay-genesis-credit",
                  t("repayLabel", { id: genesisId.toString() }),
                  buildRepayGenesisCreditCall(genesisId),
                  `${formatEther(credit.principal)} STATICS`
                );
              })
            }
          >
            {busy === "repay"
              ? t("repaying")
              : t("repay", { amount: formatTokenAmountGrouped(credit.principal, 18, 0) })}
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
        aria-label={t("aria", { id: genesisId.toString() })}
      >
        <div className="genesis-panel-head">
          <h3>{t("title")}</h3>
          <p>{t("opensDescription")}</p>
        </div>
        <div className="genesis-locked">
          <strong>{formatCountdown(state.data.genesisEpochEnd - now, countdownLabels)}</strong>
          <p>
            {t("epochEnds", {
              date: formatTimestamp(state.data.genesisEpochEnd, locale),
              amount: formatTokenAmountGrouped(GENESIS_MAX_CREDIT_PRINCIPAL, 18, 0),
            })}
          </p>
        </div>
      </section>
    );
  }

  if (state.data.originationsPaused) {
    return (
      <section
        className="ui-card genesis-panel"
        aria-label={t("aria", { id: genesisId.toString() })}
      >
        <div className="genesis-panel-head">
          <h3>{t("title")}</h3>
          <p>{t("pausedDescription")}</p>
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
    <section className="ui-card genesis-panel" aria-label={t("aria", { id: genesisId.toString() })}>
      <div className="genesis-panel-head">
        <h3>{t("borrowTitle")}</h3>
        <p>{t("borrowDescription")}</p>
      </div>

      <div className="genesis-borrow">
        <p className="genesis-borrow-amount">
          <b>{formatTokenAmountGrouped(clamped, 18, 2)}</b>
          <span>{t("ltv", { ltv: ltv.toFixed(0) })}</span>
        </p>
        <label className="ui-field">
          <span className="sr-only">{t("amount")}</span>
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
            {t("maximum", {
              amount: formatTokenAmountGrouped(maxPrincipal, 18, 0),
              ltv: maxLtv.toFixed(0),
            })}
          </span>
        </p>
        <label className="ui-field">
          {t("exactAmount")}
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
        {t.rich("deadlineWarning", {
          strong: (chunks) => <b>{chunks}</b>,
          backing: formatTokenAmountGrouped(backing, 18, 0),
        })}
      </p>

      <button
        className="ui-button ui-button--primary ui-button--block"
        type="button"
        disabled={busy !== null || clamped <= 0n}
        onClick={() =>
          void act("open", async () => {
            if (!publicClient) return;
            if (clamped <= 0n || clamped > maxPrincipal) {
              throw new Error(t("chooseAmount"));
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
              t("borrowLabel", { id: genesisId.toString() }),
              transaction.data,
              `${formatEther(clamped)} STATICS + ${formatEther(quote.totalNativeFee)} ETH fee`,
              transaction.value
            );
            setAmount("");
          })
        }
      >
        {busy === "open"
          ? t("borrowing")
          : t("borrow", { amount: formatTokenAmountGrouped(clamped, 18, 2) })}
      </button>

      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
