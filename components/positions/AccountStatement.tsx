"use client";
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccountStatement } from "@/hooks/useAccountStatement";
import { useAppLocale } from "@/i18n/client";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  STATEMENT_FILTERS,
  groupByDay,
  isAccountingEntry,
  isPriorOwnerEntry,
  ownershipStart,
  walletAmounts,
  type StatementAmount,
  type StatementFilter,
  type StatementItem,
} from "@/lib/positions/statement";
import { rewardDisplay, rewardPoolName, rewardToken } from "@/lib/rewards/earn";
import { getTransactionExplorerUrl } from "@/lib/wallet-config";
import earn from "@/components/rewards/earn.module.css";
import styles from "./accounts.module.css";

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

/** An account's history, like a bank statement: one line per action, newest first. */
export function AccountStatement({
  deployment,
  positionId,
  wallet,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
  wallet: string | null;
}) {
  const t = useTranslations("accountStatement");
  const locale = useAppLocale();
  const [filter, setFilter] = useState<StatementFilter>("all");
  const [accounting, setAccounting] = useState(false);
  const statement = useAccountStatement(deployment, positionId, filter, Boolean(wallet));
  const shown = statement.items.filter((item) => accounting || !isAccountingEntry(item));
  const hidden = statement.items.length - shown.length;
  const handover = ownershipStart(statement.items, wallet);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const date = (seconds: bigint | number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(Number(seconds) * 1000)
    );
  const pool = (item: StatementItem) =>
    item.poolId ? rewardPoolName(deployment, item.poolId) : "";
  const asset = (address: `0x${string}`) =>
    rewardToken(deployment, address)?.symbol ?? short(address);

  const describe = (item: StatementItem): { title: string; detail?: string } => {
    // The parser validated each payload against its event ABI; read the fields used here.
    const payload = item.payload as Record<string, unknown>;
    const field = <T,>(name: string) => payload[name] as T;
    switch (item.eventName) {
      case "Transfer":
        return item.ownerAfter?.toLowerCase() === wallet?.toLowerCase()
          ? { title: t("event.transferIn", { from: short(field<string>("from")) }) }
          : { title: t("event.transferOut", { to: short(field<string>("to")) }) };
      case "ManagedLiquidityChanged": {
        const movement = field<{ liquidityBefore: bigint; liquidityAfter: bigint }>("movement");
        return {
          title: t(
            movement.liquidityAfter > movement.liquidityBefore
              ? "event.liquidityAdded"
              : "event.liquidityRemoved",
            { pool: pool(item) }
          ),
        };
      }
      case "PositionGaugeAllocationsSet": {
        const pools = field<readonly string[]>("poolIds");
        return pools.length
          ? {
              title: t("event.allocationsSet"),
              detail: t("allocationDetail", {
                count: pools.length,
                amount: rewardDisplay(field<bigint>("totalAllocated"), 18).display,
              }),
            }
          : { title: t("event.allocationsCleared") };
      }
      case "PositionGaugeAllocationCooldownExtended":
        return {
          title: t("event.PositionGaugeAllocationCooldownExtended"),
          detail: t("until", { date: date(field<number | bigint>("nextAllocationAt")) }),
        };
      case "RewardAssetOptedIn":
      case "RewardAssetOptedOut":
      case "RewardStakeScheduled":
      case "PositionRewardEligibilityActivated":
      case "PositionRewardWeightChanged":
      case "PositionRewardSettled":
        return {
          title: t(`event.${item.eventName}`, { asset: asset(field<`0x${string}`>("asset")) }),
        };
      default:
        return { title: t(`event.${item.eventName}`, { pool: pool(item) }) };
    }
  };
  const amountText = (entry: StatementAmount) => {
    const symbol = entry.symbol ?? (entry.native ? "ETH" : short(entry.address));
    const value =
      entry.decimals === null && !entry.native
        ? t("baseUnits", { amount: String(entry.amount) })
        : rewardDisplay(entry.amount, entry.decimals ?? 18).display;
    return `${entry.direction === "out" ? "−" : "+"}${value} ${symbol}`;
  };

  return (
    <section className={styles.statement} aria-labelledby="account-statement">
      <div className={styles.cardHeading}>
        <h3 id="account-statement">{t("title")}</h3>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={accounting}
            onChange={(event) => setAccounting(event.target.checked)}
          />
          {t("showAccounting")}
        </label>
      </div>
      <div className={earn.statusTabs} role="group" aria-label={t("filterLabel")}>
        {STATEMENT_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(`filter.${value}`)}
          </button>
        ))}
      </div>

      {statement.changed ? (
        <p className={earn.notice} role="alert">
          {t("changed")}{" "}
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={statement.restart}
          >
            {t("restart")}
          </button>
        </p>
      ) : statement.unavailable ? (
        <p className={earn.notice} role="alert">
          {t("unavailable")}
        </p>
      ) : statement.loading ? (
        <p className={earn.muted} role="status">
          {t("loading")}
        </p>
      ) : shown.length === 0 ? (
        <p className={earn.muted}>
          {hidden > 0 ? t("onlyAccounting", { count: hidden }) : t("empty")}
        </p>
      ) : (
        groupByDay(shown, locale).map((group) => (
          <div key={group.label} className={styles.statementDay}>
            <h4>{group.label}</h4>
            <ol className={styles.statementList}>
              {group.items.map((item) => {
                const { title, detail } = describe(item);
                const amounts = walletAmounts(item, accounting);
                const link = getTransactionExplorerUrl(
                  deployment.descriptor.chainId,
                  item.transactionHash
                );
                return (
                  <Fragment key={item.key}>
                    <li
                      className={styles.statementEntry}
                      data-accounting={isAccountingEntry(item) || undefined}
                    >
                      <span className={styles.statementWhat}>
                        <strong>{title}</strong>
                        <span className={earn.cellMeta}>
                          {time.format(new Date(Number(item.timestamp) * 1000))}
                          {detail ? ` · ${detail}` : ""}
                          {isPriorOwnerEntry(item, wallet) ? ` · ${t("priorOwner")}` : ""}
                          {" · "}
                          {link ? (
                            <a href={link} target="_blank" rel="noreferrer">
                              {t("transaction")}
                            </a>
                          ) : (
                            <span title={item.transactionHash}>
                              {t("transactionHash", { hash: short(item.transactionHash) })}
                            </span>
                          )}
                        </span>
                      </span>
                      {amounts.length > 0 && (
                        <span className={styles.statementAmounts}>
                          {amounts.map((entry, index) => (
                            <span key={index} data-direction={entry.direction}>
                              {amountText(entry)}
                              {entry.space !== "wallet" ? (
                                <small className={earn.cellMeta}>{t(`space.${entry.space}`)}</small>
                              ) : entry.actor &&
                                (entry.purpose === "creation-fee" ||
                                  entry.actor.toLowerCase() !==
                                    (item.ownerBefore ?? item.ownerAfter)?.toLowerCase()) ? (
                                <small className={earn.cellMeta} title={entry.actor}>
                                  {t(entry.direction === "out" ? "paidBy" : "receivedBy", {
                                    address: short(entry.actor),
                                  })}
                                </small>
                              ) : null}
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                    {item.key === handover && statement.items.at(-1)?.key !== item.key && (
                      <li className={styles.statementDivider} role="separator">
                        {t("beforeYou")}
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ol>
          </div>
        ))
      )}
      {statement.hasMore && !statement.changed && (
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          disabled={statement.loadingMore}
          onClick={statement.loadMore}
        >
          {statement.loadingMore ? t("loading") : t("loadMore")}
        </button>
      )}
    </section>
  );
}
