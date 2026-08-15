"use client";

import { AMOUNT_SHORTCUTS } from "@/lib/protocol/ux";
import { useTranslations } from "next-intl";

export function AmountShortcuts({
  onSelect,
  disabled = false,
  label = "Amount shortcuts",
}: {
  onSelect: (percent: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslations("common");
  return (
    <div className="protocol-amount-shortcuts" aria-label={label}>
      {AMOUNT_SHORTCUTS.map((percent) => (
        <button key={percent} type="button" disabled={disabled} onClick={() => onSelect(percent)}>
          {percent === 100 ? t("max") : `${percent}%`}
        </button>
      ))}
    </div>
  );
}
