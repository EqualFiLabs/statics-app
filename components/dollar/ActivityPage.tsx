"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Connection } from "@solana/web3.js";
import { getAddress, isAddress } from "viem";
import { useFormatter, useTranslations } from "next-intl";

import { SurfaceEmptyState } from "@/components/common/EmptyState";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import {
  readProtocolActivityAcrossChains,
  readActivityChainIds,
  subscribeProtocolActivity,
  type ProtocolActivity,
} from "@/lib/dollar/activity";
import { getFundingNetwork } from "@/lib/funding-networks";
import { ACROSS_SOLANA_CHAIN_ID } from "@/lib/portal/across";
import {
  readBridgeActivity,
  refreshBridgeActivity,
  subscribeBridgeActivity,
  type BridgeActivity,
} from "@/lib/portal/bridge-activity";
import { recoverProtocolActivity, recoverSolanaActivity } from "@/lib/portal/activity-recovery";
import {
  readSolanaActivity,
  subscribeSolanaActivity,
  type SolanaActivity,
} from "@/lib/portal/solana-activity";
import { SOLANA_MAINNET_RPC_URL } from "@/lib/solana-wallet";
import {
  anvil,
  getTransactionExplorerUrl,
  robinhoodMainnet,
  robinhoodTestnet,
} from "@/lib/wallet-config";
import { useSolanaWalletState } from "@/providers/solana-context";
import { useWalletState } from "@/providers/wallet-context";
import { useDeployment } from "@/providers/deployment-context";

const emptyProtocolActivity: ProtocolActivity[] = [];
const emptyBridgeActivity: BridgeActivity[] = [];
const emptySolanaActivity: SolanaActivity[] = [];

type UnifiedActivity = Readonly<{
  id: string;
  label: string;
  amount: string;
  network: string;
  status: string;
  statusClass: string;
  createdAt: number;
  reference?: string;
  explorerUrl?: string | null;
  originalReference?: string;
  error?: string;
}>;

function protocolStatus(activity: ProtocolActivity): string {
  if (activity.status === "simulating") return "Simulating";
  if (activity.status === "signing") return "Awaiting signature";
  if (activity.status === "submitted") return "Confirming";
  if (activity.status === "confirmed") {
    return activity.replacementReason === "repriced" ? "Confirmed · repriced" : "Confirmed";
  }
  if (activity.status === "confirmed-unverified") return "Confirmed · refresh required";
  if (activity.status === "rejected") return "Rejected";
  if (activity.status === "reverted") return "Reverted";
  if (activity.status === "replaced") {
    return activity.replacementReason === "cancelled" ? "Cancelled" : "Replaced";
  }
  return "Failed";
}

function chainName(chainId: number): string {
  if (chainId === ACROSS_SOLANA_CHAIN_ID) return "Solana";
  if (chainId === robinhoodMainnet.id) return robinhoodMainnet.name;
  if (chainId === robinhoodTestnet.id) return robinhoodTestnet.name;
  if (chainId === anvil.id) return anvil.name;
  return getFundingNetwork(chainId)?.label ?? `Chain ${chainId}`;
}

function evmExplorerUrl(chainId: number, hash: string): string | null {
  const known = getTransactionExplorerUrl(chainId, hash);
  if (known) return known;
  const explorer = getFundingNetwork(chainId)?.chain.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${hash}` : null;
}

/**
 * A transaction hash with no explorer behind it.
 *
 * Chains without a block explorer -- local Anvil above all -- have nothing to
 * link to, so the hash rendered as inert text and there was no way to get at
 * it: the full value only existed in a tooltip. Copying is the thing anyone
 * actually wants with a hash they cannot open.
 */
function CopyableReference({
  reference,
  label,
}: {
  reference: string;
  // Derived from the reference, so non-null whenever this renders, but the
  // compiler cannot see the two are tied together.
  label: string | null;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="activity-hash is-copy"
      type="button"
      // Content reads as "0x1111…1111Copy", which is not a usable name. The
      // label states the action and the full hash instead.
      aria-label={`Copy transaction ${reference}`}
      title={reference}
      onClick={() => {
        void navigator.clipboard?.writeText(reference).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          },
          () => undefined
        );
      }}
    >
      <code>{label}</code>
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function protocolItem(activity: ProtocolActivity): UnifiedActivity {
  const reference = activity.confirmedHash ?? activity.replacementHash ?? activity.hash;
  return {
    id: `protocol:${activity.id}`,
    label: activity.label,
    amount: activity.amount,
    network: chainName(activity.chainId),
    status: protocolStatus(activity),
    statusClass: activity.status,
    createdAt: activity.createdAt,
    reference,
    explorerUrl: reference ? evmExplorerUrl(activity.chainId, reference) : null,
    originalReference: activity.replacementHash && activity.hash ? activity.hash : undefined,
    error: activity.error,
  };
}

function bridgeItem(activity: BridgeActivity): UnifiedActivity {
  const confirmed = activity.status === "filled";
  const failed = ["expired", "refunded", "failed"].includes(activity.status);
  const reference = activity.fillTxnRef ?? activity.depositTxnRef;
  const referenceChainId = activity.fillTxnRef
    ? activity.destinationChainId
    : activity.originChainId;
  return {
    id: `bridge:${activity.id}`,
    label: `Bridge ${activity.inputSymbol} to ${activity.outputSymbol}`,
    amount: `${activity.amount} ${activity.inputSymbol}`,
    network: `${chainName(activity.originChainId)} → ${chainName(activity.destinationChainId)}`,
    status:
      activity.status === "pending"
        ? "Confirming"
        : activity.status.charAt(0).toUpperCase() + activity.status.slice(1),
    statusClass: confirmed ? "confirmed" : failed ? "failed" : "submitted",
    createdAt: activity.createdAt,
    reference,
    explorerUrl:
      referenceChainId === ACROSS_SOLANA_CHAIN_ID
        ? `https://solscan.io/tx/${reference}`
        : evmExplorerUrl(referenceChainId, reference),
    originalReference: activity.fillTxnRef ? activity.depositTxnRef : undefined,
    error: activity.error,
  };
}

function solanaItem(activity: SolanaActivity): UnifiedActivity {
  return {
    id: `solana:${activity.id}`,
    label: activity.label,
    amount: activity.amount,
    network: "Solana",
    status:
      activity.status === "signing"
        ? "Awaiting signature"
        : activity.status === "submitted"
          ? "Confirming"
          : activity.status === "confirmed"
            ? "Confirmed"
            : "Failed",
    statusClass: activity.status,
    createdAt: activity.createdAt,
    reference: activity.signature,
    explorerUrl: activity.signature ? `https://solscan.io/tx/${activity.signature}` : null,
    error: activity.error,
  };
}

export function ActivityPage() {
  const t = useTranslations("activity");
  const wallet = useWalletState();
  const { active } = useDeployment();
  const solana = useSolanaWalletState();
  const evmAddress =
    wallet.address && isAddress(wallet.address) ? getAddress(wallet.address) : null;
  const solanaAddress = solana.wallets[0]?.address ?? null;
  const chainIds = useMemo(
    () => [
      ...new Set([
        wallet.targetChainId,
        ...(wallet.chainId ? [wallet.chainId] : []),
        ...wallet.fundingNetworks.map((network) => network.chainId),
      ]),
    ],
    [wallet.chainId, wallet.fundingNetworks, wallet.targetChainId]
  );
  const protocolActivity = useSyncExternalStore(
    subscribeProtocolActivity,
    () =>
      evmAddress
        ? readProtocolActivityAcrossChains(
            evmAddress,
            [...chainIds, ...readActivityChainIds(evmAddress, active.descriptor.deploymentId)],
            active.descriptor.deploymentId
          )
        : emptyProtocolActivity,
    () => emptyProtocolActivity
  );
  const allBridgeActivity = useSyncExternalStore(
    subscribeBridgeActivity,
    () => readBridgeActivity(),
    () => emptyBridgeActivity
  );
  const allSolanaActivity = useSyncExternalStore(
    subscribeSolanaActivity,
    () => readSolanaActivity(),
    () => emptySolanaActivity
  );
  const solanaActivity = useMemo(
    () =>
      solanaAddress
        ? allSolanaActivity.filter((activity) => activity.wallet === solanaAddress)
        : emptySolanaActivity,
    [allSolanaActivity, solanaAddress]
  );
  const bridgeActivity = useMemo(() => {
    const identities = new Set(
      [evmAddress?.toLowerCase(), solanaAddress].filter((identity): identity is string =>
        Boolean(identity)
      )
    );
    return allBridgeActivity.filter((activity) =>
      identities.has(
        activity.originChainId === ACROSS_SOLANA_CHAIN_ID
          ? activity.wallet
          : activity.wallet.toLowerCase()
      )
    );
  }, [allBridgeActivity, evmAddress, solanaAddress]);
  const activity = useMemo(
    () =>
      [
        ...protocolActivity.map(protocolItem),
        ...bridgeActivity.map(bridgeItem),
        ...solanaActivity.map(solanaItem),
      ]
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 100),
    [bridgeActivity, protocolActivity, solanaActivity]
  );

  useEffect(() => {
    for (const item of protocolActivity) void recoverProtocolActivity(item);
  }, [protocolActivity]);

  useEffect(() => {
    if (!solanaAddress) return;
    const connection = new Connection(SOLANA_MAINNET_RPC_URL, "confirmed");
    for (const item of solanaActivity) void recoverSolanaActivity(item, connection);
  }, [solanaActivity, solanaAddress]);

  useEffect(() => {
    const identities = new Set(
      [evmAddress?.toLowerCase(), solanaAddress].filter((identity): identity is string =>
        Boolean(identity)
      )
    );
    if (identities.size === 0) return;
    const refresh = () => {
      for (const item of readBridgeActivity()) {
        const identity =
          item.originChainId === ACROSS_SOLANA_CHAIN_ID ? item.wallet : item.wallet.toLowerCase();
        if (
          identities.has(identity) &&
          ["submitted", "pending", "received"].includes(item.status)
        ) {
          void refreshBridgeActivity(item);
        }
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(interval);
  }, [evmAddress, solanaAddress]);

  // Activity is assembled from local records rather than a single query, so
  // there is no read to be loading or failing -- only "who are you" and
  // "have you done anything yet".
  const activityState = deriveSurfaceState({
    walletStatus: wallet.status,
    // Not network-scoped. Every row already names the chain it happened on, and
    // the point of this page is seeing a bridge that started somewhere else --
    // gating it on the connected network hides exactly what it exists to show.
    isTargetChain: true,
    isLoading: false,
    isError: false,
    isEmpty: activity.length === 0,
    hasData: true,
  });

  return (
    <section className="activity-panel" aria-labelledby="activity-title">
      <div>
        <p className="dapp-section-label">
          {"// "}
          {t("label")}
        </p>
        <h2 id="activity-title">{t("transactions")}</h2>
      </div>
      {!isSurfaceReady(activityState) ? (
        <SurfaceEmptyState
          state={activityState}
          subject={t("subject")}
          empty={{
            title: t("emptyTitle"),
            description: t("emptyDescription"),
            action: { label: t("getDollar"), href: "/app/dollar" },
            secondary: { label: t("addFunds"), href: "/app/portal" },
          }}
        />
      ) : (
        <ol>
          {activity.map((item) => (
            <ActivityItem key={item.id} activity={item} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityItem({ activity }: { activity: UnifiedActivity }) {
  const format = useFormatter();
  const t = useTranslations("activity");
  const referenceLabel = activity.reference
    ? `${activity.reference.slice(0, 10)}…${activity.reference.slice(-8)}`
    : null;

  return (
    <li>
      <div>
        <strong>{activity.label}</strong>
        <span>
          {activity.amount} · {activity.network}
        </span>
      </div>
      <div>
        <strong className={`activity-status is-${activity.statusClass}`}>{activity.status}</strong>
        <time dateTime={new Date(activity.createdAt).toISOString()}>
          {format.dateTime(new Date(activity.createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
      </div>
      {activity.reference &&
        (activity.explorerUrl ? (
          <a
            className="activity-hash"
            href={activity.explorerUrl}
            target="_blank"
            rel="noreferrer"
            title={activity.reference}
          >
            {referenceLabel} ↗
          </a>
        ) : (
          <CopyableReference reference={activity.reference} label={referenceLabel} />
        ))}
      {activity.originalReference && (
        <p>
          {t("originalTransaction", {
            reference: `${activity.originalReference.slice(0, 10)}…${activity.originalReference.slice(-8)}`,
          })}
        </p>
      )}
      {activity.error && <p>{activity.error}</p>}
    </li>
  );
}
