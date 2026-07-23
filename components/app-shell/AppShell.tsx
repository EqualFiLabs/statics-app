import Image from "next/image";
import Link from "next/link";

import { appNavigation, protocolStatus } from "@/lib/site-config";

const statusCards = [
  { label: "DApp", value: "Foundation ready", tone: "ready" },
  { label: "Wallet", value: "Not integrated", tone: "pending" },
  { label: "Network", value: protocolStatus.network, tone: "pending" },
  { label: "Deployment", value: protocolStatus.deployment, tone: "pending" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
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
          Foundation phase
        </div>
        <Link className="dapp-return" href="/">
          Back to site <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="dapp-layout">
        <aside className="dapp-sidebar" aria-label="DApp navigation">
          <p className="dapp-nav-label">Navigation</p>
          <nav>
            {appNavigation.map((item, index) =>
              item.enabled ? (
                <span key={item.label} className="dapp-nav-item active" aria-current="page">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </span>
              ) : (
                <span key={item.label} className="dapp-nav-item" aria-disabled="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                  <small>Planned</small>
                </span>
              )
            )}
          </nav>
          <div className="dapp-sidebar-note">
            <span aria-hidden="true">{"///"}</span>
            Wallet and protocol modules are intentionally absent from this build.
          </div>
        </aside>

        <main id="dapp-content" className="dapp-content">
          <section className="dapp-intro">
            <p className="dapp-eyebrow">{"// Statics application"}</p>
            <h1>Protocol interface foundation.</h1>
            <p>
              The application shell is ready. Shared Privy identity, wallet controls, and verified
              Statics contract actions begin in the next phase.
            </p>
          </section>

          <section className="dapp-status-grid" aria-label="Application readiness">
            {statusCards.map((card) => (
              <article key={card.label} className="dapp-status-card">
                <span>{card.label}</span>
                <strong className={card.tone === "ready" ? "is-ready" : undefined}>
                  {card.value}
                </strong>
              </article>
            ))}
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
