"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatUnits, zeroAddress, type Address, type Hex } from "viem";

import { STATICS_MAX_SUPPLY } from "@statics-protocol/sdk/phase-one";

import { AppPageHeader } from "@/components/app-shell/AppPageHeader";
import { useAccounts } from "@/hooks/useAccounts";
import { useDexOverview } from "@/hooks/useDexOverview";
import { useLaunchOverview } from "@/hooks/useLaunchOverview";
import { useProtocolOverview } from "@/hooks/useProtocolOverview";
import { useAppLocale } from "@/i18n/client";
import type { LaunchDeployment, PhaseOneDeployment } from "@/lib/deployments/types";
import { getFundingNetwork } from "@/lib/funding-networks";
import { EMPTY_GENESIS_PORTFOLIO, summariseGenesisRewards } from "@/lib/genesis/owned";
import type { DexQuote, DexToken } from "@/lib/indexer/dex-market";
import type { PhaseOneProtocolActivity } from "@/lib/indexer/phase-one";
import { getTransactionExplorerUrl } from "@/lib/wallet-config";
import { useWalletState } from "@/providers/wallet-context";
import { compactNumber, quoteAmount } from "./format";
import { OverviewIncentives } from "./OverviewIncentives";
import styles from "./protocol.module.css";

const WAD = 10n ** 18n;
const ACTIVITY_FILTERS = ["all", "trades", "rewards", "fees"] as const;
type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

/** How each indexed Phase 1 event is labelled, and which filter it belongs to. */
const ACTIVITY_KINDS: Record<string, { tag: string; text: string; group: ActivityFilter }> = {
  "protocol-revenue-settled": { tag: "fees", text: "revenueSettled", group: "fees" },
  "creator-revenue-claimed": { tag: "fees", text: "creatorClaimed", group: "fees" },
  "global-reward-claimed": { tag: "claim", text: "stakingClaimed", group: "rewards" },
  "lp-reward-claimed": { tag: "claim", text: "lpClaimed", group: "rewards" },
  "allocator-reward-claimed": { tag: "claim", text: "allocatorClaimed", group: "rewards" },
  "protocol-gauge-reward-credited": { tag: "gauge", text: "gaugeCredited", group: "rewards" },
  "protocol-gauge-reward-recycled": { tag: "gauge", text: "gaugeRecycled", group: "rewards" },
  "lp-reward-forfeited": { tag: "forfeit", text: "forfeited", group: "rewards" },
  "allocator-reward-forfeited": { tag: "forfeit", text: "forfeited", group: "rewards" },
};

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
/** A STATICS-denominated amount valued at a quote-currency price per whole STATICS. */
const valueOf = (amount: bigint | null | undefined, price: bigint | null | undefined) =>
  amount === null || amount === undefined || price === null || price === undefined
    ? null
    : (amount * price) / WAD;

/**
 * The Phase 1 home: every live part of Statics on one page. STATICS and the protocol totals
 * lead, then the connected wallet across both phases, then one card per module (exchange,
 * staking, gauges and, where Genesis is deployed beside Phase 1, Operators),
 * a mixed activity feed and the top pools. The full DEX dashboard lives at /app/markets.
 */
export function ProtocolOverview({
  deployment,
  launch,
}: {
  deployment: PhaseOneDeployment;
  launch: LaunchDeployment | null;
}) {
  const t = useTranslations("protocolOverview");
  const tDex = useTranslations("dexOverview");
  const tLaunch = useTranslations("launchOverview");
  const locale = useAppLocale();
  const walletState = useWalletState();
  const [quote, setQuote] = useState<DexQuote>("usdg");
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const dex = useDexOverview(deployment, quote, { sort: "volume", search: "" }, 30);
  const protocol = useProtocolOverview(deployment);
  const genesis = useLaunchOverview(launch);
  const accounts = useAccounts(deployment);

  const summary = dex.summary.data;
  const quoteToken = summary?.quote;
  const price = summary?.statics.price ?? null;
  const money = (value: bigint | null | undefined, asPrice = false) =>
    quoteAmount(locale, value, quoteToken, asPrice);
  const number = (value: number, digits = 2) => compactNumber(locale, value, digits);
  const statics = (amount: bigint) => number(Number(formatUnits(amount, 18)));
  // Chain time from the indexer, so countdowns and "ago" stay pure across renders.
  const clock = Number(summary?.indexedAtTimestamp ?? dex.trades.data?.indexedAtTimestamp ?? 0n);
  const countdown = (finish: bigint) => {
    const left = Math.max(0, Number(finish) - clock);
    return { days: Math.floor(left / 86_400), hours: Math.floor((left % 86_400) / 3600) };
  };
  const ago = (timestamp: bigint) => {
    if (!clock) return "—";
    const elapsed = Math.max(0, clock - Number(timestamp));
    if (elapsed < 60) return t("ago.seconds", { count: Math.round(elapsed) });
    if (elapsed < 3600) return t("ago.minutes", { count: Math.round(elapsed / 60) });
    if (elapsed < 86_400) return t("ago.hours", { count: Math.round(elapsed / 3600) });
    return t("ago.days", { count: Math.round(elapsed / 86_400) });
  };

  // Token metadata for amounts: reviewed pool tokens first, then whatever the indexer priced.
  const native = getFundingNetwork(deployment.descriptor.chainId)?.chain.nativeCurrency;
  const tokens = new Map<string, DexToken>();
  for (const item of dex.tokens.data?.items ?? [])
    tokens.set(item.token.address.toLowerCase(), item.token);
  for (const pool of deployment.supportedPools)
    for (const token of [pool.token0, pool.token1]) tokens.set(token.address.toLowerCase(), token);
  const withNative = (token: DexToken): DexToken =>
    native && token.address.toLowerCase() === zeroAddress
      ? {
          ...token,
          symbol: token.symbol ?? native.symbol,
          decimals: token.decimals ?? native.decimals,
        }
      : token;
  const symbolOf = (token: DexToken) => withNative(token).symbol ?? short(token.address);
  const pairOf = (pool: { token0: DexToken; token1: DexToken }) =>
    `${symbolOf(pool.token0)} / ${symbolOf(pool.token1)}`;
  const poolName = (poolId: Hex | null) => {
    if (!poolId) return null;
    const known =
      deployment.supportedPools.find(
        (pool) => pool.poolId.toLowerCase() === poolId.toLowerCase()
      ) ?? dex.pools.data?.items.find((pool) => pool.poolId.toLowerCase() === poolId.toLowerCase());
    return known ? pairOf(known) : short(poolId);
  };
  const tokenAmount = (value: bigint, raw: DexToken | undefined, fallback?: Address | null) => {
    const token = raw ? withNative(raw) : undefined;
    if (!token || token.decimals === null)
      return tDex("baseUnits", { amount: String(value) }) + (fallback ? ` ${short(fallback)}` : "");
    return `${number(Number(formatUnits(value, token.decimals)), 4)} ${symbolOf(token)}`;
  };

  // ---- Protocol totals --------------------------------------------------------------------
  const staking = protocol.staking.data;
  const vault = genesis.metrics.data?.vault ?? null;
  const analytics = genesis.marketAnalytics.data ?? null;
  const poolsValue = summary?.current.valueLocked ?? null;
  const poolValueNote = summary
    ? summary.unpricedPools
      ? tDex("excludesUnpriced", { count: summary.unpricedPools })
      : tDex("pools", { count: summary.activePools })
    : "";
  const stakedValue = valueOf(staking?.totalStaked, price);
  const vaultValue = vault ? valueOf(vault.tokenBacking, price) : null;
  const totalValue =
    poolsValue === null || stakedValue === null || (launch && vaultValue === null)
      ? null
      : poolsValue + stakedValue + (vaultValue ?? 0n);
  const marketCap =
    analytics?.status === "fresh"
      ? valueOf(BigInt(analytics.supply.publicDistributed), price)
      : null;
  const stakedShare = staking
    ? Math.round(Number((staking.totalStaked * 100_000n) / STATICS_MAX_SUPPLY) / 10) / 100
    : null;
  const emissions = dex.emissions.data;
  const period = emissions?.period ?? null;
  const periodLive = Boolean(period && period.activated && !period.expired && period.budget > 0n);
  const emissionsLabel = !emissions
    ? dex.emissions.isError
      ? t("dataUnavailable")
      : tDex("loading")
    : !period?.activated
      ? t("notStarted")
      : t("gauges.noActivePeriod");
  const emissionsHint = !emissions
    ? "—"
    : !period?.activated
      ? t("gauges.notStarted")
      : t("gauges.noActivePeriodHint");
  const change = summary?.statics.change24hBps ?? null;

  // ---- Your Statics ------------------------------------------------------------------------
  const signedIn = walletState.status === "ready" && Boolean(walletState.address);
  const portfolio = genesis.portfolio.data ?? EMPTY_GENESIS_PORTFOLIO;
  const operatorRewards = summariseGenesisRewards(portfolio);
  const operatorsHeld = BigInt(portfolio.items.length);
  const staked = accounts.accounts.reduce((total, account) => total + account.staked, 0n);
  const attention = accounts.accounts.filter((account) => account.status === "attention").length;
  const ready = accounts.accounts.filter((account) => account.rewardsReady).length;
  const walletStatics = protocol.walletStatics.data ?? null;
  const accountsKnown = !accounts.loading && !accounts.unavailable;
  const operatorsKnown =
    genesis.portfolio.data !== undefined &&
    !genesis.portfolio.isError &&
    !genesis.portfolio.data.stale;
  const operatorBacking = genesis.metrics.data?.purchase.staticsPrice ?? null;
  const claimParts = [
    operatorRewards.claimableWeth > 0n
      ? `${number(Number(formatUnits(operatorRewards.claimableWeth, 18)), 4)} WETH`
      : null,
    operatorRewards.claimableStatics > 0n
      ? `${statics(operatorRewards.claimableStatics)} STATICS`
      : null,
  ].filter(Boolean);

  // ---- Gauges --------------------------------------------------------------------------------
  const reserve = protocol.gauges.data?.reserve ?? null;
  const reserveLeft = reserve ? reserve.available + reserve.deferred : null;
  const activeStreams = clock
    ? (protocol.gauges.data?.streamFinishes.filter((finish) => Number(finish) > clock).length ??
      null)
    : null;

  // ---- Operators -----------------------------------------------------------------------------
  const purchase = genesis.metrics.data?.purchase ?? null;
  const supply = vault?.maximumSupply ?? 0n;
  const inventory = vault?.vaultInventory ?? 0n;
  const circulating = vault?.circulatingGenesis ?? 0n;
  const share = (count: bigint) =>
    supply > 0n ? `${(Number(count) / Number(supply)) * 100}%` : "0%";
  const count = (value: bigint) => new Intl.NumberFormat(locale).format(value);

  // ---- Activity ------------------------------------------------------------------------------
  type Row = Readonly<{
    key: string;
    tag: string;
    text: string;
    meta: string;
    group: ActivityFilter;
    timestamp: bigint;
    hash: Hex;
  }>;
  const tradeRows: Row[] = (dex.trades.data?.items ?? []).map((trade) => ({
    key: `${trade.transactionHash}:${trade.logIndex}`,
    tag: "swap",
    text: tDex("trade", {
      amountIn: tokenAmount(trade.amountIn, trade.tokenIn),
      amountOut: tokenAmount(trade.amountOut, trade.tokenOut),
    }),
    meta: [
      `${symbolOf(trade.tokenIn)} / ${symbolOf(trade.tokenOut)}`,
      trade.priced ? money(trade.value) : tDex("unpriced"),
      ago(trade.timestamp),
    ].join(" · "),
    group: "trades",
    timestamp: trade.timestamp,
    hash: trade.transactionHash,
  }));
  const eventRow = (event: PhaseOneProtocolActivity): Row => {
    const kind = ACTIVITY_KINDS[event.kind];
    const amount =
      event.amount === null
        ? ""
        : tokenAmount(
            event.amount,
            event.asset
              ? tokens.get(event.asset.toLowerCase())
              : event.kind === "protocol-gauge-reward-credited" ||
                  event.kind === "protocol-gauge-reward-recycled"
                ? { address: deployment.contracts.statics, symbol: "STATICS", decimals: 18 }
                : undefined,
            event.asset
          );
    return {
      key: `${event.transactionHash}:${event.logIndex}`,
      tag: kind?.tag ?? "other",
      text: kind ? t(`activity.text.${kind.text}`, { amount }) : t("activity.text.other"),
      meta: [
        poolName(event.poolId),
        event.positionId === null ? null : t("activity.account", { id: String(event.positionId) }),
        ago(event.blockTimestamp),
      ]
        .filter(Boolean)
        .join(" · "),
      group: kind?.group ?? "all",
      timestamp: event.blockTimestamp,
      hash: event.transactionHash,
    };
  };
  const activity = [...tradeRows, ...(protocol.activity.data ?? []).map(eventRow)]
    .sort((a, b) => (a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? -1 : 1))
    .filter((row) => filter === "all" || row.group === filter)
    .slice(0, 8);

  const bars = (dex.volume.data?.days ?? []).slice(-30);
  const partialHistory = bars.some(
    (day) => !day.coverage.historyComplete || day.coverage.omittedPools > 0
  );
  const fallbackPrices =
    summary?.statics.priceFallback ||
    dex.tokens.data?.items.some((token) => token.priceFallback) ||
    dex.pools.data?.items.some((pool) => pool.priceFallback);
  const maxBar = bars.reduce(
    (max, day) => (day.volume !== null && day.volume > max ? day.volume : max),
    0n
  );
  const topPools = (dex.pools.data?.items ?? []).slice(0, 5);
  const unavailable =
    dex.summary.isError ||
    protocol.staking.isError ||
    protocol.gauges.isError ||
    protocol.activity.isError ||
    dex.emissions.isError ||
    dex.trades.isError ||
    dex.pools.isError ||
    dex.tokens.isError ||
    dex.volume.isError ||
    (signedIn && (protocol.walletStatics.isError || accounts.unavailable)) ||
    Boolean(
      launch &&
      (genesis.metrics.isError ||
        genesis.marketAnalytics.isError ||
        (signedIn && (genesis.portfolio.isError || Boolean(genesis.portfolio.data?.stale))))
    );

  return (
    <div className={styles.page}>
      <AppPageHeader
        feature="overview"
        title={t("title")}
        description={t("lead")}
        actions={
          <div className={styles.headerTools}>
            {dex.fixtures && <span className={styles.sample}>{tDex("sample")}</span>}
            <div className={styles.segmented} role="group" aria-label={tDex("quoteLabel")}>
              {(["usdg", "weth"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={quote === value}
                  onClick={() => setQuote(value)}
                >
                  {tDex(`quote.${value}`)}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <p className={styles.live}>{launch ? t("liveGenesis") : t("livePhaseOne")}</p>

      {unavailable && (
        <p className={styles.notice} role="alert">
          {t("unavailable")}
        </p>
      )}

      {fallbackPrices && (
        <p className={styles.notice} role="status">
          {tDex("fallbackPrices")}
        </p>
      )}
      <section className={styles.tiles} aria-label={t("totals")}>
        <div className={styles.tile}>
          <span className={styles.label}>{t("tile.price")}</span>
          <strong>{money(price, true)}</strong>
          <span data-tone={change === null ? "neutral" : change >= 0 ? "up" : "down"}>
            {change === null
              ? "—"
              : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change / 100).toFixed(1)}% ${t("change24h")}`}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.label}>{t("tile.marketCap")}</span>
          <strong>{money(marketCap)}</strong>
          <span>
            {analytics && analytics.status !== "fresh"
              ? tLaunch(`analyticsStatus.${analytics.status}`)
              : t("tile.marketCapHint")}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.label}>{t("tile.value")}</span>
          <strong>{money(totalValue)}</strong>
          {summary?.unpricedPools && poolsValue !== null ? <span>{poolValueNote}</span> : null}
          <span>
            {launch
              ? t("tile.valueSplit", {
                  pools: money(poolsValue),
                  vault: money(vaultValue),
                  staked: money(stakedValue),
                })
              : t("tile.valueSplitPhaseOne", {
                  pools: money(poolsValue),
                  staked: money(stakedValue),
                })}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.label}>{t("tile.staked")}</span>
          <strong>
            {staking ? statics(staking.totalStaked) : "—"} <small>STATICS</small>
          </strong>
          <span>{stakedShare === null ? "—" : t("tile.stakedShare", { share: stakedShare })}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.label}>{t("tile.emissions")}</span>
          <strong>
            {periodLive && period ? (
              <>
                {statics(period.budget)} <small>STATICS</small>
              </>
            ) : (
              emissionsLabel
            )}
          </strong>
          <span>
            {periodLive && period ? tDex("endsIn", countdown(period.finish)) : emissionsHint}
          </span>
        </div>
      </section>

      {signedIn ? (
        <section className={styles.yours} aria-labelledby="overview-yours">
          <div className={styles.cardHeading}>
            <div className={styles.headingGroup}>
              <h2 id="overview-yours">{t("yours.title")}</h2>
              {attention > 0 && (
                <span className={styles.warningPill}>
                  {t("yours.attention", { count: attention })}
                </span>
              )}
            </div>
            <div className={styles.actions}>
              <Link className="ui-button ui-button--secondary" href="/app/positions">
                {t("yours.openAccounts")}
              </Link>
              <Link className="ui-button ui-button--primary" href="/app/rewards">
                {t("yours.reviewRewards")}
              </Link>
            </div>
          </div>
          <div className={styles.facts}>
            <div>
              <span className={styles.label}>{t("yours.inWallet")}</span>
              <strong>{walletStatics === null ? "—" : `${statics(walletStatics)} STATICS`}</strong>
              <span>{money(valueOf(walletStatics, price))}</span>
            </div>
            <div>
              <span className={styles.label}>{t("yours.staked")}</span>
              <strong>{accountsKnown ? `${statics(staked)} STATICS` : "—"}</strong>
              <span>
                {accountsKnown ? t("yours.stakedAcross", { count: accounts.accounts.length }) : "—"}
              </span>
            </div>
            {launch && (
              <div>
                <span className={styles.label}>{t("yours.operators")}</span>
                <strong>{operatorsKnown ? count(operatorsHeld) : "—"}</strong>
                <span>
                  {operatorsKnown && operatorBacking !== null && operatorsHeld > 0n
                    ? t("yours.operatorBacking", {
                        amount: statics(operatorBacking * operatorsHeld),
                      })
                    : "—"}
                </span>
              </div>
            )}
            {launch && (
              <div>
                <span className={styles.label}>{t("yours.claimable")}</span>
                <strong className={claimParts.length ? styles.up : undefined}>
                  {!operatorsKnown
                    ? "—"
                    : claimParts.length
                      ? claimParts.join(" + ")
                      : t("yours.nothingToClaim")}
                </strong>
              </div>
            )}
            <div>
              <span className={styles.label}>{t("yours.accountRewards")}</span>
              <strong>
                {accountsKnown && accounts.rewardsLoaded
                  ? t("yours.accountsReady", { count: ready })
                  : "—"}
              </strong>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.yours} aria-labelledby="overview-connect">
          <div className={styles.cardHeading}>
            <div className={styles.stack}>
              <h2 id="overview-connect">{t("connect.title")}</h2>
              <p className={styles.secondary}>{t("connect.description")}</p>
            </div>
            {walletState.status === "signed-out" && (
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={() => walletState.login()}
              >
                {t("connect.action")}
              </button>
            )}
          </div>
        </section>
      )}

      <div className={styles.modules}>
        <section className={styles.card} aria-labelledby="overview-exchange">
          <div className={styles.cardHeading}>
            <h2 id="overview-exchange" className={styles.moduleTitle} data-module="exchange">
              {t("exchange.title")}
            </h2>
            <Link href="/app/markets">{t("exchange.open")} ›</Link>
          </div>
          <div className={styles.stats}>
            <div>
              <span className={styles.label}>{tDex("tile.volume")}</span>
              <strong>{money(summary?.current.volume)}</strong>
            </div>
            <div>
              <span className={styles.label}>{tDex("tile.fees")}</span>
              <strong>
                {money(
                  summary &&
                    summary.current.lpFees !== null &&
                    summary.current.protocolFees !== null
                    ? summary.current.lpFees + summary.current.protocolFees
                    : null
                )}
              </strong>
            </div>
            <div>
              <span className={styles.label}>{tDex("tile.valueLocked")}</span>
              <strong>{money(poolsValue)}</strong>
              <span>{poolValueNote}</span>
            </div>
          </div>
          <div
            className={styles.bars}
            role="img"
            aria-label={t("exchange.chart", { days: bars.length })}
          >
            {bars.map((day, index) => (
              <span
                key={day.day}
                data-latest={index === bars.length - 1 || undefined}
                style={{
                  height: `${day.volume === null || maxBar === 0n ? 2 : Math.max(2, Number((day.volume * 100n) / maxBar))}%`,
                }}
                title={`${day.day}: ${money(day.volume)}${!day.coverage.historyComplete || day.coverage.omittedPools > 0 ? ` · ${tDex("incompleteHistory")}` : ""}`}
              />
            ))}
          </div>
          {partialHistory && <p className={styles.secondary}>{tDex("incompleteHistory")}</p>}
        </section>

        <section className={styles.card} aria-labelledby="overview-staking">
          <div className={styles.cardHeading}>
            <h2 id="overview-staking" className={styles.moduleTitle} data-module="staking">
              {t("staking.title")}
            </h2>
            <Link href="/app/rewards/staking">{t("staking.open")} ›</Link>
          </div>
          <div className={styles.stats}>
            <div>
              <span className={styles.label}>{t("staking.total")}</span>
              <strong>{staking ? statics(staking.totalStaked) : "—"}</strong>
              <span>STATICS</span>
            </div>
            <div>
              <span className={styles.label}>{t("staking.value")}</span>
              <strong>{money(stakedValue)}</strong>
            </div>
            <div>
              <span className={styles.label}>{t("staking.share")}</span>
              <strong>{stakedShare === null ? "—" : `${stakedShare}%`}</strong>
              <span>{t("staking.ofSupply")}</span>
            </div>
          </div>
          <div className={styles.stack}>
            <span className={styles.label}>{t("staking.assets")}</span>
            <div className={styles.chips}>
              {staking && staking.rewardAssets.length === 0 && (
                <span className={styles.secondary}>{t("staking.noAssets")}</span>
              )}
              {staking?.rewardAssets.map((token) => (
                <span key={token.address} className={styles.chip}>
                  {token.symbol ?? short(token.address)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="overview-gauges">
          <div className={styles.cardHeading}>
            <h2 id="overview-gauges" className={styles.moduleTitle} data-module="gauges">
              {t("gauges.title")}
            </h2>
            <Link href="/app/rewards/allocations">{t("gauges.open")} ›</Link>
          </div>
          <div className={styles.stats}>
            <div>
              <span className={styles.label}>{t("gauges.period")}</span>
              <strong>{periodLive && period ? statics(period.budget) : emissionsLabel}</strong>
              <span>{periodLive ? t("gauges.toLiquidity") : ""}</span>
            </div>
            <div>
              <span className={styles.label}>{t("gauges.reserve")}</span>
              <strong>{reserveLeft === null ? "—" : statics(reserveLeft)}</strong>
              <span>{t("gauges.reserveHint")}</span>
            </div>
            <div>
              <span className={styles.label}>{t("gauges.streams")}</span>
              <strong>{activeStreams === null ? "—" : activeStreams}</strong>
              <span>{t("gauges.streamsActive")}</span>
            </div>
          </div>
          {periodLive && emissions && emissions.pools.length > 0 ? (
            <div className={styles.stack}>
              <div
                className={styles.share}
                role="img"
                aria-label={[
                  ...emissions.pools.map((pool) => `${pairOf(pool)} ${pool.shareBps / 100}%`),
                  `${tDex("others")} ${emissions.othersBps / 100}%`,
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
                  {tDex("others")} {(emissions.othersBps / 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ) : (
            <p className={styles.secondary}>{emissionsHint}</p>
          )}
        </section>

        {launch && (
          <section className={styles.card} aria-labelledby="overview-operators">
            <div className={styles.cardHeading}>
              <div className={styles.headingGroup}>
                <h2 id="overview-operators" className={styles.moduleTitle} data-module="operators">
                  {t("operators.title")}
                </h2>
                <span className={styles.badge}>{t("operators.badge")}</span>
              </div>
              <Link href="/app/genesis">{t("operators.open")} ›</Link>
            </div>
            {genesis.metrics.isError ? (
              <p className={styles.secondary}>{t("operators.unavailable")}</p>
            ) : !vault ? (
              <p className={styles.secondary}>{tDex("loading")}</p>
            ) : (
              <>
                <div className={styles.stats}>
                  <div>
                    <span className={styles.label}>{t("operators.backing")}</span>
                    <strong>{purchase ? statics(purchase.staticsPrice) : "—"}</strong>
                    <span>STATICS</span>
                  </div>
                  <div>
                    <span className={styles.label}>{t("operators.buyIn")}</span>
                    <strong>{purchase ? statics(purchase.staticsPrice) : "—"}</strong>
                    <span>
                      {purchase
                        ? t("operators.buyInMeta", {
                            eth: number(
                              Number(formatUnits(purchase.reserveBuyIn + purchase.nativeFee, 18)),
                              4
                            ),
                          })
                        : ""}
                    </span>
                  </div>
                  <div>
                    <span className={styles.label}>{t("operators.epoch")}</span>
                    <strong>
                      {vault
                        ? vault.epochActive
                          ? clock
                            ? t("operators.epochLeft", countdown(vault.genesisEpochEnd))
                            : "—"
                          : t("operators.epochEnded")
                        : "—"}
                    </strong>
                    <span>
                      {vault?.epochActive ? t("operators.epochActive") : t("operators.epochAfter")}
                    </span>
                  </div>
                </div>
                <div className={styles.stack}>
                  <div
                    className={styles.share}
                    role="img"
                    aria-label={t("operators.supplyLabel", {
                      supply: count(supply),
                      vault: count(inventory),
                      held: count(circulating),
                    })}
                  >
                    <span data-index="vault" style={{ width: share(inventory) }} />
                    <span data-index="held" style={{ width: share(circulating) }} />
                  </div>
                  <div className={styles.legend}>
                    <span>
                      <i data-index="vault" aria-hidden="true" />
                      {t("operators.inVault", { count: count(inventory) })}
                    </span>
                    <span>
                      <i data-index="held" aria-hidden="true" />
                      {t("operators.held", { count: count(circulating) })}
                    </span>
                    <span className={styles.secondary}>
                      {t("operators.ofSupply", { count: count(supply) })}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <OverviewIncentives
        data={dex.emissions.data}
        loading={dex.emissions.isLoading}
        failed={dex.emissions.isError}
      />

      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="overview-activity">
          <div className={styles.cardHeading}>
            <h2 id="overview-activity">
              {t("activity.title")}{" "}
              {!dex.trades.isError &&
                !protocol.activity.isError &&
                (dex.trades.data || protocol.activity.data) && (
                  <span className={styles.up}>● {tDex("live")}</span>
                )}
            </h2>
            <div className={styles.filters} role="group" aria-label={t("activity.filter")}>
              {ACTIVITY_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(`activity.filters.${value}`)}
                </button>
              ))}
            </div>
          </div>
          <ol className={styles.activity}>
            {activity.map((row) => {
              const link = getTransactionExplorerUrl(deployment.descriptor.chainId, row.hash);
              return (
                <li key={row.key}>
                  <span className={styles.tag} data-tag={row.tag}>
                    {t(`activity.tags.${row.tag}`)}
                  </span>
                  <span className={styles.activityText}>
                    <strong>{row.text}</strong>
                    <span className={styles.muted}>{row.meta}</span>
                  </span>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className={styles.hash}>
                      {short(row.hash)}
                    </a>
                  ) : (
                    <span className={styles.hash}>{short(row.hash)}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {activity.length === 0 && (
            <p className={styles.secondary}>
              {dex.trades.isLoading || protocol.activity.isLoading
                ? tDex("loading")
                : dex.trades.isError || protocol.activity.isError
                  ? t("dataUnavailable")
                  : t("activity.empty")}
            </p>
          )}
          <Link href="/app/markets">{t("activity.all")} ›</Link>
        </section>

        <section className={styles.card} aria-labelledby="overview-pools">
          <div className={styles.cardHeading}>
            <h2 id="overview-pools">{t("pools.title")}</h2>
            <span className={styles.secondary}>{t("pools.meta")}</span>
          </div>
          <div className={styles.tableFrame}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{tDex("column.pool")}</th>
                  <th scope="col">{tDex("column.valueLocked")}</th>
                  <th scope="col">{tDex("column.volume")}</th>
                  <th scope="col">{tDex("column.yield")}</th>
                </tr>
              </thead>
              <tbody>
                {topPools.map((pool) => (
                  <tr key={pool.poolId}>
                    <th scope="row">{pairOf(pool)}</th>
                    <td>{pool.priced ? money(pool.valueLocked) : "—"}</td>
                    <td>{money(pool.volume24h)}</td>
                    <td className={styles.up}>
                      {pool.estimatedYieldBps === null
                        ? "—"
                        : `${(pool.estimatedYieldBps / 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dex.pools.data && topPools.length === 0 && (
            <p className={styles.secondary}>{tDex("noPools")}</p>
          )}
          <Link href="/app/markets">
            {t("pools.all", { count: dex.pools.data?.total ?? topPools.length })} ›
          </Link>
        </section>
      </div>

      <p className={styles.footnote}>{t("note")}</p>
    </div>
  );
}
