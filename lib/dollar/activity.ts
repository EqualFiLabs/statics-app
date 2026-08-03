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
  | "borrow-loan"
  | "repay-loan"
  | "extend-loan"
  | "recover-loan";

/** Wall clock for an activity record. Impure, so it stays out of components. */
export function activityTimestamp(): number {
  return Date.now();
}

export type DollarActivity = Readonly<{
  id: string;
  wallet: Address;
  chainId: number;
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

function storageKey(wallet: Address, chainId: number): string {
  return `statics:protocol:activity:${chainId}:${wallet.toLowerCase()}`;
}

function legacyStorageKey(wallet: Address, chainId: number): string {
  return `statics:dollar:activity:${chainId}:${wallet.toLowerCase()}`;
}

export function readDollarActivity(wallet: Address, chainId: number): DollarActivity[] {
  if (typeof window === "undefined") return [];
  const key = storageKey(wallet, chainId);
  const protocolRaw = window.localStorage.getItem(key) || "[]";
  const legacyRaw = window.localStorage.getItem(legacyStorageKey(wallet, chainId)) || "[]";
  const raw = `${protocolRaw}\n${legacyRaw}`;
  const cached = activityCache.get(key);
  if (cached?.raw === raw) return cached.value;
  try {
    const parsed: unknown[] = [JSON.parse(protocolRaw), JSON.parse(legacyRaw)];
    const value = parsed
      .flatMap((items) => (Array.isArray(items) ? items : []))
      .filter(
        (item): item is DollarActivity =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as DollarActivity).id === "string" &&
          typeof (item as DollarActivity).wallet === "string" &&
          Number.isInteger((item as DollarActivity).chainId) &&
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

/**
 * Every chain this wallet has a stored record on.
 *
 * Activity is written per chain, so reading it back needs a list of chains to
 * look in. Deriving that list from the wallet's configured networks means a
 * record written on a network that was later removed -- or one the person is
 * simply not connected to right now -- silently disappears. The keys already
 * name the chain, so the honest source of that list is storage itself.
 */
export function readActivityChainIds(wallet: Address): number[] {
  if (typeof window === "undefined") return [];
  const owner = wallet.toLowerCase();
  const found = new Set<number>();
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.endsWith(`:${owner}`)) continue;
    const match = /^statics:(?:protocol|dollar):activity:(\d+):/.exec(key);
    const chainId = match ? Number(match[1]) : Number.NaN;
    if (Number.isSafeInteger(chainId)) found.add(chainId);
  }
  return [...found];
}

export function readProtocolActivityAcrossChains(
  wallet: Address,
  chainIds: readonly number[]
): DollarActivity[] {
  const uniqueChainIds = [...new Set(chainIds.filter(Number.isSafeInteger))].sort(
    (left, right) => left - right
  );
  const key = `${wallet.toLowerCase()}:${uniqueChainIds.join(",")}`;
  const sources = uniqueChainIds.map((chainId) => readDollarActivity(wallet, chainId));
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
  const current = readDollarActivity(activity.wallet, activity.chainId);
  const next = [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 50);
  window.localStorage.setItem(storageKey(activity.wallet, activity.chainId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(activityEvent));
}

export function updateDollarActivity(
  wallet: Address,
  chainId: number,
  id: string,
  update: Partial<DollarActivity>
): void {
  const current = readDollarActivity(wallet, chainId);
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
