"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import { useAppLocale } from "@/i18n/client";
import type { DexEmissions, DexIncentiveAmount, DexToken } from "@/lib/indexer/dex-market";
import { formatRewardAmount } from "@/lib/protocol/ux";
import { quoteAmount } from "./format";
import styles from "./protocol.module.css";

/** Pool-wide funded rewards, not a wallet's claimable balance or an uncapped run rate. */
export function OverviewIncentives({
  data,
  loading,
  failed,
}: {
  data: DexEmissions | undefined;
  loading: boolean;
  failed: boolean;
}) {
  const t = useTranslations("protocolOverview.incentives");
  const locale = useAppLocale();
  const weekly = data?.weeklyIncentives;
  const name = (token: DexToken) => token.symbol ?? t("unknownToken");
  const amounts = (entries: readonly DexIncentiveAmount[], paused: boolean) => (
    <div className={styles.incentiveAmounts}>
      {entries.length ? (
        entries.map(({ token, amount, quoteValue }) => (
          <div
            key={token.address}
            title={
              token.decimals === null
                ? token.address
                : `${formatUnits(amount, token.decimals)} ${name(token)}`
            }
          >
            <strong>
              {token.decimals === null
                ? t("unknownAmount")
                : formatRewardAmount(amount, token.decimals)}{" "}
              {name(token)}
            </strong>
            {quoteValue !== null && data && (
              <span className={styles.muted}>{quoteAmount(locale, quoteValue, data.quote)}</span>
            )}
          </div>
        ))
      ) : (
        <span className={styles.muted}>{t("none")}</span>
      )}
      {paused && entries.length > 0 && <span className={styles.warningPill}>{t("paused")}</span>}
    </div>
  );
  return (
    <section className={styles.card} aria-labelledby="overview-incentives">
      <div className={styles.cardHeading}>
        <div className={styles.stack}>
          <h2 id="overview-incentives">{t("title")}</h2>
          <p className={styles.secondary}>{t("description")}</p>
        </div>
        <Link href="/app/rewards/allocations">{t("open")} ›</Link>
      </div>
      {!weekly ? (
        <p className={styles.secondary} role="status">
          {loading ? t("loading") : t("unavailable")}
        </p>
      ) : weekly.pools.length === 0 ? (
        <p className={styles.secondary}>{t("empty")}</p>
      ) : (
        <div className={styles.tableFrame}>
          <table className={`${styles.table} ${styles.incentiveTable}`}>
            <thead>
              <tr>
                <th scope="col">{t("pool")}</th>
                <th scope="col">{t("lp")}</th>
                <th scope="col">{t("allocator")}</th>
              </tr>
            </thead>
            <tbody>
              {weekly.pools.map((pool) => (
                <tr key={pool.poolId}>
                  <th scope="row">
                    {name(pool.token0)} / {name(pool.token1)}
                  </th>
                  <td>{amounts(pool.lp, pool.lpPaused)}</td>
                  <td>{amounts(pool.allocator, pool.allocatorPaused)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {weekly && (
        <>
          {failed && (
            <p className={styles.notice} role="status">
              {t("refreshFailed")}
            </p>
          )}
          <p className={styles.footnote}>{t("help")}</p>
          <p className={styles.footnote}>
            {t("asOf", {
              time: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              }).format(new Date(Number(weekly.from) * 1000)),
            })}
          </p>
        </>
      )}
    </section>
  );
}
