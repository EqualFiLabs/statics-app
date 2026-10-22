"use client";

import { useEffect, useState } from "react";
import type { PriceReference } from "@/lib/market/reference-prices";

/** Recheck locally even when an API outage prevents query refreshes. */
export function useReferenceClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function referencesExpired(references: readonly PriceReference[] | undefined, now: number) {
  return references?.some((r) => r.expiresAt <= now) ?? false;
}
