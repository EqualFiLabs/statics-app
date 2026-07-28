"use client";

import { useSyncExternalStore } from "react";

import {
  readPortalSlippage,
  serverSlippageSnapshot,
  subscribePortalSlippage,
} from "@/lib/portal/slippage";

/**
 * The Portal's slippage tolerance, shared by every panel.
 *
 * Reading through an external store rather than context means a panel picks up
 * a change made from the header gear without the Portal re-rendering around it,
 * and the value stays put across tab switches.
 */
export function usePortalSlippage(): number {
  return useSyncExternalStore(subscribePortalSlippage, readPortalSlippage, serverSlippageSnapshot);
}
