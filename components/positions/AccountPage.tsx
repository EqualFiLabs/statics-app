"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { buildClosePositionCall } from "@statics-protocol/sdk/phase-one";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { AccountStatement } from "./AccountStatement";
import { BatchRewardClaim } from "@/components/rewards/BatchRewardClaim";
import { RewardAmounts } from "@/components/rewards/RewardAmounts";
import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";
import { useAccount } from "@/hooks/useAccount";
import { useAppLocale } from "@/i18n/client";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { CloseItem } from "@/lib/positions/account-close";
import { NICKNAME_MAX_LENGTH, useAccountNicknames } from "@/lib/positions/nicknames";
import { rewardDisplay, rewardPoolName } from "@/lib/rewards/earn";
import { formatDuration } from "@/lib/rewards/time";
import earn from "@/components/rewards/earn.module.css";
import styles from "./accounts.module.css";

const tone = { attention: "warning", active: "positive", empty: "neutral" } as const;

/** One account (Position NFT): its balances, the actions on it, and closing it. */
export function AccountPage({
  deployment,
  positionId,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
}) {
  const t = useTranslations("accountPage");
  const locale = useAppLocale();
  const id = String(positionId);
  const account = useAccount(deployment, positionId);
  const { action, position, owned, summary, row, close } = account;
  const { nicknameOf, setNickname } = useAccountNicknames(
    deployment.descriptor.deploymentId,
    action.wallet
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameFailed, setRenameFailed] = useState(false);
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);
  const [closed, setClosed] = useState(false);
  const name = nicknameOf(positionId) ?? t("name", { id });
  const amount = (value: bigint, decimals: number | null) =>
    decimals === null
      ? t("baseUnits", { amount: String(value) })
      : rewardDisplay(value, decimals).display;
  const statics = (value: bigint) => `${amount(value, 18)} STATICS`;
  const date = (seconds: bigint) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      new Date(Number(seconds) * 1000)
    );
  const liquidityHref = (poolId?: string) =>
    `/app/liquidity?positionId=${id}${poolId ? `&poolId=${poolId}` : ""}`;
  const stakingHref = `/app/rewards/staking?positionId=${id}`;
  const unstakeHref = `${stakingHref}&mode=unstake`;
  const allocationsHref = `/app/rewards/allocations?positionId=${id}`;

  const closeAccount = () =>
    action.prepare(async () => ({
      label: t("close.title"),
      details: [t("close.review", { name })],
      execute: async () => {
        await action.send({
          kind: "phase-one-close-position",
          label: t("close.title"),
          amount: t("name", { id }),
          to: deployment.contracts.diamond,
          data: buildClosePositionCall(positionId),
        });
        setClosed(true);
      },
    }));

  const back = (
    <Link className={styles.back} href="/app/positions">
      ← {t("allAccounts")}
    </Link>
  );
  if (closed)
    return (
      <div className={styles.accountPage}>
        {back}
        <p className={earn.notice} role="status">
          {t("close.done", { name })}
        </p>
      </div>
    );
  if (!action.ready)
    return (
      <div className={styles.accountPage}>
        {back}
        <ActionReview action={action} />
      </div>
    );
  if (position.isError || (position.data && !owned))
    return (
      <div className={styles.accountPage}>
        {back}
        <p className={earn.notice} role="alert">
          {position.isError ? t("notFound", { id }) : t("notOwned", { id })}
        </p>
      </div>
    );
  if (!position.data || !summary)
    return (
      <div className={styles.accountPage}>
        {back}
        <p className={earn.muted} role="status">
          {t("loading")}
        </p>
      </div>
    );

  const allocation = row?.allocation;
  const cooling =
    allocation && account.now !== undefined && allocation.nextAllocationAt > account.now
      ? allocation.nextAllocationAt - account.now
      : undefined;
  const free =
    position.data.stakedBalance > (allocation?.lockedStake ?? 0n)
      ? position.data.stakedBalance - (allocation?.lockedStake ?? 0n)
      : 0n;
  const stale =
    allocation && allocation.totalAllocated > allocation.lockedStake
      ? allocation.totalAllocated - allocation.lockedStake
      : 0n;
  const closeItem = (item: CloseItem) => {
    switch (item.kind) {
      case "withdraw-liquidity":
        return {
          text: t("close.item.withdraw", { pool: rewardPoolName(deployment, item.poolId) }),
          href: liquidityHref(item.poolId),
        };
      case "resolve-liquidity":
        return {
          text: t("close.item.resolve", { pool: rewardPoolName(deployment, item.poolId) }),
          href: liquidityHref(item.poolId),
        };
      case "remove-allocations":
        return {
          text: t("close.item.allocations", { amount: statics(item.amount) }),
          href: allocationsHref,
        };
      case "unstake":
        return {
          text: t("close.item.unstake", { amount: statics(item.amount) }),
          href: unstakeHref,
        };
      case "collect-rewards":
        return { text: t("close.item.collect"), href: "#account-rewards" };
      case "stop-earning":
        return { text: t("close.item.stopEarning", { count: item.count }), href: stakingHref };
      case "obligations":
        return { text: t("close.item.obligations", { count: String(item.count) }), href: null };
      case "other":
        return { text: t("close.item.other", { count: String(item.count) }), href: null };
    }
  };

  return (
    <div className={styles.accountPage}>
      {back}
      <header className={styles.accountHeader}>
        <span className={styles.badge} aria-hidden="true">
          #{id}
        </span>
        <div className={styles.accountTitle}>
          {renaming === null ? (
            <h2>
              {name}{" "}
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => {
                  setRenameFailed(false);
                  setRenaming(nicknameOf(positionId) ?? "");
                }}
              >
                {t("rename")}
              </button>
            </h2>
          ) : (
            <form
              className={styles.rename}
              onSubmit={(event) => {
                event.preventDefault();
                const saved = setNickname(positionId, renaming);
                setRenameFailed(!saved);
                if (saved) setRenaming(null);
              }}
            >
              <label>
                <span className={earn.srOnly}>{t("nickname")}</span>
                <input
                  autoFocus
                  value={renaming}
                  maxLength={NICKNAME_MAX_LENGTH}
                  placeholder={t("name", { id })}
                  onChange={(event) => setRenaming(event.target.value)}
                />
              </label>
              <button type="submit" className="ui-button ui-button--primary ui-button--sm">
                {t("save")}
              </button>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() => setRenaming(null)}
              >
                {t("cancel")}
              </button>
              <span className={earn.cellMeta}>
                {renameFailed ? t("renameFailed") : t("nicknameHelp")}
              </span>
            </form>
          )}
          <span className={earn.cellMeta}>
            {[
              t("nft", { id }),
              account.openedAt !== null ? t("opened", { date: date(account.openedAt) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <div className={styles.status}>
          <span className={earn.statusPill} data-tone={tone[summary.status]}>
            {t(`status.${summary.status}`)}
          </span>
          {summary.rewardsReady && (
            <span className={earn.statusPill} data-tone="positive">
              {t("rewardsReady")}
            </span>
          )}
        </div>
      </header>
      {summary.attention.length > 0 && (
        <ul className={styles.attentionList}>
          {summary.attention.map((item) => (
            <li key={item}>{t(`attention.${item}`)}</li>
          ))}
        </ul>
      )}

      <nav className={styles.accountActions} aria-label={t("actions")}>
        <button
          type="button"
          className="ui-button ui-button--primary"
          aria-haspopup="dialog"
          onClick={() => setSheet("deposit")}
        >
          {t("deposit")}
        </button>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          aria-haspopup="dialog"
          onClick={() => setSheet("withdraw")}
        >
          {t("withdraw")}
        </button>
        <a className="ui-button ui-button--secondary" href="#account-rewards">
          {t("collect")}
        </a>
        <Link className="ui-button ui-button--secondary" href={stakingHref}>
          {t("manageEarning")}
        </Link>
      </nav>
      {sheet && (
        <ReviewDrawer
          title={t(`${sheet}Title`, { name })}
          variant="modal"
          onClose={() => setSheet(null)}
        >
          <div className={styles.sheetOptions}>
            <Link className={styles.sheetOption} href={liquidityHref()}>
              <strong>{t(`${sheet}Liquidity`)}</strong>
              <span className={earn.cellMeta}>{t(`${sheet}LiquidityHelp`)}</span>
            </Link>
            <Link
              className={styles.sheetOption}
              href={sheet === "withdraw" ? unstakeHref : stakingHref}
            >
              <strong>{t(`${sheet}Stake`)}</strong>
              <span className={earn.cellMeta}>{t(`${sheet}StakeHelp`)}</span>
            </Link>
          </div>
        </ReviewDrawer>
      )}

      <div className={styles.balances}>
        <section className={styles.balanceCard} aria-labelledby="account-liquidity">
          <div className={styles.cardHeading}>
            <h3 id="account-liquidity">{t("liquidity.title")}</h3>
            <Link href={liquidityHref()}>{t("manage")} ›</Link>
          </div>
          {account.liquidityUnavailable && account.liquidity.length > 0 && (
            <p className={earn.cellMeta} role="alert">
              {t("unavailable")}
            </p>
          )}
          {account.liquidity.length === 0 ? (
            <p className={earn.muted}>
              {account.liquidityLoading
                ? t("loading")
                : account.liquidityUnavailable
                  ? t("unavailable")
                  : t("liquidity.none")}
            </p>
          ) : (
            <ul className={styles.balanceList}>
              {account.liquidity.map(
                ({ leg, tokens, held, fees, feesLoading, feesUnavailable }) => (
                  <li key={leg.poolId}>
                    <div className={styles.cardHeading}>
                      <Link href={liquidityHref(leg.poolId)}>
                        <strong>
                          {tokens
                            ? `${tokens[0].symbol} / ${tokens[1].symbol}`
                            : rewardPoolName(deployment, leg.poolId)}
                        </strong>
                      </Link>
                      {held && (
                        <span
                          className={earn.statusPill}
                          data-tone={held.inRange ? "positive" : "warning"}
                        >
                          {t(held.inRange ? "liquidity.inRange" : "liquidity.outOfRange")}
                        </span>
                      )}
                    </div>
                    {held && tokens ? (
                      <span className={styles.holdings}>
                        <span className={styles.holding}>
                          <strong>{amount(held.amount0, tokens[0].decimals)}</strong>{" "}
                          <small>{tokens[0].symbol}</small>
                        </span>
                        <span className={styles.holding}>
                          <strong>{amount(held.amount1, tokens[1].decimals)}</strong>{" "}
                          <small>{tokens[1].symbol}</small>
                        </span>
                      </span>
                    ) : (
                      <span className={earn.cellMeta}>…</span>
                    )}
                    {(feesLoading || feesUnavailable) && (
                      <span className={earn.cellMeta} role={feesUnavailable ? "alert" : "status"}>
                        {t(feesUnavailable ? "liquidity.feesUnavailable" : "liquidity.feesLoading")}
                      </span>
                    )}
                    {fees && tokens && (fees.amount0 > 0n || fees.amount1 > 0n) && (
                      <span className={earn.cellMeta}>
                        {t("liquidity.fees", {
                          amount0: `${amount(fees.amount0, tokens[0].decimals)} ${tokens[0].symbol}`,
                          amount1: `${amount(fees.amount1, tokens[1].decimals)} ${tokens[1].symbol}`,
                        })}
                      </span>
                    )}
                  </li>
                )
              )}
            </ul>
          )}
        </section>

        <section className={styles.balanceCard} aria-labelledby="account-staking">
          <div className={styles.cardHeading}>
            <h3 id="account-staking">{t("staking.title")}</h3>
            <Link href={stakingHref}>{t("manage")} ›</Link>
          </div>
          <p className={styles.bigAmount}>
            <strong>{amount(position.data.stakedBalance, 18)}</strong> <small>STATICS</small>
          </p>
          {account.stakingUnavailable && (
            <p className={earn.cellMeta} role="alert">
              {t("unavailable")}
            </p>
          )}
          <dl className={styles.facts}>
            <div>
              <dt>{t("staking.allocated")}</dt>
              <dd>
                {allocation ? (
                  <Link href={allocationsHref}>{statics(allocation.lockedStake)}</Link>
                ) : (
                  "…"
                )}
              </dd>
            </div>
            <div>
              <dt>{t("staking.free")}</dt>
              <dd>{allocation ? statics(free) : "…"}</dd>
            </div>
            {stale > 0n && (
              <div>
                <dt>{t("staking.stale")}</dt>
                <dd className={styles.warningText}>{statics(stale)}</dd>
              </div>
            )}
            {cooling !== undefined && (
              <div>
                <dt>{t("staking.cooldown")}</dt>
                <dd>{t("staking.reduceOnly", { time: formatDuration(cooling) })}</dd>
              </div>
            )}
            <div>
              <dt>{t("staking.earning")}</dt>
              <dd>
                {row?.selectedAssets
                  ? row.selectedAssets.length
                    ? t("staking.assets", { count: row.selectedAssets.length })
                    : t("staking.nothing")
                  : "…"}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className={styles.balanceCard}
          id="account-rewards"
          aria-labelledby="account-rewards-title"
        >
          <div className={styles.cardHeading}>
            <h3 id="account-rewards-title">{t("rewards.title")}</h3>
            <BatchRewardClaim
              key={`account:${id}`}
              deployment={deployment}
              rows={account.rewardRows}
              loading={account.rewardsLoading}
              incomplete={account.rewardsIncomplete}
              scope={account.rewardScope}
              scopeKey={`account:${id}`}
              label={t("collect")}
            />
          </div>
          {account.rewards.some((entry) => entry.amount > 0n) ? (
            <dl className={styles.facts}>
              {(["staking", "liquidity", "allocations"] as const).map((source) =>
                account.rewardsBySource[source].some((entry) => entry.amount > 0n) ? (
                  <div key={source}>
                    <dt>{t(`rewards.${source}`)}</dt>
                    <dd>
                      <RewardAmounts
                        deployment={deployment}
                        amounts={account.rewardsBySource[source]}
                        preview
                      />
                    </dd>
                  </div>
                ) : null
              )}
            </dl>
          ) : (
            <p className={earn.muted}>
              {account.rewardsLoading ? t("loading") : t("rewards.none")}
            </p>
          )}
          {account.rewardsIncomplete && (
            <p className={earn.cellMeta} role="alert">
              {t("unavailable")}
            </p>
          )}
        </section>
      </div>

      <AccountStatement deployment={deployment} positionId={positionId} wallet={action.wallet} />

      <section className={styles.closeSection} aria-labelledby="account-close">
        <div>
          <h3 id="account-close">{t("close.title")}</h3>
          <p className={earn.muted}>{t("close.help")}</p>
        </div>
        {close && close.items.length > 0 && (
          <ol className={styles.checklist} aria-label={t("close.checklist")}>
            {close.items.map((item, index) => {
              const entry = closeItem(item);
              return (
                <li key={`${item.kind}:${index}`}>
                  {entry.href ? <Link href={entry.href}>{entry.text}</Link> : entry.text}
                </li>
              );
            })}
          </ol>
        )}
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={!close?.ready || action.busy}
          onClick={() => void closeAccount()}
        >
          {t("close.button")}
        </button>
        {close?.ready && <p className={earn.cellMeta}>{t("close.ready")}</p>}
        <ActionReview action={action} />
      </section>
    </div>
  );
}
