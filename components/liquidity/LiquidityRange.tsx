"use client";

import { useTranslations } from "next-intl";
import { useAppLocale } from "@/i18n/client";
import { rangeMarker } from "@/lib/phase-one/liquidity-preview";

export function LiquidityRange({
  current,
  lower,
  upper,
  fullRange,
  symbol,
  inRange,
}: {
  current: number;
  lower: number;
  upper: number;
  fullRange: boolean;
  symbol: string;
  inRange: boolean;
}) {
  const t = useTranslations("liquidityUx");
  const locale = useAppLocale();
  const marker = fullRange ? 50 : rangeMarker(current, lower, upper);
  return (
    <div
      className="liquidity-range-visual"
      role="img"
      aria-label={t("rangeDescription", { current: String(current), symbol })}
    >
      <div className="liquidity-range-status">
        <span>{t("currentPrice")}</span>
        <strong>
          {new Intl.NumberFormat(locale, { maximumSignificantDigits: 7 }).format(current)} {symbol}
        </strong>
      </div>
      <div className="liquidity-range-track">
        <div className="liquidity-range-band" />
        <div className="liquidity-range-marker" style={{ left: `${marker}%` }}>
          <span />
        </div>
      </div>
      <div className="liquidity-range-endpoints">
        <span>
          {fullRange
            ? "0"
            : new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(lower)}
        </span>
        <span>
          {fullRange
            ? "∞"
            : new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(upper)}
        </span>
      </div>
      <p className={inRange ? "liquidity-status" : "liquidity-status is-out"}>
        {t(inRange ? "inRange" : "outOfRange")}
      </p>
      <p className="liquidity-muted">
        {t(fullRange ? "fullRangeHelp" : inRange ? "customRangeHelp" : "singleSidedHelp")}
      </p>
    </div>
  );
}
