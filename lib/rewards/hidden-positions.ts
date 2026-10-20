// Hidden positions are a per-wallet display preference kept in this browser only. They never
// change what is claimed, staked, or shown in totals elsewhere in the app.
const storageEvent = "statics:earn-hidden-positions";
// Fallback when storage throws, so hiding still lasts for the visit.
const memory = new Map<string, string[]>();
const memoryOnly = new Set<string>();

function storageKey(deploymentId: string, wallet: string) {
  return `statics:earn:hidden:${deploymentId}:${wallet.toLowerCase()}`;
}

export function readHiddenPositions(deploymentId: string, wallet: string | null): string[] {
  if (typeof window === "undefined" || !wallet) return [];
  const key = storageKey(deploymentId, wallet);
  if (memoryOnly.has(key)) return memory.get(key) ?? [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && /^\d+$/.test(entry))
      : [];
  } catch {
    return memory.get(key) ?? [];
  }
}

export function writeHiddenPositions(
  deploymentId: string,
  wallet: string | null,
  positionIds: readonly string[]
): void {
  if (typeof window === "undefined" || !wallet) return;
  const key = storageKey(deploymentId, wallet),
    unique = [...new Set(positionIds)];
  memory.set(key, unique);
  try {
    window.localStorage.setItem(key, JSON.stringify(unique));
    memoryOnly.delete(key);
  } catch {
    memoryOnly.add(key);
    // Storage can be unavailable (private windows, blocked site data).
  }
  window.dispatchEvent(new Event(storageEvent));
}

export function subscribeHiddenPositions(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(storageEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(storageEvent, listener);
    window.removeEventListener("storage", listener);
  };
}
