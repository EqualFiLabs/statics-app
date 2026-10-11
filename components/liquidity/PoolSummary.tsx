"use client";

import { useTranslations } from "next-intl";
import { useAppLocale } from "@/i18n/client";
import type { DexPool, DexPoolPage } from "@/lib/indexer/dex-market";
import type { PricePoint } from "@/lib/phase-one/range-chart";
import styles from "./range-chart.module.css";

/** Pool facts beside the range editor: price, a sparkline and indexed market stats. */
export function PoolSummary({
  pair,
  fee,
  current,
  unit,
  series,
  stats,
  quote,
  children,
}: {
  pair: string;
  fee: React.ReactNode;
  current: number | null;
  unit: string;
  series: readonly PricePoint[] | null;
  stats: DexPool | null;
  quote: DexPoolPage["quote"] | null;
  children?: React.ReactNode;
}) {
  const t = useTranslations("rangeChart");
  const locale = useAppLocale();
  const money = (value: bigint | null) =>
    value === null || quote?.decimals === null || !quote
      ? "—"
      : quote.kind === "weth"
        ? `${new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(Number(value) / 10 ** quote.decimals)} ${quote.symbol ?? "WETH"}`
        : `≈ ${new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "USD",
            notation: "compact",
            maximumFractionDigits: 2,
            ...(value > 0n && Number(value) / 10 ** quote.decimals < 0.01
              ? { notation: "scientific" as const, maximumSignificantDigits: 4 }
              : {}),
          }).format(Number(value) / 10 ** quote.decimals)}`;
  const spark = (() => {
    if (!series || series.length < 2) return null;
    const prices = series.map((point) => point.price);
    const low = Math.min(...prices),
      high = Math.max(...prices),
      from = series[0]!.time,
      span = series.at(-1)!.time - from || 1;
    const y = (price: number) => (high === low ? 15 : 28 - ((price - low) / (high - low)) * 26);
    return series
      .map((point, index) => {
        const x = (((point.time - from) / span) * 100).toFixed(2);
        return index === 0
          ? `M${x} ${y(point.price).toFixed(2)}`
          : `H${x} V${y(point.price).toFixed(2)}`;
      })
      .join(" ");
  })();
  const yieldDays =
    stats && !stats.yieldComponents.complete
      ? Math.max(1, Math.floor(Number(stats.yieldComponents.windowSeconds) / 86_400))
      : null;
  return (
    <section className={`ui-card ${styles.summary}`} aria-label={t("poolSummary", { pair })}>
      <div className={styles.summaryHead}>
        <strong>{pair}</strong>
        <span>{fee}</span>
      </div>
      <div className={styles.summaryPrice}>
        <span>{t("currentPrice")}</span>
        <strong>
          {current === null
            ? "—"
            : `${new Intl.NumberFormat(locale, { maximumSignificantDigits: 7 }).format(current)} ${unit}`}
        </strong>
      </div>
      {spark && (
        <svg
          className={styles.spark}
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={spark} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {stats && (
        <dl className={styles.stats}>
          <div>
            <dt>{t("tvl")}</dt>
            <dd>{money(stats.valueLocked)}</dd>
          </div>
          <div>
            <dt>{t("volume24h")}</dt>
            <dd>{money(stats.volume24h)}</dd>
          </div>
          <div>
            <dt>{t("fees24h")}</dt>
            <dd>{money(stats.lpFees24h)}</dd>
          </div>
          <div>
            <dt>{t("estimatedYield")}</dt>
            <dd data-tone="up">
              {stats.estimatedYieldBps === null
                ? "—"
                : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(stats.estimatedYieldBps / 100)}%`}
            </dd>
            <dd className={styles.statNote}>
              {yieldDays === null ? t("yieldBasis") : t("yieldWindow", { days: yieldDays })}
            </dd>
          </div>
        </dl>
      )}
      {children}
    </section>
  );
}
