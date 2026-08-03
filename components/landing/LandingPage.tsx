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
              <span aria-hidden="true">&gt;</span> The anchor is fixed. The market is not.
            </p>
            <h1 id="hero-title">
              <span>Static assets.</span>
              <span>Static rules.</span>
              <span>Dynamic markets.</span>
            </h1>
            <p className="hero-description">
              Every basket is a fixed bundle, always redeemable for exactly what is inside it. No
              manager, no rebalancing, no liquidations. Markets move around that anchor — Statics
              pays the people who hold it steady.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/app">
                Launch app <span aria-hidden="true">→</span>
              </Link>
              <a className="button button-ghost" href="#protocol-glance">
                What&apos;s fixed{" "}
                <span className="doc-icon" aria-hidden="true">
                  ↓
                </span>
              </a>
            </div>
            <div className="build-notes" aria-label="Protocol foundations">
              <span>Fixed bundles</span>
              <span>In-kind redemption</span>
              <span>Open source</span>
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
                aria-label="How Statics baskets work"
              >
                →
              </a>
            </div>
            <p>
              A fixed bundle of 1–16 assets, held as a single token. Redeem it any time for exactly
              what is inside — the same amounts, forever. No manager, no rebalancing, no discretion.
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
                aria-label="How the Statics dollar works"
              >
                →
              </a>
            </div>
            <p>
              A dollar backed by collateral anyone can verify on-chain. Risk shares take losses
              first, so the dollar stays whole.
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
                <strong>Redeem</strong>
                <span>Any time</span>
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
            <span aria-hidden="true">{"///"}</span> What&apos;s fixed
          </h2>
          <dl className="stat-grid">
            <div>
              <dt>Assets per basket</dt>
              <dd>1–16</dd>
              <dd className="stat-note">Chosen once, at creation</dd>
            </div>
            <div>
              <dt>Redemption</dt>
              <dd>In kind</dd>
              <dd className="stat-note">Exactly what is inside</dd>
            </div>
            <div>
              <dt>Rebalancing</dt>
              <dd>Never</dd>
              <dd className="stat-note">Weights never change</dd>
            </div>
            <div>
              <dt>Liquidations</dt>
              <dd>None</dd>
              <dd className="stat-note">Debt matches collateral</dd>
            </div>
            <div>
              <dt>Reward assets</dt>
              <dd>Up to 64</dd>
              <dd className="stat-note">Per staked position</dd>
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
            <h2>Own your position</h2>
            <p>
              Baskets, loans, and dollar series live in one position you can hold, transfer, or sell
              as a single asset.
            </p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="m24 4 17 9-17 9-17-9 17-9Z" />
                <path d="m7 22 17 9 17-9M7 31l17 9 17-9" />
              </svg>
            </span>
            <h2>No liquidations</h2>
            <p>
              Debt is denominated in the same assets as the collateral, so a price crash moves both
              sides together. There is nothing to liquidate.
            </p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="13" />
                <path d="M24 2v12M24 34v12M2 24h12M34 24h12M20 20h8v8h-8z" />
              </svg>
            </span>
            <h2>Liquidity that deepens</h2>
            <p>
              A share of every swap becomes permanent protocol-owned liquidity. Pools get deeper the
              more they trade, and that depth cannot be withdrawn.
            </p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M12 44V20c0-4 3-7 7-7h10c4 0 7 3 7 7v24M19 13V7l5-3 5 3v6M8 24h8M32 24h8M19 21v23M29 21v23" />
                <circle cx="37" cy="9" r="5" />
              </svg>
            </span>
            <h2>Stake and earn</h2>
            <p>
              Stake and opt into up to 64 reward assets. Rewards are swap fees paid in kind — real
              revenue, not emissions.
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
            <p id="launch-title">Fixed assets. Fixed rules. Everything else is free to move.</p>
          </div>
          <div className="terminal" aria-label="Protocol principles" tabIndex={0}>
            <p>
              <UtcClock /> <span>&gt;</span> The bundle never changes
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> Redeem for exactly what is inside
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> No KYC <i>|</i> No permission <i>|</i> No middlemen
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> Static assets <i>|</i> Dynamic markets
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
