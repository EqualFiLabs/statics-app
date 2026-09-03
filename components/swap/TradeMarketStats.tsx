"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";

import { loadMarketSpotOverview } from "@/lib/market/client";
import type { StaticsMarketOverview } from "@/lib/market/types";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";

function wethPrice(value: string | null): string {
  return value === null ? "—" : formatTokenAmountGrouped(BigInt(value), 18, 10);
}

function usd(value: string | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(formatUnits(BigInt(value), 18)));
}

function volumeUsd(data: StaticsMarketOverview): string | null {
  if (data.price.ethUsdWad === null) return null;
  return (
    (BigInt(data.activity24h.wethVolume) * BigInt(data.price.ethUsdWad)) /
    10n ** 18n
  ).toString();
}

export function TradeMarketStats({ deploymentId }: { deploymentId: string }) {
  const t = useTranslations("trade");
  const market = useQuery({
    queryKey: ["market-spot-overview", deploymentId],
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: ({ signal }) => loadMarketSpotOverview(signal),
  });
  const data = market.data;

  return (
    <section
      className="trade-market-stats"
      aria-label={t("marketStats")}
      aria-busy={market.isLoading}
    >
      <div>
        <span>{t("lastPrice")}</span>
        <strong>{data ? wethPrice(data.activity24h.lastWethPerStaticsWad) : "—"}</strong>
      </div>
      <div>
        <span>{t("high24h")}</span>
        <strong>{data ? wethPrice(data.activity24h.highWethPerStaticsWad) : "—"}</strong>
      </div>
      <div>
        <span>{t("low24h")}</span>
        <strong>{data ? wethPrice(data.activity24h.lowWethPerStaticsWad) : "—"}</strong>
      </div>
      <div>
        <span>{t("volume24h")}</span>
        <strong>{data ? usd(volumeUsd(data)) : "—"}</strong>
      </div>
      <div>
        <span>{t("liquidity")}</span>
        <strong>{data ? usd(data.liquidity.tvlUsdWad) : "—"}</strong>
      </div>
      {market.isError && <p role="status">{t("marketStatsUnavailable")}</p>}
    </section>
  );
}
