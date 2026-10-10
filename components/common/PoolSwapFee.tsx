"use client";

import { useLocale, useTranslations } from "next-intl";
import { swapFeePercent, type HookFeeRate } from "@/lib/phase-one/swap-fees";

export function PoolSwapFee({
  lpFee,
  source,
  hook,
  className,
}: {
  lpFee: number;
  source: "phase-one" | "genesis";
  hook: HookFeeRate | null;
  className?: string;
}) {
  const t = useTranslations("dexOverview");
  const locale = useLocale();
  const percent = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(
      value
    );
  const fee = swapFeePercent(lpFee, source === "genesis" ? { inputBps: 0, outputBps: 0 } : hook);
  if (fee.total === null) return <span className={className}>{t("feeUnavailable")}</span>;
  const breakdown =
    hook && fee.statics !== null && fee.statics > 0
      ? t("feeBreakdown", {
          lp: percent(fee.lp),
          input: percent(hook.inputBps / 100),
          output: percent(hook.outputBps / 100),
        })
      : undefined;
  return (
    <span className={className} title={breakdown}>
      {t(breakdown ? "approximateFee" : "fee", { fee: percent(fee.total) })}
      {breakdown && <span className="sr-only"> ({breakdown})</span>}
    </span>
  );
}
