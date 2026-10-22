import { formatUnits } from "viem";
import type { DexQuoteCurrency } from "@/lib/indexer/dex-market";

export type QuoteToken = DexQuoteCurrency;

/** A compact count or amount; tiny positive values switch to scientific rather than show 0. */
export function compactNumber(locale: string, value: number, digits = 2): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: digits,
    ...(value > 0 && value < 10 ** -digits
      ? { notation: "scientific" as const, maximumSignificantDigits: 4 }
      : {}),
  }).format(value);
}

/**
 * A quote-currency amount: "≈ $1.07M" in USDG, "412.6 WETH" in WETH. Prices keep four
 * significant digits however small; totals are compact. Null means unpriced and shows "—".
 */
export function quoteAmount(
  locale: string,
  value: bigint | null | undefined,
  q: QuoteToken | null | undefined,
  price = false
): string {
  if (value === null || value === undefined || !q) return "—";
  const amount = Number(formatUnits(value, q.decimals ?? 18));
  const fraction =
    price && amount > 0 && amount < 1 ? Math.min(12, Math.ceil(-Math.log10(amount)) + 3) : 2;
  if (q.kind === "usdg" || q.kind === "usd")
    return `${q.kind === "usdg" ? "≈ " : ""}${new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      notation: price ? "standard" : "compact",
      minimumFractionDigits: price ? Math.min(2, fraction) : 0,
      maximumFractionDigits: price ? fraction : 2,
      ...(amount > 0 && amount < (price ? 0.000000000001 : 0.01)
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
      : compactNumber(locale, amount, 3)
  } WETH`;
}
