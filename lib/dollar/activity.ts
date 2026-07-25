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
  | "approve-weth"
  | "approve-dollar"
  | "approve-risk"
  | "revoke-risk"
  | "deposit-eth"
  | "deposit-weth"
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
