"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { referenceStale, type PriceReference } from "@/lib/market/reference-prices";

export function ReferenceStatus({ references = [] }: { references?: readonly PriceReference[] }) {
  const t = useTranslations("dexOverview");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const details = (r: PriceReference) =>
    `${r.source} · ${r.asset} · ${t("referenceObserved", { time: new Date(r.observedAt).toISOString() })}`;
  const statuses = new Map<string, PriceReference[]>();
  for (const r of references) {
    const stale = referenceStale(r, now);
    const labels =
      now >= r.expiresAt
        ? ["referenceExpired"]
        : [r.halted ? "referenceHalted" : null, stale ? "referenceStale" : null];
    for (const label of labels) {
      if (label) statuses.set(label, [...(statuses.get(label) ?? []), r]);
    }
  }
  if (statuses.size === 0) return null;
  return (
    <div role="note" title={references.map(details).join("\n")}>
      {[...statuses].map(([label, affected]) => (
        <span key={label} className="ui-pill is-warning" title={affected.map(details).join("\n")}>
          {t(label)}
        </span>
      ))}
    </div>
  );
}
