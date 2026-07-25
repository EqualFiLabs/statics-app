"use client";

export type SolanaActivityStatus = "signing" | "submitted" | "confirmed" | "failed";
export type SolanaActivityKind = "send" | "swap";

export type SolanaActivity = Readonly<{
  id: string;
  wallet: string;
  kind: SolanaActivityKind;
  label: string;
  amount: string;
  status: SolanaActivityStatus;
  createdAt: number;
  signature?: string;
  error?: string;
}>;

const storageKey = "statics:solana:activity";
const activityEvent = "statics-solana-activity-changed";
const statuses = new Set<SolanaActivityStatus>(["signing", "submitted", "confirmed", "failed"]);
let activityCache: { raw: string; value: SolanaActivity[] } | null = null;

export function readSolanaActivity(wallet?: string): SolanaActivity[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey) ?? "[]";
  let all = activityCache?.raw === raw ? activityCache.value : null;
  try {
    if (!all) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      all = parsed
        .filter((item): item is SolanaActivity => {
          if (!item || typeof item !== "object") return false;
          const record = item as Record<string, unknown>;
          return (
            typeof record.id === "string" &&
            typeof record.wallet === "string" &&
            (record.kind === "send" || record.kind === "swap") &&
            typeof record.label === "string" &&
            typeof record.amount === "string" &&
            statuses.has(record.status as SolanaActivityStatus) &&
            Number.isFinite(record.createdAt)
          );
        })
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 50);
      activityCache = { raw, value: all };
    }
    return wallet ? all.filter((item) => item.wallet === wallet) : all;
  } catch {
    return [];
  }
}

export function writeSolanaActivity(activity: SolanaActivity) {
  const current = readSolanaActivity();
  const next = [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 50);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(activityEvent));
}

export function updateSolanaActivity(id: string, update: Partial<SolanaActivity>) {
  const current = readSolanaActivity();
  const item = current.find((activity) => activity.id === id);
  if (item) writeSolanaActivity({ ...item, ...update });
}

export function subscribeSolanaActivity(listener: () => void) {
  window.addEventListener(activityEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(activityEvent, listener);
    window.removeEventListener("storage", listener);
  };
}
