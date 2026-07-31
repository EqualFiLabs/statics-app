"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { primaryNavigation } from "@/lib/site-config";

import { PlaceholderLink } from "./PlaceholderLink";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("navigation");
  const tMarketing = useTranslations("navigation.marketing");

  return (
    <header className="site-header" aria-label={t("primary")}>
      <a className="brand" href="#top" aria-label={t("home")}>
        <Image
          src="/assets/statics-lockup.png"
          alt="Statics Protocol"
          width={1259}
          height={304}
          priority
        />
      </a>

      <button
        className="menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span className="sr-only">{t("toggle")}</span>
      </button>

      <nav id="site-nav" className={`site-nav${open ? " open" : ""}`} aria-label={t("mainMenu")}>
        {primaryNavigation.map((item) =>
          item.kind === "placeholder" ? (
            <PlaceholderLink key={item.label} label={tMarketing(item.messageKey)} />
          ) : (
            <a key={item.label} href={item.href} onClick={() => setOpen(false)}>
              {tMarketing(item.messageKey)}
            </a>
          )
        )}
        <LocaleSwitcher className="locale-switcher locale-switcher--marketing-mobile" />
      </nav>

      <div className="site-header-actions">
        <LocaleSwitcher className="locale-switcher locale-switcher--marketing" />
        <Link className="button button-outline header-cta" href="/app">
          {t("launchApp")} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
