"use client";

export type BridgeActivityStatus =
  "submitted" | "pending" | "received" | "filled" | "expired" | "refunded" | "failed";

export type BridgeActivity = Readonly<{
  id: string;
  wallet: string;
  originChainId: number;
  destinationChainId: number;
  inputSymbol: string;
  outputSymbol: string;
  amount: string;
  depositTxnRef: string;
  status: BridgeActivityStatus;
  createdAt: number;
  fillTxnRef?: string;
  error?: string;
}>;

const storageKey = "statics:portal:bridge-activity";
const activityEvent = "statics-bridge-activity-changed";
let activityCache: { raw: string; value: BridgeActivity[] } | null = null;
const statuses = new Set<BridgeActivityStatus>([
  "submitted",
  "pending",
  "received",
  "filled",
  "expired",
  "refunded",
  "failed",
]);

export function readBridgeActivity(wallet?: string): BridgeActivity[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey) ?? "[]";
  let all = activityCache?.raw === raw ? activityCache.value : null;
  try {
    if (!all) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      all = parsed
        .filter((item): item is BridgeActivity => {
          if (!item || typeof item !== "object") return false;
          const record = item as Record<string, unknown>;
          return (
            typeof record.id === "string" &&
            typeof record.wallet === "string" &&
            Number.isSafeInteger(record.originChainId) &&
            Number.isSafeInteger(record.destinationChainId) &&
            typeof record.depositTxnRef === "string" &&
            statuses.has(record.status as BridgeActivityStatus)
          );
        })
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 50);
      activityCache = { raw, value: all };
    }
    return wallet ? all.filter((item) => item.wallet.toLowerCase() === wallet.toLowerCase()) : all;
  } catch {
    return [];
  }
}

export function writeBridgeActivity(activity: BridgeActivity) {
  const current = readBridgeActivity();
  const next = [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 50);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(activityEvent));
}

export function updateBridgeActivity(id: string, update: Partial<BridgeActivity>) {
  const current = readBridgeActivity();
  const item = current.find((activity) => activity.id === id);
  if (item) writeBridgeActivity({ ...item, ...update });
}

export function subscribeBridgeActivity(listener: () => void) {
  window.addEventListener(activityEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(activityEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function refreshBridgeActivity(activity: BridgeActivity) {
  if (["filled", "expired", "refunded", "failed"].includes(activity.status)) return activity;
  const response = await fetch(
    `/api/across/status?depositTxnRef=${encodeURIComponent(activity.depositTxnRef)}`,
    { cache: "no-store" }
  );
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok || !payload || typeof payload !== "object") return activity;
  const record = payload as Record<string, unknown>;
  const rawStatus = typeof record.status === "string" ? record.status.toLowerCase() : "";
  const status = statuses.has(rawStatus as BridgeActivityStatus)
    ? (rawStatus as BridgeActivityStatus)
    : activity.status;
  const fillTxnRef = [record.fillTxnRef, record.fillTxHash, record.destinationTxnRef].find(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  const next = { ...activity, status, ...(fillTxnRef ? { fillTxnRef } : {}) };
  updateBridgeActivity(activity.id, next);
  return next;
}
