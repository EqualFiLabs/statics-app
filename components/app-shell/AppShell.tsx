"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { AccountDialog } from "@/components/app-shell/AccountDialog";
import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { getDappRouteId, isDappOverviewPath } from "@/lib/dapp-navigation";
import { appNavigationGroups, appTabNavigation } from "@/lib/site-config";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const approvalDisclosureRoutes = [
  "/app/swap",
  "/app/dollar",
  "/app/baskets",
  "/app/positions",
  "/app/loans",
  "/app/rewards",
  "/app/genesis",
  "/app/genesis-rewards",
  "/app/liquidity",
] as const;

function WalletHeaderControls() {
  const wallet = useWalletState();
  const [accountOpen, setAccountOpen] = useState(false);
  const t = useTranslations("shell");

  if (wallet.status === "unconfigured") {
    return (
      <button className="dapp-wallet-button" type="button" disabled>
        {t("walletUnavailable")}
      </button>
    );
  }

  if (wallet.status === "loading") {
    return (
      <button className="dapp-wallet-button" type="button" disabled>
        {t("loadingWallet")}
      </button>
    );
  }

  if (wallet.status === "signed-out") {
    if (wallet.locallyDisconnected) {
      return (
        <div className="dapp-wallet-actions">
          <button
            className="dapp-wallet-link"
            type="button"
            onClick={wallet.connectExternalWallet}
            disabled={wallet.busyAction !== null}
          >
            {t("connectExternalWallet")}
          </button>
          <button
            className="dapp-wallet-button"
            type="button"
            onClick={() => void wallet.reconnectWallet()}
            disabled={wallet.busyAction !== null}
          >
            {wallet.busyAction === "connect" ? t("connecting") : t("usePrivyWallet")}
          </button>
        </div>
      );
    }
    return (
      <div className="dapp-wallet-actions">
        <button className="dapp-wallet-link" type="button" onClick={wallet.connectWallet}>
          {t("connectWallet")}
        </button>
        <button className="dapp-wallet-button" type="button" onClick={wallet.login}>
          {t("signIn")}
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
        {wallet.busyAction === "create" ? t("creating") : t("createWallet")}
      </button>
    );
  }

  if (wallet.status === "error") {
    return (
      <button className="dapp-wallet-button" type="button" onClick={wallet.login}>
        {t("retrySignIn")}
      </button>
    );
  }

  return (
    <div className="dapp-wallet-actions">
      <button
        className="dapp-wallet-button is-connected"
        type="button"
        onClick={() => setAccountOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={accountOpen}
        title={t("accountDetails")}
      >
        {wallet.address ? formatAddress(wallet.address) : t("walletReady")}
      </button>
      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
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
  const t = useTranslations("shell");

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
        {wallet.chainId === null ? t("networkUnknown") : t("chain", { chainId: wallet.chainId })}
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

function NetworkSelector() {
  const { active, options } = useDeployment();
  const wallet = useWalletState();
  if (options.length < 2) return null;
  return (
    <label className="dapp-network-selector">
      <span className="sr-only">Statics network</span>
      <select
        aria-label="Statics network"
        value={active.networkId}
        disabled={wallet.busyAction !== null}
        onChange={(event) =>
          void wallet.selectNetwork(event.target.value as typeof active.networkId)
        }
      >
        {options.map((option) => (
          <option key={option.networkId} value={option.networkId}>
            {option.descriptor.network}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A wrong network means every number on the page reads as unavailable, so the
 * fix has to be impossible to miss and reachable at any width -- not a link in
 * the header, which is hidden under 560px.
 */
function WrongNetworkBar() {
  const wallet = useWalletState();
  const t = useTranslations("shell");
  if (wallet.status !== "ready" || wallet.isTargetChain) return null;

  return (
    <div className="dapp-network-bar" role="status">
      <p>
        <strong>{t("wrongNetworkTitle")}</strong>{" "}
        {wallet.targetChainId
          ? t("wrongNetworkBodyWithChain", {
              network: wallet.networkName,
              chainId: wallet.targetChainId,
            })
          : t("wrongNetworkBody", { network: wallet.networkName })}
      </p>
      <button
        className="dapp-network-bar-action"
        type="button"
        onClick={() => void wallet.switchNetwork()}
        disabled={wallet.busyAction !== null}
      >
        {wallet.busyAction === "switch" ? t("switching") : t("switchNetwork")}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/app";
  const wallet = useWalletState();
  const { active, options } = useDeployment();
  const tCommon = useTranslations("common");
  const tNavigation = useTranslations("navigation");
  const tGroups = useTranslations("navigation.groups");
  const tItems = useTranslations("navigation.items");
  const tRoutes = useTranslations("routes");
  const tShell = useTranslations("shell");
  const [openNavigationPath, setOpenNavigationPath] = useState<string | null>(null);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const firstNavigationLinkRef = useRef<HTMLAnchorElement>(null);
  const navigationOpen = openNavigationPath === currentPath;
  const routeId = getDappRouteId(currentPath);
  let routeCopy = {
    label: tRoutes(`${routeId}.label`),
    title: tRoutes(`${routeId}.title`),
    description: tRoutes(`${routeId}.description`),
  };
  if (routeId === "overview" && active.descriptor.stage === "launch") {
    routeCopy = {
      label: "Overview",
      title: "Statics Genesis",
      description: active.descriptor.available
        ? "Trade STATICS, acquire a fully backed Genesis NFT, activate it, and earn a share of launch fees."
        : "The standalone Genesis launch will open here after its reviewed Robinhood Chain deployment is published.",
    };
  }
  const showOverviewSummary = isDappOverviewPath(currentPath);
  const showApprovalDisclosure = approvalDisclosureRoutes.some(
    (route) => currentPath === route || currentPath.startsWith(`${route}/`)
  );
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
        {tCommon("skipToApplication")}
      </a>

      <header className="dapp-header">
        <Link className="dapp-brand" href="/" aria-label={tNavigation("returnLanding")}>
          <Image
            src="/assets/statics-lockup.png"
            alt="Statics Protocol"
            width={1259}
            height={304}
            priority
          />
        </Link>
        {options.length < 2 ? <NetworkIndicator /> : null}
        <div className="dapp-header-actions">
          <NetworkSelector />
          <LocaleSwitcher className="locale-switcher locale-switcher--dapp" />
          <Link className="dapp-return" href="/">
            {tNavigation("site")} <span aria-hidden="true">↗</span>
          </Link>
          <WalletHeaderControls />
        </div>
      </header>

      <div className="dapp-layout">
        <aside
          className={`dapp-sidebar${navigationOpen ? " is-open" : ""}`}
          aria-label={tNavigation("dapp")}
        >
          <div className="dapp-nav-panel" id="dapp-navigation-panel">
            <div className="dapp-nav-panel-heading">
              <div>
                <span>Statics DApp</span>
                <strong>{tNavigation("application")}</strong>
              </div>
              <button type="button" onClick={() => closeNavigation()}>
                {tCommon("close")} ×
              </button>
            </div>
            {/* One <nav> per group, each labelled, so the grouping is structure
                rather than styling and assistive tech can jump between them. */}
            {appNavigationGroups.map((group, groupIndex) => (
              <nav
                key={group.label ?? "home"}
                className="dapp-nav-group"
                aria-label={group.messageKey ? tGroups(group.messageKey) : tGroups("overview")}
              >
                {group.messageKey && <p className="dapp-nav-label">{tGroups(group.messageKey)}</p>}
                {group.items.map((item, itemIndex) => {
                  const currentActive =
                    item.href === currentPath ||
                    (item.href !== "/app" &&
                      Boolean(item.href && currentPath.startsWith(`${item.href}/`)));
                  return item.enabled && item.href ? (
                    <Link
                      ref={groupIndex === 0 && itemIndex === 0 ? firstNavigationLinkRef : undefined}
                      key={item.label}
                      className={`dapp-nav-item${currentActive ? " active" : ""}`}
                      href={item.href}
                      aria-current={currentActive ? "page" : undefined}
                      onClick={() => closeNavigation()}
                    >
                      {tItems(item.messageKey)}
                    </Link>
                  ) : (
                    <span key={item.label} className="dapp-nav-item" aria-disabled="true">
                      {tItems(item.messageKey)}
                      <small>{tCommon("planned")}</small>
                    </span>
                  );
                })}
              </nav>
            ))}
            <Link className="dapp-mobile-site-link" href="/" onClick={() => closeNavigation()}>
              {tNavigation("returnSite")} <span aria-hidden="true">↗</span>
            </Link>
            <LocaleSwitcher className="locale-switcher locale-switcher--dapp-mobile" />
          </div>
        </aside>

        <main id="dapp-content" className="dapp-content">
          <WrongNetworkBar />

          {showOverviewSummary && (
            <section className="dapp-intro">
              <p className="dapp-eyebrow">{tShell("application")}</p>
              <h1>{routeCopy.title}</h1>
              <p>{routeCopy.description}</p>
            </section>
          )}

          {wallet.error && (
            <p className="dapp-inline-error" role="alert">
              {wallet.error}
            </p>
          )}

          {showApprovalDisclosure && (
            <aside className="dapp-approval-disclosure" aria-label={tShell("approvalsTitle")}>
              <p>
                <strong>{tShell("approvalsTitle")}</strong> {tShell("approvalsBody")}
              </p>
              <Link href="/app/tools">{tShell("manageApprovals")} →</Link>
            </aside>
          )}

          {children}
        </main>
      </div>

      <nav className="dapp-tabbar" aria-label={tShell("primary")}>
        {appTabNavigation.map((item) => {
          const currentActive =
            item.href === currentPath ||
            (item.href !== "/app" && currentPath.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              className={`dapp-tab${currentActive ? " active" : ""}`}
              href={item.href}
              aria-current={currentActive ? "page" : undefined}
            >
              {tItems(item.messageKey)}
            </Link>
          );
        })}
        <button
          ref={navigationToggleRef}
          className="dapp-tab dapp-nav-toggle"
          type="button"
          aria-label={tNavigation("mobileMenu", { route: routeCopy.label })}
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
