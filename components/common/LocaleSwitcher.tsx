"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { isAppLocale, localeLabels, supportedLocales, type AppLocale } from "@/i18n/config";

export function LocaleSwitcher({ className }: { className?: string }) {
  const activeLocale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);
  const [error, setError] = useState(false);
  const locale = isAppLocale(activeLocale) ? activeLocale : "en";

  const changeLocale = async (nextLocale: AppLocale) => {
    if (nextLocale === locale || pendingLocale) return;
    setPendingLocale(nextLocale);
    setError(false);
    try {
      const response = await fetch("/api/locale", {
        body: JSON.stringify({ locale: nextLocale }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("locale request failed");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPendingLocale(null);
    }
  };

  return (
    <div className={className}>
      <label>
        <span className="sr-only">{t("label")}</span>
        <select
          aria-label={pendingLocale ? t("saving") : t("change")}
          disabled={pendingLocale !== null}
          value={pendingLocale ?? locale}
          onChange={(event) => {
            const nextLocale = event.target.value;
            if (isAppLocale(nextLocale)) void changeLocale(nextLocale);
          }}
        >
          {supportedLocales.map((option) => (
            <option key={option} value={option}>
              {localeLabels[option]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <span role="alert" className="locale-switcher-error">
          {t("error")}
        </span>
      )}
    </div>
  );
}
