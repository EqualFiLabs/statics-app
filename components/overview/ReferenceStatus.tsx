"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PriceReference } from "@/lib/market/reference-prices";

export function ReferenceStatus({
  references = [],
  historical = false,
}: {
  references?: readonly PriceReference[];
  historical?: boolean;
}) {
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
    const stale =
      r.stale ||
      (r.freshUntil !== undefined && now >= r.freshUntil) ||
      now - Math.min(r.fetchedAt, r.observedAt) >= (r.source === "coinbase" ? 60_000 : 30_000);
    const labels =
      now >= r.expiresAt
        ? ["referenceExpired"]
        : [r.halted ? "referenceHalted" : null, stale ? "referenceStale" : null];
    for (const label of labels) {
      if (label) statuses.set(label, [...(statuses.get(label) ?? []), r]);
    }
  }
  if (!historical && statuses.size === 0) return null;
  return (
    <div role="note" title={references.map(details).join("\n")}>
      {historical && (
        <p>
          {t("referenceCurrent")} {t("referenceHistory")}
        </p>
      )}
      {[...statuses].map(([label, affected]) => (
        <span key={label} className="ui-pill is-warning" title={affected.map(details).join("\n")}>
          {t(label)}
        </span>
      ))}
    </div>
  );
}
