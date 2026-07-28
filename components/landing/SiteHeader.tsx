"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { primaryNavigation } from "@/lib/site-config";

import { PlaceholderLink } from "./PlaceholderLink";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header" aria-label="Primary navigation">
      <a className="brand" href="#top" aria-label="Statics Protocol home">
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
        <span className="sr-only">Toggle navigation</span>
      </button>

      <nav id="site-nav" className={`site-nav${open ? " open" : ""}`} aria-label="Main menu">
        {primaryNavigation.map((item) =>
          item.kind === "placeholder" ? (
            <PlaceholderLink key={item.label} label={item.label} />
          ) : (
            <a key={item.label} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          )
        )}
      </nav>

      <Link className="button button-outline header-cta" href="/app">
        Launch app <span aria-hidden="true">→</span>
      </Link>
    </header>
  );
}
