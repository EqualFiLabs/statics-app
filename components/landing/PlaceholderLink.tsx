"use client";

import { useTranslations } from "next-intl";

export function PlaceholderLink({ label }: { label: string }) {
  const t = useTranslations("common");
  return (
    <span
      className="placeholder-link"
      aria-disabled="true"
      title={t("comingSoon", { label })}
      data-placeholder-link
    >
      {label}
    </span>
  );
}
