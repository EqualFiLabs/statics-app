"use client";
import { useTranslations } from "next-intl";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { RewardAmount } from "@/lib/phase-one/reward-portfolio";
import { rewardDisplay, rewardToken } from "@/lib/rewards/earn";
import styles from "./earn.module.css";
export function RewardAmounts({
  deployment,
  amounts,
  preview = false,
  empty = true,
  includeZero = false,
}: {
  deployment: PhaseOneDeployment;
  amounts: readonly RewardAmount[];
  preview?: boolean;
  empty?: boolean;
  includeZero?: boolean;
}) {
  const t = useTranslations("earnUx"),
    positive = amounts.filter((entry) => includeZero || entry.amount > 0n),
    visible = preview ? positive.slice(0, 3) : positive;
  if (!positive.length)
    return empty ? <span className={styles.muted}>{t("noRewards")}</span> : null;
  return (
    <div className={styles.assets}>
      {visible.map(({ asset, amount }) => {
        const token = rewardToken(deployment, asset),
          display = token
            ? rewardDisplay(amount, token.decimals)
            : { display: String(amount), exact: String(amount) };
        return (
          <details className={styles.amountDisclosure} key={asset}>
            <summary
              className={styles.amount}
              title={`${display.exact} ${token?.symbol ?? t("rawUnits")} · ${asset}`}
            >
              <span>{display.display}</span>
              <small>
                {token?.symbol ?? `${t("rawUnits")} (${asset.slice(0, 6)}…${asset.slice(-4)})`}
              </small>
            </summary>
            <div className={styles.exact}>
              {display.exact} {token?.symbol ?? t("rawUnits")}
              <br />
              {asset}
            </div>
          </details>
        );
      })}
      {preview && positive.length > 3 && (
        <span className={styles.badge}>{t("moreAssets", { count: positive.length - 3 })}</span>
      )}
    </div>
  );
}
