"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PriceReference } from "@/lib/market/reference-prices";

export function ReferenceStatus({
  references = [],
  historical = false,
  compact = false,
}: {
  references?: readonly PriceReference[];
  historical?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("dexOverview");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div role="note">
      {historical && (
        <p>
          {t("referenceCurrent")} {t("referenceHistory")}
        </p>
      )}
      {references.map((r) => {
        const stale =
          r.stale ||
          (r.freshUntil !== undefined && now >= r.freshUntil) ||
          now - Math.min(r.fetchedAt, r.observedAt) >= (r.source === "coinbase" ? 60_000 : 30_000);
        const label =
          now >= r.expiresAt
            ? "referenceExpired"
            : r.halted
              ? "referenceHalted"
              : stale
                ? "referenceStale"
                : "referenceFresh";
        if (compact && label === "referenceFresh") return null;
        const time = new Date(r.observedAt).toISOString();
        return (
          <small
            key={`${r.source}:${r.asset}`}
            title={`${r.asset} · ${t("referenceObserved", { time })}`}
          >
            {r.source} · {t(label)}
            {r.halted && stale && label !== "referenceExpired"
              ? ` · ${t("referenceStale")}`
              : ""} · <time dateTime={time}>{time}</time>{" "}
          </small>
        );
      })}
    </div>
  );
}
