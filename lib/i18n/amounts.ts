import { parseUnits } from "viem";

import type { AppLocale } from "@/i18n/config";

export function normalizeLocalizedDecimal(value: string, locale: AppLocale): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[\s_]/.test(trimmed)) return null;

  const hasDot = trimmed.includes(".");
  const hasComma = trimmed.includes(",");
  if (hasDot && hasComma) return null;
  if (hasComma && locale !== "es") return null;

  const normalized = hasComma ? trimmed.replace(",", ".") : trimmed;
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  return normalized;
}

export function parseLocalizedUnits(value: string, decimals: number, locale: AppLocale): bigint {
  const normalized = normalizeLocalizedDecimal(value, locale);
  if (normalized === null) throw new Error("invalid localized decimal");
  return normalized ? parseUnits(normalized, decimals) : 0n;
}
