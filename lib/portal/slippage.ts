"use client";

/**
 * Slippage tolerance for every Portal route.
 *
 * Swap, Bridge and Statics Dollar all quote through different providers, but a
 * person setting slippage is expressing one preference about their own price
 * protection -- not three. So this is a single shared value rather than state
 * inside each panel, and it survives switching tabs.
 *
 * Percent is the unit here because that is what a person reads and what the
 * Uniswap and Across routes accept. Jupiter wants basis points, so it converts
 * at the call site.
 *
 * The ceiling is 5%, which is not arbitrary: `/api/uniswap/quote` rejects above
 * 5 and `/api/jupiter/*` rejects above 500bps. Offering more in the dialog would
 * only produce a server rejection after the person had committed to the number.
 */

export const DEFAULT_PORTAL_SLIPPAGE_PERCENT = 0.5;
export const PORTAL_SLIPPAGE_PRESETS = [0.5, 2] as const;
export const MIN_PORTAL_SLIPPAGE_PERCENT = 0.01;
export const MAX_PORTAL_SLIPPAGE_PERCENT = 5;

const storageKey = "statics:portal:slippage";
const storageEvent = "statics-portal-slippage-changed";

export function isValidSlippagePercent(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_PORTAL_SLIPPAGE_PERCENT &&
    value <= MAX_PORTAL_SLIPPAGE_PERCENT
  );
}

/** Returns null rather than a fallback, so the dialog can explain the problem. */
export function parseSlippagePercent(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isValidSlippagePercent(value) ? value : null;
}

export function slippagePercentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function readPortalSlippage(): number {
  if (typeof window === "undefined") return DEFAULT_PORTAL_SLIPPAGE_PERCENT;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return DEFAULT_PORTAL_SLIPPAGE_PERCENT;
  const value = Number(raw);
  // A stored value can be stale or hand-edited, and an out-of-range one would
  // be rejected by the quote route with no way for the person to see why.
  return isValidSlippagePercent(value) ? value : DEFAULT_PORTAL_SLIPPAGE_PERCENT;
}

export function writePortalSlippage(percent: number): void {
  if (typeof window === "undefined" || !isValidSlippagePercent(percent)) return;
  window.localStorage.setItem(storageKey, String(percent));
  window.dispatchEvent(new Event(storageEvent));
}

export function subscribePortalSlippage(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(storageEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(storageEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export function serverSlippageSnapshot(): number {
  return DEFAULT_PORTAL_SLIPPAGE_PERCENT;
}
