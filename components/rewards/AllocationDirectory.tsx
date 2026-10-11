"use client";
import { Fragment, useDeferredValue, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { formatUnits, type Address, type Hex } from "viem";
import { useAppLocale } from "@/i18n/client";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { AllocationDirectoryFilters, IndexedAllocationPool } from "@/lib/indexer/phase-one";
import { rewardDisplay, rewardPoolName } from "@/lib/rewards/earn";
import { perThousandWeekly, type AssetAmount } from "@/lib/rewards/allocations";
import { useAllocationDirectory } from "@/hooks/useAllocationDirectory";
import styles from "./earn.module.css";

type Sort = NonNullable<AllocationDirectoryFilters["sort"]>;
type Metadata = IndexedAllocationPool["token0"];
type Stream = IndexedAllocationPool["allocatorStreams"][number];

/** Amounts in a directory token, using the indexer's metadata rather than the manifest. */
export function directoryAmount(amount: bigint, asset: Metadata): string {
  if (asset.decimals === null) return `${amount} ${asset.symbol ?? shortAddress(asset.address)}`;
  const [whole, fraction = ""] = formatUnits(amount, asset.decimals).split(".");
  const short = fraction.slice(0, 6).replace(/0+$/, "");
  const value =
    amount > 0n && whole === "0" && !short
      ? "<0.000001"
      : `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${short ? `.${short}` : ""}`;
  return `${value} ${asset.symbol ?? shortAddress(asset.address)}`;
}
function shortAddress(address: Address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function directoryPoolName(deployment: PhaseOneDeployment, pool: IndexedAllocationPool) {
  return pool.token0.symbol && pool.token1.symbol
    ? `${pool.token0.symbol} / ${pool.token1.symbol}`
    : rewardPoolName(deployment, pool.poolId);
}

/**
 * Every pool open to allocation, from the indexer. Search, filters, sorting and paging run
 * server-side. The directory is an observation: weights and streams can trail the chain, and
 * actions are always simulated against live state before signing.
 */
export function AllocationDirectory({
  deployment,
  compact,
  now,
  yourAllocation,
  allocate,
}: {
  deployment: PhaseOneDeployment;
  compact: boolean;
  /** Current chain time; use the indexer's checkpoint time until the chain read arrives. */
  now: bigint | undefined;
  /** This wallet's current allocation to a pool, across positions. */
  yourAllocation: (poolId: Hex) => bigint;
  /** The Allocate control for a pool. */
  allocate: (pool: IndexedAllocationPool) => ReactNode;
}) {
  const t = useTranslations("allocationDirectory");
  const locale = useAppLocale();
  const [search, setSearch] = useState("");
  const [incentivesOnly, setIncentivesOnly] = useState(false);
  const [includeIneligible, setIncludeIneligible] = useState(false);
  const [sort, setSort] = useState<Sort>("incentives");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  // Typing should not issue a request per keystroke ahead of rendering.
  const query = useDeferredValue(search.trim());
  const directory = useAllocationDirectory(deployment, {
    ...(query ? { search: query } : {}),
    eligible: includeIneligible ? "all" : "true",
    ...(incentivesOnly ? { hasIncentives: true } : {}),
    sort,
    direction,
    limit: 25,
  });
  const asOf = now ?? directory.indexedAtTimestamp ?? undefined;
  const date = (seconds: bigint) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      new Date(Number(seconds) * 1000)
    );
  const statics = (amount: bigint) => `${rewardDisplay(amount, 18).display} STATICS`;
  const assetOf = (pool: IndexedAllocationPool, asset: Address) =>
    pool.allocatorStreams.find((stream) => stream.asset.address === asset)!.asset;
  const perThousand = (pool: IndexedAllocationPool): ReactNode => {
    const values: AssetAmount[] = perThousandWeekly(pool, asOf);
    return values.length ? (
      <span className={styles.directoryAmounts}>
        {values.map((value) => (
          <span key={value.asset}>{directoryAmount(value.amount, assetOf(pool, value.asset))}</span>
        ))}
      </span>
    ) : (
      <span className={styles.cellMeta}>—</span>
    );
  };
  const eligibility = (pool: IndexedAllocationPool) => (
    <span
      className={styles.statusPill}
      data-tone={pool.eligibility.eligible ? "positive" : "negative"}
    >
      {pool.eligibility.eligible
        ? t("eligible")
        : pool.eligibility.reasons.map((reason) => t(`reason.${reason}`)).join(", ")}
    </span>
  );
  const streamStatus = (stream: Stream) =>
    stream.terminated
      ? "terminated"
      : stream.invalidated
        ? "invalidated"
        : asOf !== undefined && asOf >= stream.periodFinish
          ? "ended"
          : stream.paused
            ? "paused"
            : stream.funded
              ? "active"
              : "ended";
  const streams = (pool: IndexedAllocationPool) =>
    pool.allocatorStreams.length ? (
      <ul
        className={styles.streamList}
        aria-label={t("streams", { pool: directoryPoolName(deployment, pool) })}
      >
        {pool.allocatorStreams.map((stream) => {
          const status = streamStatus(stream);
          return (
            <li key={stream.slot}>
              <strong>{directoryAmount(stream.periodBudget, stream.asset)}</strong>
              <span className={styles.cellMeta}>
                {t("streamDetail", {
                  share: (stream.allocatorShareBps / 100).toLocaleString(locale),
                  emitted: directoryAmount(stream.periodEmitted, stream.asset),
                  start: date(stream.periodStart),
                  finish: date(stream.periodFinish),
                })}
              </span>
              <span
                className={styles.statusPill}
                data-tone={status === "active" ? "positive" : "neutral"}
              >
                {t(`stream.${status}`)}
              </span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className={styles.cellMeta}>{t("noStreams")}</p>
    );
  const streamCount = (pool: IndexedAllocationPool) =>
    pool.incentiveStreamCount
      ? t("streamCount", { count: pool.incentiveStreamCount })
      : t("streamCountNone");
  const toggle = (poolId: Hex) =>
    setExpanded((previous) =>
      previous.includes(poolId)
        ? previous.filter((entry) => entry !== poolId)
        : [...previous, poolId]
    );
  const sortBy = (next: Sort) => {
    setDirection(sort === next && direction === "desc" ? "asc" : "desc");
    setSort(next);
  };
  const arrow = (field: Sort) => (sort === field ? (direction === "asc" ? "↑" : "↓") : "");
  const ariaSort = (field: Sort) =>
    sort === field ? (direction === "asc" ? "ascending" : "descending") : "none";
  const yours = (pool: IndexedAllocationPool) => {
    const amount = yourAllocation(pool.poolId);
    return amount > 0n ? statics(amount) : "—";
  };

  return (
    // Rendered inside the directory dialog, whose header carries the title.
    <section className={styles.directory} aria-label={t("title")}>
      <p className={styles.muted}>
        {directory.total === undefined ? t("help") : t("count", { count: directory.total })}
      </p>
      <div className={styles.controlBar}>
        <div className={styles.statusTabs} role="group" aria-label={t("filters")}>
          <button
            type="button"
            aria-pressed={incentivesOnly}
            onClick={() => setIncentivesOnly(!incentivesOnly)}
          >
            {t("incentivesOnly")}
          </button>
          <button
            type="button"
            aria-pressed={includeIneligible}
            onClick={() => setIncludeIneligible(!includeIneligible)}
          >
            {t("includeIneligible")}
          </button>
        </div>
        <div className={styles.controlActions}>
          <label className={styles.search}>
            <span className={styles.srOnly}>{t("sort")}</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as Sort);
                setDirection("desc");
              }}
            >
              {(["incentives", "weight", "created"] as const).map((field) => (
                <option key={field} value={field}>
                  {t(`sortBy.${field}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.search}>
            <span className={styles.srOnly}>{t("search")}</span>
            <input
              type="search"
              value={search}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
      </div>
      {directory.changed && (
        <div className={styles.notice} role="status">
          {t("changed")}
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={directory.restart}
          >
            {t("restart")}
          </button>
        </div>
      )}

      <div className={compact ? styles.compactFrame : styles.tableFrame}>
        {compact ? (
          <section className={styles.compactPools} aria-label={t("title")}>
            {directory.pools.map((pool) => {
              const open = expanded.includes(pool.poolId);
              const name = directoryPoolName(deployment, pool);
              const detailId = `directory-${pool.poolId}`;
              return (
                <article key={pool.poolId} className={styles.compactPool}>
                  <div className={styles.compactPoolHeading}>
                    <button
                      type="button"
                      className={styles.compactPoolToggle}
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-label={t(open ? "collapse" : "expand", { pool: name })}
                      onClick={() => toggle(pool.poolId)}
                    >
                      <span className={styles.compactPoolName}>
                        <strong>{name}</strong>
                        <span className={styles.cellMeta}>{streamCount(pool)}</span>
                      </span>
                      {eligibility(pool)}
                      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                    </button>
                  </div>
                  {open && (
                    <div id={detailId} className={styles.compactPoolDetails}>
                      <dl className={styles.compactMetrics}>
                        <div>
                          <dt>{t("column.weight")}</dt>
                          <dd>{statics(pool.weight)}</dd>
                        </div>
                        <div>
                          <dt>{t("column.perThousand")}</dt>
                          <dd>{perThousand(pool)}</dd>
                        </div>
                        <div>
                          <dt>{t("column.yours")}</dt>
                          <dd>{yours(pool)}</dd>
                        </div>
                      </dl>
                      {streams(pool)}
                      <div className={styles.compactActions}>{allocate(pool)}</div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <table className={`${styles.positionsTable} ${styles.liquidityTable}`}>
            <colgroup>
              <col style={{ width: 280 }} />
              <col />
              <col />
              <col />
              <col />
              <col style={{ width: 140 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t("column.pool")}</th>
                <th scope="col" className={styles.numeric} aria-sort={ariaSort("weight")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => sortBy("weight")}
                  >
                    {t("column.weight")} {arrow("weight")}
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort("incentives")}>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => sortBy("incentives")}
                  >
                    {t("column.incentives")} {arrow("incentives")}
                  </button>
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.perThousand")}
                </th>
                <th scope="col" className={styles.numeric}>
                  {t("column.yours")}
                </th>
                <th scope="col">
                  <span className={styles.srOnly}>{t("column.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {directory.pools.map((pool) => {
                const open = expanded.includes(pool.poolId);
                const name = directoryPoolName(deployment, pool);
                return (
                  <Fragment key={pool.poolId}>
                    <tr>
                      <td>
                        <div className={styles.positionName}>
                          <button
                            type="button"
                            className={styles.expandButton}
                            aria-expanded={open}
                            aria-label={t(open ? "collapse" : "expand", { pool: name })}
                            onClick={() => toggle(pool.poolId)}
                          >
                            {open ? "▾" : "▸"}
                          </button>
                          <span>{name}</span>
                          {eligibility(pool)}
                        </div>
                      </td>
                      <td className={styles.numeric}>{statics(pool.weight)}</td>
                      <td>
                        <span className={styles.cellMeta}>{streamCount(pool)}</span>
                      </td>
                      <td className={styles.numeric}>{perThousand(pool)}</td>
                      <td className={styles.numeric}>{yours(pool)}</td>
                      <td className={styles.rowActions}>{allocate(pool)}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6}>{streams(pool)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {!directory.loading && directory.pools.length === 0 && !directory.unavailable && (
          <p className={styles.tableEmpty}>{t("empty")}</p>
        )}
        {directory.loading && <p className={styles.tableEmpty}>{t("loading")}</p>}
        {directory.unavailable && <p className={styles.tableEmpty}>{t("unavailable")}</p>}
        {directory.hasMore && (
          <div className={styles.loadMore}>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              disabled={directory.loadingMore}
              onClick={directory.loadMore}
            >
              {t("loadMore", {
                count: (directory.total ?? directory.pools.length) - directory.pools.length,
              })}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
