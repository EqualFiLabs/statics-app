"use client";

import { useTranslations } from "next-intl";
import { swapFeePercent, type HookFeeRate } from "@/lib/phase-one/swap-fees";
import styles from "./dex.module.css";

export function PoolSwapFee({
  lpFee,
  source,
  hook,
}: {
  lpFee: number;
  source: "phase-one" | "genesis";
  hook: HookFeeRate | null;
}) {
  const t = useTranslations("dexOverview");
  const fee = swapFeePercent(lpFee, source === "genesis" ? { inputBps: 0, outputBps: 0 } : hook);
  if (fee.total === null) return <span className={styles.muted}>{t("feeUnavailable")}</span>;
  const breakdown =
    hook && fee.statics !== null && fee.statics > 0
      ? t("feeBreakdown", {
          lp: fee.lp.toFixed(2),
          input: (hook.inputBps / 100).toFixed(2),
          output: (hook.outputBps / 100).toFixed(2),
        })
      : undefined;
  return (
    <span className={styles.muted} title={breakdown}>
      {t(breakdown ? "approximateFee" : "fee", { fee: fee.total.toFixed(2) })}
      {breakdown && <span className={styles.srOnly}> ({breakdown})</span>}
    </span>
  );
}
