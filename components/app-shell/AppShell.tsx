"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getDappRoutePresentation, isDappOverviewPath } from "@/lib/dapp-navigation";
import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import { appNavigation } from "@/lib/site-config";
import { useWalletState } from "@/providers/wallet-context";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function WalletHeaderControls() {
  const wallet = useWalletState();

  if (wallet.status === "unconfigured") {
    return (
      <button className="dapp-wallet-button" type="button" disabled>
        Wallet unavailable
      </button>
    );
  }

  if (wallet.status === "loading") {
    return (
      <button className="dapp-wallet-button" type="button" disabled>
        Loading wallet…
      </button>
    );
  }

  if (wallet.status === "signed-out") {
    return (
      <div className="dapp-wallet-actions">
        <button className="dapp-wallet-link" type="button" onClick={wallet.connectWallet}>
          Connect wallet
        </button>
        <button className="dapp-wallet-button" type="button" onClick={wallet.login}>
          Sign in
        </button>
      </div>
    );
  }

  if (wallet.status === "wallet-missing") {
    return (
      <button
        className="dapp-wallet-button"
        type="button"
        onClick={() => void wallet.createWallet()}
        disabled={wallet.busyAction !== null}
      >
        {wallet.busyAction === "create" ? "Creating…" : "Create wallet"}
      </button>
    );
  }

  if (wallet.status === "error") {
    return (
      <button className="dapp-wallet-button" type="button" onClick={wallet.login}>
        Retry sign in
      </button>
    );
  }

  return (
    <div className="dapp-wallet-actions">
      {!wallet.isTargetChain && (
        <button
          className="dapp-wallet-link is-warning"
          type="button"
          onClick={() => void wallet.switchNetwork()}
          disabled={wallet.busyAction !== null}
        >
          {wallet.busyAction === "switch" ? "Switching…" : "Switch network"}
        </button>
      )}
      <button
        className="dapp-wallet-button"
        type="button"
        onClick={() => void wallet.copyAddress()}
        title="Copy wallet address"
      >
        {wallet.address ? formatAddress(wallet.address) : "Wallet ready"}
      </button>
    </div>
  );
}

function walletStatusLabel(status: ReturnType<typeof useWalletState>["status"]): string {
  if (status === "unconfigured") return "Not configured";
  if (status === "loading") return "Loading";
  if (status === "signed-out") return "Signed out";
  if (status === "wallet-missing") return "Wallet needed";
  if (status === "error") return "Unavailable";
  return "Connected";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/app";
  const wallet = useWalletState();
  const dollarDeployment = readClientDollarDeployment();
  const [openNavigationPath, setOpenNavigationPath] = useState<string | null>(null);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const firstNavigationLinkRef = useRef<HTMLAnchorElement>(null);
  const navigationOpen = openNavigationPath === currentPath;
  const routeCopy = getDappRoutePresentation(currentPath);
  const showOverviewSummary = isDappOverviewPath(currentPath);

  const closeNavigation = (restoreFocus = true) => {
    setOpenNavigationPath(null);
    if (restoreFocus) {
      navigationToggleRef.current?.focus();
    }
  };

  const openNavigation = () => {
    setOpenNavigationPath(currentPath);
  };

  useEffect(() => {
    if (!navigationOpen) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstNavigationLinkRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenNavigationPath(null);
      navigationToggleRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [navigationOpen]);

  const statusCards = [
    {
      label: "DApp",
      value: routeCopy.status,
      ready: true,
    },
    {
      label: "Wallet",
      value: walletStatusLabel(wallet.status),
      ready: wallet.status === "ready",
    },
    {
      label: "Network",
      value: wallet.status === "ready" && wallet.isTargetChain ? wallet.networkName : "--",
      ready: wallet.status === "ready" && wallet.isTargetChain,
    },
    {
      label: "Deployment",
      value: dollarDeployment.status === "configured" ? "Local Anvil" : "--",
      ready: dollarDeployment.status === "configured",
    },
  ] as const;

  return (
    <div className="dapp-shell">
      <a className="dapp-skip-link" href="#dapp-content">
        Skip to application content
      </a>

      <header className="dapp-header">
        <Link className="dapp-brand" href="/" aria-label="Return to Statics Protocol landing page">
          <Image
            src="/assets/statics-lockup.png"
            alt="Statics Protocol"
            width={1259}
            height={304}
            priority
          />
        </Link>
        <div className="dapp-phase">
          <span className="dapp-pulse" aria-hidden="true" />
          Protocol DApp
        </div>
        <div className="dapp-header-actions">
          <Link className="dapp-return" href="/">
            Site <span aria-hidden="true">↗</span>
          </Link>
          <WalletHeaderControls />
        </div>
      </header>

      <div className="dapp-layout">
        <aside
          className={`dapp-sidebar${navigationOpen ? " is-open" : ""}`}
          aria-label="DApp navigation"
        >
          <div className="dapp-mobile-navigation">
            <button
              ref={navigationToggleRef}
              className="dapp-nav-toggle"
              type="button"
              aria-label={`Application menu. Current route: ${routeCopy.label}`}
              aria-expanded={navigationOpen}
              aria-controls="dapp-navigation-panel"
              onClick={navigationOpen ? () => closeNavigation() : openNavigation}
            >
              <span>Current route</span>
              <strong>{routeCopy.label}</strong>
              <span aria-hidden="true">{navigationOpen ? "Close ×" : "Menu +"}</span>
            </button>
          </div>

          <div className="dapp-nav-panel" id="dapp-navigation-panel">
            <div className="dapp-nav-panel-heading">
              <div>
                <span>{"// Statics DApp"}</span>
                <strong>Application navigation</strong>
              </div>
              <button type="button" onClick={() => closeNavigation()}>
                Close ×
              </button>
            </div>
            <p className="dapp-nav-label">Navigation</p>
            <nav aria-label="Application routes">
              {appNavigation.map((item, index) => {
                const active =
                  item.href === currentPath ||
                  (item.href !== "/app" &&
                    Boolean(item.href && currentPath.startsWith(`${item.href}/`)));
                return item.enabled && item.href ? (
                  <Link
                    ref={index === 0 ? firstNavigationLinkRef : undefined}
                    key={item.label}
                    className={`dapp-nav-item${active ? " active" : ""}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => closeNavigation()}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {item.label}
                  </Link>
                ) : (
                  <span key={item.label} className="dapp-nav-item" aria-disabled="true">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {item.label}
                    <small>Planned</small>
                  </span>
                );
              })}
            </nav>
            <Link className="dapp-mobile-site-link" href="/" onClick={() => closeNavigation()}>
              Return to site <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </aside>

        <main id="dapp-content" className="dapp-content">
          {showOverviewSummary && (
            <section className="dapp-intro">
              <p className="dapp-eyebrow">{"// Statics application"}</p>
              <h1>{routeCopy.title}</h1>
              <p>{routeCopy.description}</p>
            </section>
          )}

          {wallet.error && (
            <p className="dapp-inline-error" role="alert">
              {wallet.error}
            </p>
          )}

          {showOverviewSummary && (
            <section className="dapp-status-grid" aria-label="Application readiness">
              {statusCards.map((card) => (
                <article key={card.label} className="dapp-status-card">
                  <span>{card.label}</span>
                  <strong className={card.ready ? "is-ready" : undefined}>{card.value}</strong>
                </article>
              ))}
            </section>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
