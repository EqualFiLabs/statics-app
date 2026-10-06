"use client";

import type { Address, Hex } from "viem";

export type DollarActivityStatus =
  | "simulating"
  | "signing"
  | "submitted"
  | "confirmed"
  | "confirmed-unverified"
  | "rejected"
  | "reverted"
  | "replaced"
  | "failed";
export type DollarReplacementReason = "repriced" | "replaced" | "cancelled";
export type DollarActivityKind =
  | "send"
  | "approve-swap"
  | "swap"
  | "approve-bridge"
  | "bridge"
  | "approve-pegged-collateral"
  | "mint-pegged"
  | "redeem-pegged"
  | "claim-testnet-fixtures"
  | "approve-weth"
  | "approve-dollar"
  | "approve-risk"
  | "revoke-risk"
  | "deposit-eth"
  | "deposit-weth"
  | "redeem-eth"
  | "redeem-weth"
  | "supply-risk"
  | "withdraw-risk"
  | "claim-risk-proceeds"
  | "recombine-eth"
  | "recombine-weth"
  | "approve-basket-asset"
  | "mint-basket"
  | "redeem-basket"
  | "create-position"
  | "close-position"
  | "approve-basket-token"
  | "deposit-basket-collateral"
  | "mint-basket-collateral"
  | "withdraw-basket-collateral"
  | "redeem-basket-collateral"
  | "approve-staking-token"
  | "create-and-stake"
  | "stake-position"
  | "unstake-position"
  | "opt-in-reward-assets"
  | "opt-out-reward-assets"
  | "claim-rewards"
  | "accrue-genesis-rewards"
  | "claim-basket-rewards"
  | "transfer-nft"
  | "create-basket"
  | "approve-lp-token"
  | "approve-permit2"
  | "approve-lp-nft"
  | "create-lp-nft"
  | "stake-lp-nft"
  | "activate-lp-nft"
  | "increase-lp-nft"
  | "claim-lp-rewards"
  | "unstake-lp-nft"
  | "borrow-liquidity"
  | "approve-loan-asset"
  | "set-app-approval"
  | "revoke-app-approval"
  | "borrow-loan"
  | "repay-loan"
  | "extend-loan"
  | "recover-loan"
  | "checkpoint-rewards"
  | "activate-genesis"
  | "buy-genesis"
  | "approve-genesis"
  | "redeem-genesis"
  | "open-genesis-credit"
  | "extend-genesis-credit"
  | "repay-genesis-credit"
  | "recover-genesis-credit"
  | "link-genesis"
  | "unlink-genesis"
  | "claim-creator-revenue"
  | "distribute-partner-revenue"
  | "phase-one-approve-token"
  | "phase-one-approve-permit2"
  | "phase-one-swap"
  | "phase-one-close-position"
  | "phase-one-create-position"
  | "phase-one-provide-liquidity"
  | "phase-one-attach-liquidity"
  | "phase-one-increase-liquidity"
  | "phase-one-decrease-liquidity"
  | "phase-one-collect-fees"
  | "phase-one-rebalance-liquidity"
  | "phase-one-exit-liquidity"
  | "phase-one-stake"
  | "phase-one-unstake"
  | "phase-one-reward-selection"
  | "phase-one-claim-global-rewards"
  | "phase-one-claim-batch-rewards"
  | "phase-one-set-allocations"
  | "phase-one-claim-lp-rewards"
  | "phase-one-forfeit-lp-reward"
  | "phase-one-claim-allocator-rewards"
  | "phase-one-forfeit-allocator-reward"
  | "phase-one-checkpoint-schedule"
  | "phase-one-checkpoint-pool"
  | "phase-one-settle-rewards"
  | "phase-one-settle-revenue";

/** Wall clock for an activity record. Impure, so it stays out of components. */
export function activityTimestamp(): number {
  return Date.now();
}

export type DollarActivity = Readonly<{
  id: string;
  wallet: Address;
  chainId: number;
  deploymentId?: string;
  kind: DollarActivityKind;
  label: string;
  amount: string;
  status: DollarActivityStatus;
  createdAt: number;
  hash?: Hex;
  replacementHash?: Hex;
  confirmedHash?: Hex;
  replacementReason?: DollarReplacementReason;
  error?: string;
}>;

const activityEvent = "statics-protocol-activity";
const DEFAULT_ACTIVITY_DEPLOYMENT_ID = "robinhood-testnet-genesis";
const activityCache = new Map<string, { raw: string; value: DollarActivity[] }>();
const aggregateActivityCache = new Map<
  string,
  { sources: DollarActivity[][]; value: DollarActivity[] }
>();
const activityStatuses = new Set<DollarActivityStatus>([
  "simulating",
  "signing",
  "submitted",
  "confirmed",
  "confirmed-unverified",
  "rejected",
  "reverted",
  "replaced",
  "failed",
]);

function storageKey(wallet: Address, chainId: number, deploymentId: string): string {
  return `statics:protocol:activity:${chainId}:${deploymentId}:${wallet.toLowerCase()}`;
}

export function activeActivityDeploymentId(): string {
  return DEFAULT_ACTIVITY_DEPLOYMENT_ID;
}

export function readDollarActivity(
  wallet: Address,
  chainId: number,
  deploymentId = DEFAULT_ACTIVITY_DEPLOYMENT_ID
): DollarActivity[] {
  if (typeof window === "undefined") return [];
  const key = storageKey(wallet, chainId, deploymentId);
  const protocolRaw = window.localStorage.getItem(key) || "[]";
  const raw = protocolRaw;
  const cached = activityCache.get(key);
  if (cached?.raw === raw) return cached.value;
  try {
    const parsed: unknown = JSON.parse(protocolRaw);
    const value = (Array.isArray(parsed) ? parsed : [])
      .filter(
        (item): item is DollarActivity =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as DollarActivity).id === "string" &&
          typeof (item as DollarActivity).wallet === "string" &&
          Number.isInteger((item as DollarActivity).chainId) &&
          (item as DollarActivity).deploymentId === deploymentId &&
          typeof (item as DollarActivity).kind === "string" &&
          typeof (item as DollarActivity).label === "string" &&
          typeof (item as DollarActivity).amount === "string" &&
          activityStatuses.has((item as DollarActivity).status) &&
          Number.isFinite((item as DollarActivity).createdAt)
      )
      .filter(
        (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
      )
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 50);
    activityCache.set(key, { raw, value });
    return value;
  } catch {
    return [];
  }
}

export type ProtocolActivity = DollarActivity;
export type ProtocolActivityKind = DollarActivityKind;
export type ProtocolActivityStatus = DollarActivityStatus;
export type ProtocolReplacementReason = DollarReplacementReason;
export const readProtocolActivity = readDollarActivity;
export const writeProtocolActivity = writeDollarActivity;
export const updateProtocolActivity = updateDollarActivity;
export const subscribeProtocolActivity = subscribeDollarActivity;

export function readActivityChainIds(
  wallet: Address,
  deploymentId = DEFAULT_ACTIVITY_DEPLOYMENT_ID
): number[] {
  if (typeof window === "undefined") return [];
  const owner = wallet.toLowerCase();
  const found = new Set<number>();
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.endsWith(`:${owner}`)) continue;
    const match = /^statics:protocol:activity:(\d+):([^:]+):/.exec(key);
    if (!match || match[2] !== deploymentId) continue;
    const chainId = match ? Number(match[1]) : Number.NaN;
    if (Number.isSafeInteger(chainId)) found.add(chainId);
  }
  return [...found];
}

export function readProtocolActivityAcrossChains(
  wallet: Address,
  chainIds: readonly number[],
  deploymentId = DEFAULT_ACTIVITY_DEPLOYMENT_ID
): DollarActivity[] {
  const uniqueChainIds = [...new Set(chainIds.filter(Number.isSafeInteger))].sort(
    (left, right) => left - right
  );
  const key = `${deploymentId}:${wallet.toLowerCase()}:${uniqueChainIds.join(",")}`;
  const sources = uniqueChainIds.map((chainId) =>
    readDollarActivity(wallet, chainId, deploymentId)
  );
  const cached = aggregateActivityCache.get(key);
  if (
    cached &&
    cached.sources.length === sources.length &&
    cached.sources.every((source, index) => source === sources[index])
  ) {
    return cached.value;
  }
  const value = sources
    .flat()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 100);
  aggregateActivityCache.set(key, { sources, value });
  return value;
}

export function writeDollarActivity(activity: DollarActivity): void {
  const deploymentId = activity.deploymentId ?? activeActivityDeploymentId();
  const normalized = { ...activity, deploymentId };
  const current = readDollarActivity(activity.wallet, activity.chainId, deploymentId);
  const next = [normalized, ...current.filter((item) => item.id !== activity.id)].slice(0, 50);
  window.localStorage.setItem(
    storageKey(activity.wallet, activity.chainId, deploymentId),
    JSON.stringify(next)
  );
  window.dispatchEvent(new CustomEvent(activityEvent));
}

export function updateDollarActivity(
  wallet: Address,
  chainId: number,
  id: string,
  update: Partial<DollarActivity>,
  deploymentId = activeActivityDeploymentId()
): void {
  const current = readDollarActivity(wallet, chainId, deploymentId);
  const existing = current.find((item) => item.id === id);
  if (!existing) return;
  writeDollarActivity({ ...existing, ...update });
}

export function subscribeDollarActivity(listener: () => void): () => void {
  window.addEventListener(activityEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(activityEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

const deploymentsActivityCache = new Map<
  string,
  { sources: DollarActivity[][]; value: DollarActivity[] }
>();
export function readProtocolActivityAcrossDeployments(
  wallet: Address,
  chainIds: readonly number[],
  deploymentIds: readonly string[]
): DollarActivity[] {
  const ids = [...new Set(deploymentIds)].sort();
  const sources = ids.map((id) =>
    readProtocolActivityAcrossChains(wallet, [...chainIds, ...readActivityChainIds(wallet, id)], id)
  );
  const key = `${wallet.toLowerCase()}:${ids.join(",")}:${chainIds.join(",")}`;
  const cached = deploymentsActivityCache.get(key);
  if (
    cached &&
    cached.sources.length === sources.length &&
    cached.sources.every((source, index) => source === sources[index])
  )
    return cached.value;
  const seen = new Set<string>();
  const value = sources
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((entry) => {
      const hash = entry.hash ? `${entry.chainId}:${entry.hash.toLowerCase()}` : null;
      if (seen.has(entry.id) || (hash && seen.has(hash))) return false;
      seen.add(entry.id);
      if (hash) seen.add(hash);
      return true;
    })
    .slice(0, 100);
  deploymentsActivityCache.set(key, { sources, value });
  return value;
}
