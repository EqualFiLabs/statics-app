"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getDappRoutePresentation, isDappOverviewPath } from "@/lib/dapp-navigation";
import { appHeaderNavigation, appNavigationGroups, appTabNavigation } from "@/lib/site-config";
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
      <button
        className="dapp-wallet-button is-connected"
        type="button"
        onClick={() => void wallet.copyAddress()}
        title="Copy wallet address"
      >
        {wallet.address ? formatAddress(wallet.address) : "Wallet ready"}
      </button>
    </div>
  );
}

/**
 * Which network you are on, in the header, on every route.
 *
 * `networkName` is the *target* chain's name, so it only describes reality
 * when isTargetChain is true. Anything else has to be reported as a mismatch
 * rather than by name, because the context does not carry the name of the
 * chain the wallet actually sits on -- only its id.
 */
function NetworkIndicator() {
  const wallet = useWalletState();

  if (wallet.status !== "ready") {
    return (
      <div className="dapp-network">
        <span className="dapp-network-dot" aria-hidden="true" />
        {wallet.networkName}
      </div>
    );
  }

  if (!wallet.isTargetChain) {
    return (
      <div className="dapp-network is-wrong">
        <span className="dapp-network-dot" aria-hidden="true" />
        {wallet.chainId === null ? "Network unknown" : `Chain ${wallet.chainId}`}
      </div>
    );
  }

  return (
    <div className="dapp-network is-ready">
      <span className="dapp-network-dot" aria-hidden="true" />
      {wallet.networkName}
    </div>
  );
}

/**
 * A wrong network means every number on the page reads as unavailable, so the
 * fix has to be impossible to miss and reachable at any width -- not a link in
 * the header, which is hidden under 560px.
 */
function WrongNetworkBar() {
  const wallet = useWalletState();
  if (wallet.status !== "ready" || wallet.isTargetChain) return null;

  return (
    <div className="dapp-network-bar" role="status">
      <p>
        <strong>You are on the wrong network.</strong> Statics data will not load until you switch
        to {wallet.networkName}
        {wallet.targetChainId ? ` (chain ${wallet.targetChainId})` : ""}.
      </p>
      <button
        className="dapp-network-bar-action"
        type="button"
        onClick={() => void wallet.switchNetwork()}
        disabled={wallet.busyAction !== null}
      >
        {wallet.busyAction === "switch" ? "Switching…" : `Switch network`}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/app";
  const wallet = useWalletState();
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
        <NetworkIndicator />
        <div className="dapp-header-actions">
          {appHeaderNavigation.map((item) => (
            <Link
              key={item.href}
              className={`dapp-header-link${currentPath.startsWith(item.href) ? " active" : ""}`}
              href={item.href}
              aria-current={currentPath.startsWith(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
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
          <div className="dapp-nav-panel" id="dapp-navigation-panel">
            <div className="dapp-nav-panel-heading">
              <div>
                <span>Statics DApp</span>
                <strong>Application navigation</strong>
              </div>
              <button type="button" onClick={() => closeNavigation()}>
                Close ×
              </button>
            </div>
            {/* One <nav> per group, each labelled, so the grouping is structure
                rather than styling and assistive tech can jump between them. */}
            {appNavigationGroups.map((group, groupIndex) => (
              <nav
                key={group.label ?? "home"}
                // A group whose every item is hidden on desktop would otherwise
                // leave its heading stranded above nothing.
                className={`dapp-nav-group${
                  group.items.every((item) => (item.placement ?? "primary") !== "primary")
                    ? " is-detail-only"
                    : ""
                }`}
                aria-label={group.label ?? "Overview"}
              >
                {group.label && <p className="dapp-nav-label">{group.label}</p>}
                {group.items.map((item, itemIndex) => {
                  // Anything not primary is hidden from the desktop sidebar by
                  // CSS rather than dropped, so the mobile panel keeps it.
                  const secondaryClass =
                    (item.placement ?? "primary") === "primary" ? "" : " is-secondary";
                  const active =
                    item.href === currentPath ||
                    (item.href !== "/app" &&
                      Boolean(item.href && currentPath.startsWith(`${item.href}/`)));
                  return item.enabled && item.href ? (
                    <Link
                      ref={groupIndex === 0 && itemIndex === 0 ? firstNavigationLinkRef : undefined}
                      key={item.label}
                      className={`dapp-nav-item${active ? " active" : ""}${secondaryClass}`}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => closeNavigation()}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      key={item.label}
                      className={`dapp-nav-item${secondaryClass}`}
                      aria-disabled="true"
                    >
                      {item.label}
                      <small>Planned</small>
                    </span>
                  );
                })}
              </nav>
            ))}
            <Link className="dapp-mobile-site-link" href="/" onClick={() => closeNavigation()}>
              Return to site <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </aside>

        <main id="dapp-content" className="dapp-content">
          <WrongNetworkBar />

          {showOverviewSummary && (
            <section className="dapp-intro">
              <p className="dapp-eyebrow">Statics application</p>
              <h1>{routeCopy.title}</h1>
              <p>{routeCopy.description}</p>
            </section>
          )}

          {wallet.error && (
            <p className="dapp-inline-error" role="alert">
              {wallet.error}
            </p>
          )}

          {children}
        </main>
      </div>

      <nav className="dapp-tabbar" aria-label="Primary">
        {appTabNavigation.map((item) => {
          const active =
            item.href === currentPath ||
            (item.href !== "/app" && currentPath.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              className={`dapp-tab${active ? " active" : ""}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
            >
              {item.tabLabel}
            </Link>
          );
        })}
        <button
          ref={navigationToggleRef}
          className="dapp-tab dapp-nav-toggle"
          type="button"
          aria-label={`Application menu. Current route: ${routeCopy.label}`}
          aria-expanded={navigationOpen}
          aria-controls="dapp-navigation-panel"
          onClick={navigationOpen ? () => closeNavigation() : openNavigation}
        >
          {/* Glyph only. The accessible name comes from aria-label above, so
              this carries no text of its own. */}
          <span aria-hidden="true">{navigationOpen ? "✕" : "☰"}</span>
        </button>
      </nav>
    </div>
  );
}
