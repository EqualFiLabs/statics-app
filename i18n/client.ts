"use client";

import { useLocale } from "next-intl";

import { defaultLocale, isAppLocale, type AppLocale } from "./config";

export function useAppLocale(): AppLocale {
  const locale = useLocale();
  return isAppLocale(locale) ? locale : defaultLocale;
}
