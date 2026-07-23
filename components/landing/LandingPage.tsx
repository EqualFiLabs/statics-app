import Image from "next/image";
import Link from "next/link";

import { protocolStatus } from "@/lib/site-config";

import { PlaceholderLink } from "./PlaceholderLink";
import { SiteHeader } from "./SiteHeader";
import { UtcClock } from "./UtcClock";

function Corners() {
  return (
    <>
      <span className="corner corner-tl" aria-hidden="true" />
      <span className="corner corner-tr" aria-hidden="true" />
      <span className="corner corner-bl" aria-hidden="true" />
      <span className="corner corner-br" aria-hidden="true" />
    </>
  );
}

export function LandingPage() {
  return (
    <div id="top" className="landing-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main-content">
        <section id="protocol" className="hero frame" aria-labelledby="hero-title">
          <Corners />

          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">&gt;</span> One protocol. Two economies. Zero compromise.
            </p>
            <h1 id="hero-title">
              <span>Static assets.</span>
              <span>Static rules.</span>
              <span>Dynamic markets.</span>
              <span>Own your position.</span>
            </h1>
            <p className="hero-description">
              Statics unifies static multi-asset baskets, position-owned finance, and protocol-owned
              liquidity with a native dollar.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/app">
                Launch dapp <span aria-hidden="true">→</span>
              </Link>
              <span className="button button-ghost placeholder-link" aria-disabled="true">
                Read docs{" "}
                <span className="doc-icon" aria-hidden="true">
                  ▣
                </span>
              </span>
            </div>
            <div className="build-notes" aria-label="Protocol foundations">
              <span>Built on Uniswap v4</span>
              <span>EIP-2535 Diamond</span>
              <span>Timelocked governance</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Digital marble statue of Robin Hood">
            <Image
              className="hero-figure"
              src="/assets/robin-hood-hero.png"
              alt="A fragmented digital marble statue of Robin Hood wearing a feathered cap and goatee"
              width={1024}
              height={1536}
              priority
              sizes="(max-width: 860px) 100vw, 50vw"
            />
            <Image
              className="hero-mark"
              src="/assets/statics-icon.png"
              alt=""
              aria-hidden="true"
              width={708}
              height={717}
              priority
            />
            <div className="system-readout" aria-label="System status">
              <p>
                <span>&gt;</span> System status: <strong>{protocolStatus.system}</strong>
              </p>
              <p>
                <span>&gt;</span> Network: {protocolStatus.network}
              </p>
              <p>
                <span>&gt;</span> Deployment: {protocolStatus.deployment}
              </p>
              <p>
                <span>&gt;</span> Time: <UtcClock suffix />
              </p>
            </div>
            <p className="version">
              Statics protocol
              <br />
              Pre-launch
            </p>
          </div>
        </section>

        <section className="economy-grid" aria-label="Protocol economies">
          <article id="baskets" className="panel economy-card">
            <div className="panel-heading">
              <div className="heading-group">
                <span className="line-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <path d="m24 3 17 10v22L24 45 7 35V13L24 3Z" />
                    <path d="m7 13 17 10 17-10M24 23v22M15 18l18 10v9l-9 5-9-5V18Z" />
                  </svg>
                </span>
                <h2>Statics baskets</h2>
              </div>
              <a
                className="arrow-link"
                href="#protocol-glance"
                aria-label="Explore Statics baskets"
              >
                →
              </a>
            </div>
            <p>
              Permissionless static baskets of 1–16 assets. Tiered fees. Indexed rewards.
              Position-owned loans. Canonical Uniswap v4 liquidity.
            </p>
            <ul className="token-list" aria-label="Supported asset examples">
              <li title="Ether">◆</li>
              <li title="Bitcoin">₿</li>
              <li title="Dollar assets">＄</li>
              <li title="Stable assets">◒</li>
              <li title="Additional assets">◉</li>
              <li title="Governed assets">⬡</li>
              <li className="more">+ More</li>
            </ul>
          </article>

          <article id="dollar" className="panel economy-card">
            <div className="panel-heading">
              <div className="heading-group">
                <span className="line-icon coin-icon" aria-hidden="true">
                  $
                </span>
                <h2>Statics dollar</h2>
              </div>
              <a
                className="arrow-link"
                href="#protocol-glance"
                aria-label="Explore the Statics dollar"
              >
                →
              </a>
            </div>
            <p>
              A native dollar issued by overcollateralized profiles. Volatile with risk shares or
              pegged collateral wrappers.
            </p>
            <ul className="dollar-modes" aria-label="Statics dollar capabilities">
              <li>
                <strong>$SD</strong>
                <span>Dollar</span>
              </li>
              <li>
                <strong>Risk</strong>
                <span>Shares</span>
              </li>
              <li>
                <strong>Pegged</strong>
                <span>Profiles</span>
              </li>
              <li>
                <strong>Stake</strong>
                <span>&amp; earn</span>
              </li>
            </ul>
          </article>
        </section>

        <section id="protocol-glance" className="stats-panel frame" aria-labelledby="glance-title">
          <Corners />
          <h2 id="glance-title">
            <span aria-hidden="true">{"///"}</span> Protocol at a glance
          </h2>
          <dl className="stat-grid">
            <div>
              <dt>Total value locked</dt>
              <dd className="unavailable-value">—</dd>
              <dd className="stat-note">Pre-launch</dd>
            </div>
            <div>
              <dt>Baskets created</dt>
              <dd className="unavailable-value">—</dd>
              <dd className="stat-note">Pre-launch</dd>
            </div>
            <div>
              <dt>Dollar supply</dt>
              <dd className="unavailable-value">—</dd>
              <dd className="stat-note">Pre-launch</dd>
            </div>
            <div>
              <dt>Active positions</dt>
              <dd className="unavailable-value">—</dd>
              <dd className="stat-note">Pre-launch</dd>
            </div>
            <div>
              <dt>Pools deployed</dt>
              <dd className="unavailable-value">—</dd>
              <dd className="stat-note">Pre-launch</dd>
            </div>
          </dl>
        </section>

        <section id="liquidity" className="features panel" aria-label="Protocol features">
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M14 17V9l4-4h12l4 4v8M10 20l14-6 14 6v19l-14 6-14-6V20Z" />
                <path d="M20 28h8v8h-8zM24 28v-4" />
              </svg>
            </span>
            <h2>Position ownership</h2>
            <p>
              Your PositionNFT holds baskets, loans, and dollar series in one transferable asset.
            </p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="m24 4 17 9-17 9-17-9 17-9Z" />
                <path d="m7 22 17 9 17-9M7 31l17 9 17-9" />
              </svg>
            </span>
            <h2>Isolated accounting</h2>
            <p>Separate solvency domains. Measured custody. Explicit reservations.</p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="13" />
                <path d="M24 2v12M24 34v12M2 24h12M34 24h12M20 20h8v8h-8z" />
              </svg>
            </span>
            <h2>Market native</h2>
            <p>Built for Uniswap v4. Protocol-owned liquidity compounds for the protocol.</p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M12 44V20c0-4 3-7 7-7h10c4 0 7 3 7 7v24M19 13V7l5-3 5 3v6M8 24h8M32 24h8M19 21v23M29 21v23" />
                <circle cx="37" cy="9" r="5" />
              </svg>
            </span>
            <h2>Cypherpunk infra</h2>
            <p>
              Open source. Timelocked upgrades. Permissionless maintenance. No centralized admins.
            </p>
          </article>
        </section>

        <section id="launch" className="launch-panel panel" aria-labelledby="launch-title">
          <div className="launch-brand">
            <Image
              src="/assets/statics-lockup.png"
              alt="Statics Protocol"
              width={1259}
              height={304}
            />
            <p id="launch-title">
              Infrastructure for static assets, position-owned finance, and a native dollar.
            </p>
          </div>
          <div className="terminal" aria-label="Protocol principles" tabIndex={0}>
            <p>
              <UtcClock /> <span>&gt;</span> DApp integration follows the foundation phase
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> No KYC <i>|</i> No permission <i>|</i> No middlemen
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> Code is law <i>|</i> Numbers don&apos;t lie
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> Own your position
            </p>
          </div>
          <dl className="deployment-status">
            <div>
              <dt>Audit status</dt>
              <dd>{protocolStatus.audit}</dd>
            </div>
            <div>
              <dt>Deployment</dt>
              <dd>{protocolStatus.deployment}</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getUTCFullYear()} Statics Protocol</p>
        <nav aria-label="Project links">
          {["Docs", "GitHub", "Discord", "X / Twitter"].map((label) => (
            <PlaceholderLink key={label} label={label} />
          ))}
        </nav>
        <nav aria-label="Legal links">
          {["Terms", "Privacy", "Security"].map((label) => (
            <PlaceholderLink key={label} label={label} />
          ))}
        </nav>
      </footer>
    </div>
  );
}
