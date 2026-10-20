"use client";
import { useSyncExternalStore } from "react";

/**
 * Account nicknames live in this browser only: they never reach other devices, other viewers
 * or the chain. Storage can be missing or blocked (private windows, previews), so every read
 * and write tolerates failure and the app falls back to "Account #N".
 */
export const NICKNAME_MAX_LENGTH = 32;
const EVENT = "statics:account-nicknames";
type Nicknames = Readonly<Record<string, string>>;

export function nicknameStorageKey(deploymentId: string, wallet: string) {
  return `statics:account-nicknames:${deploymentId}:${wallet.toLowerCase()}`;
}

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "{}";
  } catch {
    return "{}";
  }
}

export function parseNicknames(raw: string): Nicknames {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          /^\d+$/.test(entry[0]) && typeof entry[1] === "string" && entry[1].trim().length > 0
      )
    );
  } catch {
    return {};
  }
}

/** Trim, collapse whitespace and cap the length; an empty result clears the nickname. */
export function cleanNickname(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX_LENGTH);
}

export function useAccountNicknames(deploymentId: string, wallet: string | null) {
  const key = wallet ? nicknameStorageKey(deploymentId, wallet) : null;
  const raw = useSyncExternalStore(
    (notify) => {
      const onStorage = (event: Event) => {
        if (!(event instanceof StorageEvent) || event.key === key) notify();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(EVENT, notify);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(EVENT, notify);
      };
    },
    () => (key ? read(key) : "{}"),
    () => "{}"
  );
  const nicknames = parseNicknames(raw);
  return {
    nicknames,
    nicknameOf: (positionId: bigint) => nicknames[String(positionId)],
    /** Returns false when the browser would not store it. */
    setNickname: (positionId: bigint, value: string) => {
      if (!key) return false;
      const next: Record<string, string> = { ...nicknames };
      const cleaned = cleanNickname(value);
      if (cleaned) next[String(positionId)] = cleaned;
      else delete next[String(positionId)];
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        return false;
      }
      window.dispatchEvent(new Event(EVENT));
      return true;
    },
  };
}
