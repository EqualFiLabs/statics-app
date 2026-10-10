"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { formatEther, parseEventLogs } from "viem";
import { buildCreatePositionCall, staticsAbi } from "@statics-protocol/sdk/phase-one";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { useAccounts } from "@/hooks/useAccounts";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  sortAccounts,
  type AccountFilter,
  type AccountSort,
  type AccountSummary,
} from "@/lib/positions/accounts";
import { useAccountNicknames } from "@/lib/positions/nicknames";
import { rewardDisplay } from "@/lib/rewards/earn";
import { waitForIndexedPosition } from "@/lib/rewards/indexed-position";
import earn from "@/components/rewards/earn.module.css";
import styles from "./accounts.module.css";

const PAGE = 10;
const FILTERS: readonly AccountFilter[] = ["all", "attention", "active", "empty"];
const SORTS: readonly AccountSort[] = ["newest", "oldest", "stake"];
const HOLDINGS_SHOWN = 3;
const tone = { attention: "warning", active: "positive", empty: "neutral" } as const;

/**
 * Accounts are Position NFTs: this page lists them like bank accounts and opens or closes them.
 * Earning across accounts is managed in Earn; each row opens that account's own page.
 */
export function AccountsPage({ deployment }: { deployment: PhaseOneDeployment }) {
  const t = useTranslations("accounts");
  const id = deployment.descriptor.deploymentId;
  const queryClient = useQueryClient();
  const { action, positions, accounts, loading, rewardsLoaded, unavailable } =
    useAccounts(deployment);
  const { nicknameOf } = useAccountNicknames(id, action.wallet);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [sort, setSort] = useState<AccountSort>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const fee = useQuery({
    queryKey: ["phase-one-creation-fee", id],
    enabled: action.ready,
    staleTime: 60_000,
    queryFn: () =>
      action.publicClient!.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "positionCreationFee",
      }),
  });
  const open = () =>
    action.prepare(async () => {
      if (!action.publicClient || !action.wallet) throw new Error(t("connect"));
      const creationFee = await action.publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "positionCreationFee",
      });
      return {
        label: t("open"),
        details: [t("fee", { fee: formatEther(creationFee) })],
        execute: async () => {
          let created: bigint | null = null;
          await action.send({
            kind: "phase-one-create-position",
            label: t("open"),
            amount: `${formatEther(creationFee)} ETH`,
            to: deployment.contracts.diamond,
            data: buildCreatePositionCall(action.wallet!),
            value: creationFee,
            verifyConfirmation: async (receipt) => {
              const event = parseEventLogs({
                abi: staticsAbi,
                logs: receipt.logs,
                eventName: "PositionCreated",
              }).find(
                (entry) =>
                  entry.address.toLowerCase() === deployment.contracts.diamond.toLowerCase()
              );
              if (event) {
                created = event.args.positionId;
                setCreatedId(created);
              }
            },
          });
          // The list comes from the indexer, which can trail the receipt.
          if (created !== null)
            await waitForIndexedPosition({
              queryClient,
              deploymentId: id,
              wallet: action.wallet!,
              positionId: created,
            });
        },
      };
    });

  const nameOf = (positionId: bigint) =>
    nicknameOf(positionId) ?? t("accountName", { id: String(positionId) });
  const query = search.trim().replace(/^#/, "").toLowerCase();
  const matching = accounts.filter(
    (account) =>
      !query ||
      String(account.positionId).includes(query) ||
      (nicknameOf(account.positionId)?.toLowerCase().includes(query) ?? false)
  );
  const count = (value: AccountFilter) =>
    value === "all"
      ? matching.length
      : matching.filter((account) => account.status === value).length;
  const visible = sortAccounts(
    matching.filter((account) => filter === "all" || account.status === filter),
    sort
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * PAGE, (current + 1) * PAGE);
  const ready = accounts.filter((account) => account.rewardsReady).length;
  const amount = (value: bigint, decimals: number | null) =>
    decimals === null
      ? t("baseUnits", { amount: String(value) })
      : rewardDisplay(value, decimals).display;

  const holdings = (account: AccountSummary) => {
    if (!account.holdings.length)
      return (
        <span className={earn.cellMeta}>
          {account.holdingsComplete ? t("noHoldings") : t("loading")}
        </span>
      );
    const listed = account.holdings.slice(0, HOLDINGS_SHOWN);
    return (
      <span className={styles.holdings}>
        {listed.map((holding) => (
          <span key={holding.asset.address} className={styles.holding}>
            <strong>{amount(holding.amount, holding.asset.decimals)}</strong>{" "}
            <small>{holding.asset.symbol}</small>
          </span>
        ))}
        {account.holdings.length > HOLDINGS_SHOWN && (
          <span className={earn.cellMeta}>
            {t("moreHoldings", { count: account.holdings.length - HOLDINGS_SHOWN })}
          </span>
        )}
        {!account.holdingsComplete && <span className={earn.cellMeta}>…</span>}
      </span>
    );
  };
  const usage = (account: AccountSummary) =>
    [
      account.liquidityCount
        ? account.outOfRange
          ? t("liquidityOut", { count: account.liquidityCount, out: account.outOfRange })
          : t("liquidity", { count: account.liquidityCount })
        : null,
      account.staked > 0n
        ? account.allocated > 0n
          ? t("stakedAllocated", {
              staked: amount(account.staked, 18),
              allocated: amount(account.allocated, 18),
            })
          : t("staked", { staked: amount(account.staked, 18) })
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || t("nothingInUse");

  return (
    <section className={styles.accounts} aria-label={t("listLabel")}>
      <div className={styles.toolbar}>
        <p className={styles.overview} role="status">
          {positions.isSuccess || accounts.length
            ? [
                t("overviewAccounts", { count: accounts.length }),
                count("attention") && filter === "all" && !query
                  ? t("overviewAttention", { count: count("attention") })
                  : null,
                accounts.some((account) => account.status === "empty")
                  ? t("overviewEmpty", {
                      count: accounts.filter((account) => account.status === "empty").length,
                    })
                  : null,
                rewardsLoaded && ready ? t("overviewRewards", { count: ready }) : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : t("loading")}
        </p>
        <div className={styles.openAccount}>
          <button
            type="button"
            className="ui-button ui-button--primary"
            disabled={!action.ready || action.busy}
            onClick={() => void open()}
          >
            {action.busy ? t("opening") : t("open")}
          </button>
          {fee.data !== undefined && (
            <small className={earn.cellMeta}>{t("fee", { fee: formatEther(fee.data) })}</small>
          )}
        </div>
      </div>
      <ActionReview action={action} />
      {createdId !== null && (
        <Link className={styles.created} href={`/app/positions/${createdId}`}>
          {t("created", { name: t("accountName", { id: String(createdId) }) })} ›
        </Link>
      )}
      {unavailable && (
        <p className={earn.notice} role="alert">
          {t("unavailable")}
        </p>
      )}

      {accounts.length > 0 && (
        <div className={earn.controlBar}>
          <div className={earn.statusTabs} role="group" aria-label={t("filterLabel")}>
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
              >
                {t(`filter.${value}`)} <span className={earn.tabCount}>{count(value)}</span>
              </button>
            ))}
          </div>
          <label className={earn.search}>
            <span className={earn.srOnly}>{t("search")}</span>
            <input
              type="search"
              value={search}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className={styles.sort}>
            <span className={earn.srOnly}>{t("sortLabel")}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as AccountSort)}>
              {SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(`sort.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {positions.isSuccess && accounts.length === 0 && !loading ? (
        <div className={styles.empty}>
          <h2>{t("emptyTitle")}</h2>
          <p className={earn.muted}>{t("emptyHelp")}</p>
        </div>
      ) : (
        accounts.length > 0 && (
          <>
            <div className={styles.listHead} aria-hidden="true">
              <span>{t("column.account")}</span>
              <span>{t("column.holdings")}</span>
              <span>{t("column.inUse")}</span>
              <span>{t("column.status")}</span>
            </div>
            {shown.length === 0 ? (
              <p className={earn.muted}>{t("noMatch")}</p>
            ) : (
              <ul className={styles.list}>
                {shown.map((account) => {
                  const nickname = nicknameOf(account.positionId);
                  return (
                    <li key={String(account.positionId)}>
                      <Link
                        className={styles.row}
                        href={`/app/positions/${account.positionId}`}
                        data-status={account.status}
                        aria-label={[
                          nameOf(account.positionId),
                          nickname ? t("nftName", { id: String(account.positionId) }) : null,
                          t(`status.${account.status}`),
                          account.rewardsReady ? t("rewardsReady") : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      >
                        <span className={styles.name}>
                          <span className={styles.badge} aria-hidden="true">
                            #{String(account.positionId)}
                          </span>
                          <span>
                            <strong>{nameOf(account.positionId)}</strong>
                            {nickname && (
                              <span className={earn.cellMeta}>
                                {t("nftName", { id: String(account.positionId) })}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className={styles.cell}>
                          <span className={styles.cellLabel}>{t("column.holdings")}</span>
                          {holdings(account)}
                        </span>
                        <span className={styles.cell}>
                          <span className={styles.cellLabel}>{t("column.inUse")}</span>
                          <span className={earn.cellMeta}>{usage(account)}</span>
                        </span>
                        <span className={styles.status}>
                          <span
                            className={earn.statusPill}
                            data-tone={tone[account.status]}
                            title={
                              account.attention.length
                                ? account.attention.map((item) => t(`attention.${item}`)).join(" ")
                                : undefined
                            }
                          >
                            {t(`status.${account.status}`)}
                          </span>
                          {account.rewardsReady && (
                            <span className={earn.statusPill} data-tone="positive">
                              {t("rewardsReady")}
                            </span>
                          )}
                          <span className={styles.chevron} aria-hidden="true">
                            ›
                          </span>
                        </span>
                        {account.attention.length > 0 && (
                          <span className={styles.attention}>
                            {account.attention.map((item) => t(`attention.${item}`)).join(" ")}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {visible.length > PAGE && (
              <div className={earn.pickerPager}>
                <button
                  type="button"
                  className="ui-button ui-button--secondary ui-button--sm"
                  aria-label={t("previousPage")}
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  ‹
                </button>
                <span className={earn.cellMeta}>
                  {t("pageRange", {
                    from: current * PAGE + 1,
                    to: Math.min((current + 1) * PAGE, visible.length),
                    total: visible.length,
                  })}
                </span>
                <button
                  type="button"
                  className="ui-button ui-button--secondary ui-button--sm"
                  aria-label={t("nextPage")}
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
