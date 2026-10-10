"use client";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import { useAccounts } from "@/hooks/useAccounts";
import { useDexOverview } from "@/hooks/useDexOverview";
import { useAppLocale } from "@/i18n/client";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { DexPool, DexQuote, DexToken } from "@/lib/indexer/dex-market";
import { getTransactionExplorerUrl } from "@/lib/wallet-config";
import styles from "./dex.module.css";

const SORTS = ["volume", "valueLocked", "yield"] as const;
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const symbolOf = (token: DexToken) => token.symbol ?? short(token.address);
const pairOf = (pool: { token0: DexToken; token1: DexToken }) =>
  `${symbolOf(pool.token0)} / ${symbolOf(pool.token1)}`;

/**
 * The Phase 1 home: the DEX and its stats. Every value is priced from Statics pools in the
 * chosen quote currency, USDG ("≈ $") by default or WETH; unpriced pools show pair prices only.
 */
export function DexOverview({ deployment }: { deployment: PhaseOneDeployment }) {
  const t = useTranslations("dexOverview");
  const locale = useAppLocale();
  const [quote, setQuote] = useState<DexQuote>("usdg");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("volume");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(30);
  const query = useDeferredValue(search.trim());
  const dex = useDexOverview(deployment, quote, { sort, search: query }, days);
  const accounts = useAccounts(deployment);
  const quoteToken = dex.summary.data?.quote;

  const number = (value: number, digits = 2) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: digits,
      ...(value > 0 && value < 0.0001
        ? { notation: "scientific" as const, maximumSignificantDigits: 4 }
        : {}),
    }).format(value);
  /** A quote-currency amount: "≈ $1.07M" in USDG, "412.6 WETH" in WETH. */
  const money = (value: bigint | null | undefined, price = false, q = quoteToken) => {
    if (value === null || value === undefined || !q) return "—";
    const amount = Number(formatUnits(value, q.decimals ?? 18));
    // Prices keep four significant digits however small; totals are compact.
    const fraction =
      price && amount > 0 && amount < 1 ? Math.min(12, Math.ceil(-Math.log10(amount)) + 3) : 2;
    if (q.kind === "usdg")
      return `≈ ${new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        notation: price ? "standard" : "compact",
        minimumFractionDigits: price ? Math.min(2, fraction) : 0,
        maximumFractionDigits: price ? fraction : 2,
        ...(amount > 0 && amount < 0.000000000001
          ? { notation: "scientific" as const, maximumSignificantDigits: 4 }
          : {}),
      }).format(amount)}`;
    return `${
      price
        ? new Intl.NumberFormat(locale, {
            maximumFractionDigits: Math.max(fraction, 4),
            ...(amount > 0 && amount < 0.000000000001
              ? { notation: "scientific" as const, maximumSignificantDigits: 4 }
              : {}),
          }).format(amount)
        : number(amount, 3)
    } WETH`;
  };
  const tokenAmount = (value: bigint, token: DexToken) =>
    token.decimals === null
      ? t("baseUnits", { amount: String(value) })
      : `${number(Number(formatUnits(value, token.decimals)), 4)} ${symbolOf(token)}`;
  const change = (bps: number | null | undefined) =>
    bps === null || bps === undefined
      ? { text: "—", tone: "neutral" }
      : {
          text: `${bps >= 0 ? "▲" : "▼"} ${Math.abs(bps / 100).toFixed(1)}%`,
          tone: bps >= 0 ? "up" : "down",
        };
  const versus = (current: bigint | null, previous: bigint | null) =>
    current === null || previous === null || previous === 0n
      ? null
      : Number(((current - previous) * 10_000n) / previous);
  // Relative to the indexer's observation time, so renders stay pure.
  const ago = (seconds: bigint) => {
    const reference = Number(dex.trades.data?.indexedAtTimestamp ?? seconds);
    const elapsed = Math.max(0, reference - Number(seconds));
    return elapsed < 60
      ? t("secondsAgo", { count: Math.round(elapsed) })
      : t("minutesAgo", { count: Math.round(elapsed / 60) });
  };
  const yieldText = (pool: DexPool) =>
    pool.estimatedYieldBps === null ? "—" : `${(pool.estimatedYieldBps / 100).toFixed(1)}%`;

  // Your corner: holdings valued with this page's token prices; unpriced holdings are noted.
  const prices = new Map(
    (dex.tokens.data?.items ?? []).map((item) => [item.token.address.toLowerCase(), item])
  );
  let yourValue = 0n,
    yourUnpriced = false;
  for (const account of accounts.accounts)
    for (const holding of account.holdings) {
      const price = prices.get(holding.asset.address.toLowerCase());
      if (
        !price ||
        price.priceNumerator === null ||
        price.priceDenominator === null ||
        holding.asset.decimals === null
      )
        yourUnpriced = true;
      else
        yourValue +=
          (holding.amount * price.priceNumerator) /
          (price.priceDenominator * 10n ** BigInt(holding.asset.decimals));
    }
  const holdingsIncomplete =
    accounts.loading || accounts.unavailable || accounts.accounts.some((a) => !a.holdingsComplete);
  const attention = accounts.accounts.filter((account) => account.status === "attention").length;
  const ready = accounts.accounts.filter((account) => account.rewardsReady).length;

  const summary = dex.summary.data;
  const tiles = summary
    ? [
        {
          label: t("tile.volume"),
          value: money(summary.current.volume),
          meta: change(versus(summary.current.volume, summary.previous.volume)),
        },
        {
          label: t("tile.fees"),
          value: money(
            summary.current.lpFees === null || summary.current.protocolFees === null
              ? null
              : summary.current.lpFees + summary.current.protocolFees
          ),
          meta: {
            text: t("feesSplit", {
              lp: money(summary.current.lpFees),
              protocol: money(summary.current.protocolFees),
            }),
            tone: "neutral",
          },
        },
        {
          label: t("tile.valueLocked"),
          value: money(summary.current.valueLocked),
          meta: {
            text: summary.unpricedPools
              ? t("excludesUnpriced", { count: summary.unpricedPools })
              : t("pools", { count: summary.activePools }),
            tone: "neutral",
          },
        },
        {
          label: t("tile.swaps"),
          value: number(Number(summary.current.swaps), 1),
          meta: { text: t("wallets", { count: Number(summary.current.wallets) }), tone: "neutral" },
        },
        {
          label: t("tile.statics"),
          value: money(summary.statics.price, true),
          meta: change(summary.statics.change24hBps),
        },
      ]
    : [];
  const bars = dex.volume.data?.days ?? [];
  const maxBar = bars.reduce(
    (max, day) => (day.volume !== null && day.volume > max ? day.volume : max),
    0n
  );
  const emissions = dex.emissions.data;
  const remaining = emissions?.period
    ? Number(emissions.period.finish) - Number(emissions.indexedAtTimestamp)
    : null;
  const unavailable =
    dex.summary.isError ||
    dex.pools.isError ||
    dex.tokens.isError ||
    dex.volume.isError ||
    dex.emissions.isError ||
    dex.trades.isError;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className={styles.lead}>{t("lead")}</p>
        </div>
        <div className={styles.headerTools}>
          {dex.fixtures && <span className={styles.sample}>{t("sample")}</span>}
          <div className={styles.segmented} role="group" aria-label={t("quoteLabel")}>
            {(["usdg", "weth"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={quote === value}
                onClick={() => setQuote(value)}
              >
                {t(`quote.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {summary &&
        Object.values(summary.current.coverage).some(
          (c) => !c.historyComplete || c.omittedPools > 0
        ) && <p className={styles.notice}>{t("incompleteCoverage")}</p>}
      {dex.pools.data?.items.some((p) => p.priceFallback) && (
        <p className={styles.notice}>{t("fallbackPrices")}</p>
      )}
      {quoteToken?.kind !== quote && quoteToken && (
        <p className={styles.notice}>{t("quoteFallback")}</p>
      )}
      {unavailable && (
        <p className={styles.notice} role="alert">
          {t("unavailable")}
        </p>
      )}

      {accounts.action.wallet && accounts.accounts.length > 0 && (
        <Link className={styles.yours} href="/app/positions">
          <span className={styles.yoursFacts}>
            <span>
              <span className={styles.muted}>{t("yourHoldings")}</span>{" "}
              <strong>
                {money(yourValue, false, dex.tokens.data?.quote)}
                {holdingsIncomplete ? ` · ${t("incompleteHoldings")}` : ""}
                {yourUnpriced ? ` ${t("plusUnpriced")}` : ""}
              </strong>
            </span>
            <span>
              <span className={styles.muted}>{t("yourAccounts")}</span>{" "}
              <strong>{accounts.accounts.length}</strong>
            </span>
            {ready > 0 && <span className={styles.up}>{t("rewardsReady", { count: ready })}</span>}
            {attention > 0 && (
              <span className={styles.warning}>{t("needAttention", { count: attention })}</span>
            )}
          </span>
          <span className={styles.up}>{t("openAccounts")} ›</span>
        </Link>
      )}

      <section className={styles.tiles} aria-label={t("totals")}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <span className={styles.label}>{tile.label}</span>
            <strong>{tile.value}</strong>
            <span data-tone={tile.meta.tone}>{tile.meta.text}</span>
          </div>
        ))}
        {emissions?.period && (
          <div className={styles.tile}>
            <span className={styles.label}>{t("tile.emissions")}</span>
            <strong>
              {number(Number(formatUnits(emissions.period.budget, 18)))} <small>STATICS</small>
            </strong>
            <span data-tone="neutral">
              {!emissions.period.expired && remaining !== null && remaining > 0
                ? t("endsIn", {
                    days: Math.floor(remaining / 86_400),
                    hours: Math.floor((remaining % 86_400) / 3600),
                  })
                : t("periodEnded")}
            </span>
          </div>
        )}
        {!summary && <p className={styles.muted}>{dex.summary.isLoading ? t("loading") : null}</p>}
      </section>

      <section className={styles.card} aria-labelledby="dex-volume">
        <div className={styles.cardHeading}>
          <h2 id="dex-volume">{t("volume")}</h2>
          <div className={styles.segmented} role="group" aria-label={t("rangeLabel")}>
            {[7, 30].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={days === value}
                onClick={() => setDays(value)}
              >
                {t("days", { count: value })}
              </button>
            ))}
          </div>
        </div>
        <div
          className={styles.bars}
          role="img"
          aria-label={t("volumeChart", {
            days,
            last: money(bars.at(-1)?.volume ?? null, false, dex.volume.data?.quote),
          })}
        >
          {bars.slice(-days).map((day, index, shown) => (
            <span
              key={day.day}
              data-latest={index === shown.length - 1 || undefined}
              data-incomplete={
                !day.coverage.historyComplete || day.coverage.omittedPools > 0 || undefined
              }
              style={{
                height: `${day.volume === null || maxBar === 0n ? 2 : Math.max(2, Number((day.volume * 100n) / maxBar))}%`,
              }}
              title={`${day.day}: ${money(day.volume, false, dex.volume.data?.quote)}${!day.coverage.historyComplete || day.coverage.omittedPools > 0 ? ` · ${t("incompleteHistory")}` : ""}`}
            />
          ))}
        </div>
        {bars.some((day) => !day.coverage.historyComplete || day.coverage.omittedPools > 0) && (
          <span className={styles.muted}>{t("incompleteHistory")}</span>
        )}
        {summary && summary.unpricedPools > 0 && (
          <span className={styles.muted}>
            {t("excludesUnpriced", { count: summary.unpricedPools })}
          </span>
        )}
      </section>

      <section className={`${styles.section} ${styles.poolsSection}`} aria-labelledby="dex-pools">
        <div className={styles.cardHeading}>
          <h2 id="dex-pools">{t("poolsTitle")}</h2>
          <div className={styles.tools}>
            <label className={styles.search}>
              <span className={styles.srOnly}>{t("searchPools")}</span>
              <input
                type="search"
                value={search}
                placeholder={t("searchPlaceholder")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className={styles.segmented} role="group" aria-label={t("sortLabel")}>
              {SORTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sort === value}
                  onClick={() => setSort(value)}
                >
                  {t(`sort.${value}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.tableFrame}>
          <table className={`${styles.table} ${styles.poolsTable}`}>
            <thead>
              <tr>
                <th scope="col">{t("column.pool")}</th>
                <th scope="col">{t("column.pairPrice")}</th>
                <th scope="col">{t("column.change")}</th>
                <th scope="col">{t("column.volume")}</th>
                <th scope="col">{t("column.fees")}</th>
                <th scope="col">{t("column.valueLocked")}</th>
                <th scope="col">{t("column.incentives")}</th>
                <th scope="col">{t("column.yield")}</th>
                <th scope="col">
                  <span className={styles.srOnly}>{t("column.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(dex.pools.data?.items ?? []).map((pool) => {
                const moved = change(pool.change24hBps);
                return (
                  <tr key={pool.poolId}>
                    <th scope="row">
                      <span className={styles.pool}>
                        <strong>{pairOf(pool)}</strong>
                        <span className={styles.muted}>
                          {t("fee", { fee: (pool.lpFee / 10_000).toFixed(2) })}
                        </span>
                        {pool.priceFallback && (
                          <span className={styles.pill}>{t("spotFallback")}</span>
                        )}
                        {!pool.priced && <span className={styles.pill}>{t("unpriced")}</span>}
                      </span>
                    </th>
                    <td className={styles.pairPrice} data-label={t("column.pairPrice")}>
                      {pool.pairPrice === null
                        ? "—"
                        : t("pairPrice", {
                            token0: symbolOf(pool.token0),
                            price: number(Number(pool.pairPrice), 4),
                            token1: symbolOf(pool.token1),
                          })}
                    </td>
                    <td data-label={t("column.change")} data-tone={moved.tone}>
                      {moved.text}
                    </td>
                    <td data-label={t("column.volume")}>
                      {money(pool.volume24h, false, dex.pools.data?.quote)}
                    </td>
                    <td data-label={t("column.fees")}>
                      {money(pool.lpFees24h, false, dex.pools.data?.quote)}
                    </td>
                    <td
                      data-label={t("column.valueLocked")}
                      title={`${tokenAmount(pool.amount0, pool.token0)} · ${tokenAmount(pool.amount1, pool.token1)}`}
                    >
                      {pool.priced ? money(pool.valueLocked, false, dex.pools.data?.quote) : "—"}
                    </td>
                    <td data-label={t("column.incentives")}>
                      {pool.incentiveStreams ? t("streams", { count: pool.incentiveStreams }) : "—"}
                    </td>
                    <td className={styles.yield} data-label={t("column.yield")}>
                      {yieldText(pool)}
                    </td>
                    <td className={styles.rowActions}>
                      <div className={styles.actions}>
                        <Link
                          className="ui-button ui-button--secondary ui-button--sm"
                          href="/app/swap"
                        >
                          {t("swap")}
                        </Link>
                        <Link
                          className="ui-button ui-button--primary ui-button--sm"
                          href={`/app/liquidity?poolId=${pool.poolId}`}
                          aria-label={t("addLiquidityTo", { pool: pairOf(pool) })}
                        >
                          {t("addLiquidity")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dex.pools.data && dex.pools.data.items.length === 0 && (
            <p className={styles.empty}>{query ? t("noMatch") : t("noPools")}</p>
          )}
          {dex.pools.isLoading && <p className={styles.empty}>{t("loading")}</p>}
        </div>
        {dex.pools.hasNextPage && (
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={dex.pools.isFetchingNextPage}
            onClick={() => void dex.pools.fetchNextPage()}
          >
            {dex.pools.isFetchingNextPage ? t("loading") : t("loadMore")}
          </button>
        )}
        {dex.pools.isError && (
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={() => void dex.pools.refetch()}
          >
            {t("restartPools")}
          </button>
        )}
        <span className={styles.muted}>{t("yieldNote")}</span>
      </section>

      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="dex-tokens">
          <h2 id="dex-tokens">{t("tokensTitle")}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("column.token")}</th>
                <th scope="col">{t("column.price")}</th>
                <th scope="col">{t("column.change")}</th>
                <th scope="col">{t("column.volume")}</th>
              </tr>
            </thead>
            <tbody>
              {(dex.tokens.data?.items ?? []).map((item) => {
                const moved = change(item.change24hBps);
                return (
                  <tr key={item.token.address}>
                    <th scope="row">
                      <span className={styles.pool}>
                        <strong>{symbolOf(item.token)}</strong>
                        {item.route.length > 0 && (
                          <span className={styles.muted}>
                            {item.priceFallback && `${t("spotFallback")} · `}
                            {t("via", {
                              route: item.route
                                .map((poolId) => {
                                  const known = deployment.supportedPools.find(
                                    (pool) => pool.poolId.toLowerCase() === poolId.toLowerCase()
                                  );
                                  return known ? pairOf(known) : short(poolId);
                                })
                                .join(" · "),
                            })}
                          </span>
                        )}
                      </span>
                    </th>
                    <td>
                      {item.price === 0n && item.priceNumerator !== null && item.priceNumerator > 0n
                        ? `<${money(1n, true, dex.tokens.data?.quote)}`
                        : money(item.price, true, dex.tokens.data?.quote)}
                    </td>
                    <td data-tone={moved.tone}>{moved.text}</td>
                    <td>{money(item.volume24h, false, dex.tokens.data?.quote)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className={styles.card} aria-labelledby="dex-trades">
          <div className={styles.cardHeading}>
            <h2 id="dex-trades">{t("tradesTitle")}</h2>
            <span className={styles.up}>● {t("live")}</span>
          </div>
          <ol className={styles.trades}>
            {(dex.trades.data?.items ?? []).map((trade) => {
              const link = getTransactionExplorerUrl(
                deployment.descriptor.chainId,
                trade.transactionHash
              );
              return (
                <li key={`${trade.transactionHash}:${trade.logIndex}`}>
                  <span className={styles.pool}>
                    <strong>
                      {t("trade", {
                        amountIn: tokenAmount(trade.amountIn, trade.tokenIn),
                        amountOut: tokenAmount(trade.amountOut, trade.tokenOut),
                      })}
                    </strong>
                    <span className={styles.muted}>
                      {[
                        `${symbolOf(trade.tokenIn)} / ${symbolOf(trade.tokenOut)}`,
                        trade.priced
                          ? money(trade.value, false, dex.trades.data?.quote)
                          : t("unpriced"),
                        ago(trade.timestamp),
                      ].join(" · ")}
                    </span>
                  </span>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className={styles.hash}>
                      {short(trade.transactionHash)}
                    </a>
                  ) : (
                    <span className={styles.hash}>{short(trade.transactionHash)}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {emissions?.period && (
        <section className={styles.card} aria-labelledby="dex-emissions">
          <div className={styles.cardHeading}>
            <h2 id="dex-emissions">{t("emissionsTitle")}</h2>
            <span className={styles.muted}>
              {t("emissionsMeta", {
                budget: number(Number(formatUnits(emissions.period.budget, 18))),
              })}
            </span>
          </div>
          <div
            className={styles.share}
            role="img"
            aria-label={[
              ...emissions.pools.map((pool) => `${pairOf(pool)} ${pool.shareBps / 100}%`),
              `${t("others")} ${emissions.othersBps / 100}%`,
            ].join(", ")}
          >
            {emissions.pools.map((pool, index) => (
              <span
                key={pool.poolId}
                data-index={index}
                style={{ width: `${pool.shareBps / 100}%` }}
              />
            ))}
            <span data-index="others" style={{ width: `${emissions.othersBps / 100}%` }} />
          </div>
          <div className={styles.legend}>
            {emissions.pools.map((pool, index) => (
              <span key={pool.poolId}>
                <i data-index={index} aria-hidden="true" />
                {pairOf(pool)} {(pool.shareBps / 100).toFixed(0)}%
              </span>
            ))}
            <span>
              <i data-index="others" aria-hidden="true" />
              {t("others")} {(emissions.othersBps / 100).toFixed(0)}%
            </span>
            <Link href="/app/rewards/allocations">{t("allocate")} ›</Link>
          </div>
        </section>
      )}

      <p className={styles.footnote}>{t("pricingNote")}</p>
    </div>
  );
}
