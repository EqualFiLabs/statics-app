"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";

export function GenesisActionModal({
  label,
  title = label,
  busy = false,
  children,
}: {
  label: string;
  title?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="genesis-tools">
      <button
        type="button"
        className="ui-button ui-button--secondary ui-button--sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <ReviewDrawer
          title={title}
          variant="modal"
          className="genesis-action-modal"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <div className="genesis-modal-content">{children}</div>
        </ReviewDrawer>
      )}
    </div>
  );
}
