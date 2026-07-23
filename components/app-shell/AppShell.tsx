"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavigation, protocolStatus } from "@/lib/site-config";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import { useWalletState } from "@/providers/wallet-context";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function WalletHeaderControls() {
  const wallet = useWalletState();

  if (wallet.status === "unconfigured") {
    return (
      <button className="dapp-wallet-button" type="button" disabled>
        Wallet not configured
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
  const designPreview =
    dappPreviewEnabled &&
    (dollarDeployment.status === "unavailable" || wallet.status === "unconfigured");
  const basketRoute = currentPath.startsWith("/app/baskets");
  const positionRoute = currentPath.startsWith("/app/positions");
  const rewardsRoute = currentPath.startsWith("/app/rewards");
  const routeCopy = basketRoute
    ? {
        status: "Basket flows",
        title: "Inspect, mint, and redeem static baskets.",
        description:
          "Discover basket creation events, reconcile current protocol state, and enforce bounded constituent flows before signing.",
      }
    : positionRoute
      ? {
          status: "Position flows",
          title: "Manage each wallet-owned PositionNFT.",
          description:
            "Reconcile ownership from current onchain state, then manage collateral, staking, and reward selections with bounded transactions.",
        }
      : rewardsRoute
        ? {
            status: "Reward flows",
            title: "Create stake positions with selected rewards.",
            description:
              "Choose fee assets per PositionNFT, inspect pending amounts, and respect the onchain unstaking cooldown.",
          }
        : {
            status: "Dollar flows",
            title: "Issue and redeem Statics Dollar.",
            description:
              "Deposit ETH or WETH into the active local profile, or recombine Dollar and Risk shares. Every quote comes from current protocol state before signing.",
          };
  const statusCards = [
    {
      label: "DApp",
      value: designPreview ? "Sample interface" : routeCopy.status,
      ready: !designPreview,
    },
    { label: "Wallet", value: walletStatusLabel(wallet.status), ready: wallet.status === "ready" },
    {
      label: "Network",
      value:
        wallet.status === "ready" && wallet.isTargetChain
          ? wallet.networkName
          : designPreview
            ? "Not connected"
            : "Target configured",
      ready: wallet.status === "ready" && wallet.isTargetChain,
    },
    {
      label: "Deployment",
      value: designPreview
        ? "Sample data only"
        : dollarDeployment.status === "configured"
          ? "Local verified"
          : protocolStatus.deployment,
      ready: !designPreview && dollarDeployment.status === "configured",
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
          {designPreview ? "Design preview" : "Protocol DApp"}
        </div>
        <div className="dapp-header-actions">
          <Link className="dapp-return" href="/">
            Site <span aria-hidden="true">↗</span>
          </Link>
          <WalletHeaderControls />
        </div>
      </header>

      <div className="dapp-layout">
        <aside className="dapp-sidebar" aria-label="DApp navigation">
          <p className="dapp-nav-label">Navigation</p>
          <nav>
            {appNavigation.map((item, index) => {
              const active =
                item.href === currentPath ||
                (item.href !== "/app" &&
                  Boolean(item.href && currentPath.startsWith(`${item.href}/`)));
              return item.enabled && item.href ? (
                <Link
                  key={item.label}
                  className={`dapp-nav-item${active ? " active" : ""}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
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
          <div className="dapp-sidebar-note">
            <span aria-hidden="true">{"///"}</span>
            Statics and Eves use separate sign-ins. Using the same Privy account preserves the same
            embedded wallet address.
          </div>
        </aside>

        <main id="dapp-content" className="dapp-content">
          <section className="dapp-intro">
            <p className="dapp-eyebrow">{"// Statics application"}</p>
            <h1>{routeCopy.title}</h1>
            <p>
              {designPreview
                ? "Review the intended information hierarchy with deterministic local sample data. Wallet and transaction controls remain disabled."
                : routeCopy.description}
            </p>
          </section>

          {wallet.error && (
            <p className="dapp-inline-error" role="alert">
              {wallet.error}
            </p>
          )}

          <section className="dapp-status-grid" aria-label="Application readiness">
            {statusCards.map((card) => (
              <article key={card.label} className="dapp-status-card">
                <span>{card.label}</span>
                <strong className={card.ready ? "is-ready" : undefined}>{card.value}</strong>
              </article>
            ))}
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
