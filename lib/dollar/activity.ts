"use client";

import type { Address, Hex } from "viem";

export type DollarActivityStatus =
  | "simulating"
  | "signing"
  | "submitted"
  | "confirmed"
  | "rejected"
  | "reverted"
  | "replaced"
  | "failed";
export type DollarReplacementReason = "repriced" | "replaced" | "cancelled";
export type DollarActivityKind =
  | "approve-weth"
  | "approve-dollar"
  | "approve-risk"
  | "revoke-risk"
  | "deposit-eth"
  | "deposit-weth"
  | "recombine-eth"
  | "recombine-weth";

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

const activityEvent = "statics-dollar-activity";
const activityCache = new Map<string, { raw: string; value: DollarActivity[] }>();
const activityStatuses = new Set<DollarActivityStatus>([
  "simulating",
  "signing",
  "submitted",
  "confirmed",
  "rejected",
  "reverted",
  "replaced",
  "failed",
]);

function storageKey(wallet: Address, chainId: number): string {
  return `statics:dollar:activity:${chainId}:${wallet.toLowerCase()}`;
}

export function readDollarActivity(wallet: Address, chainId: number): DollarActivity[] {
  if (typeof window === "undefined") return [];
  const key = storageKey(wallet, chainId);
  const raw = window.localStorage.getItem(key) || "[]";
  const cached = activityCache.get(key);
  if (cached?.raw === raw) return cached.value;
  try {
    const parsed: unknown = JSON.parse(raw);
    const value = Array.isArray(parsed)
      ? parsed.filter(
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
      : [];
    activityCache.set(key, { raw, value });
    return value;
  } catch {
    return [];
  }
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
