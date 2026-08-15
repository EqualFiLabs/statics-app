"use client";

import { useState, useSyncExternalStore } from "react";

import {
  SlippageInlineControl,
  SlippageSettingsDialog,
} from "@/components/portal/SlippageSettingsDialog";
import {
  readPortalSlippage,
  serverSlippageSnapshot,
  subscribePortalSlippage,
  writePortalSlippage,
} from "@/lib/portal/slippage";

export function useProtocolSlippage(): number {
  return useSyncExternalStore(subscribePortalSlippage, readPortalSlippage, serverSlippageSnapshot);
}

export function ProtocolSlippageControl() {
  const value = useProtocolSlippage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <SlippageInlineControl value={value} onEdit={() => setOpen(true)} />
      {open && (
        <SlippageSettingsDialog
          value={value}
          onApply={writePortalSlippage}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
