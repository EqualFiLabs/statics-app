"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

function utcTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function UtcClock({ suffix = false }: { suffix?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const locale = useLocale();

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const value = now ? utcTime(now, locale) : "--:--:--";
  return (
    <time dateTime={now?.toISOString()} suppressHydrationWarning>
      {value}
      {suffix ? " UTC" : ""}
    </time>
  );
}
