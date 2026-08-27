import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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

export async function LandingPage() {
  const [t, tCommon, tNavigation] = await Promise.all([
    getTranslations("landing"),
    getTranslations("common"),
    getTranslations("navigation"),
  ]);

  return (
    <div id="top" className="landing-page">
      <a className="skip-link" href="#main-content">
        {tCommon("skipToContent")}
      </a>

      <SiteHeader />

      <main id="main-content">
        <section id="protocol" className="hero frame" aria-labelledby="hero-title">
          <Corners />

          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">&gt;</span> {t("eyebrow")}
            </p>
            <h1 id="hero-title">
              <span>{t("heroLine1")}</span>
              <span>{t("heroLine2")}</span>
              <span>{t("heroLine3")}</span>
            </h1>
            <p className="hero-description">{t("heroDescription")}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/app">
                {tNavigation("launchApp")} <span aria-hidden="true">→</span>
              </Link>
              <a className="button button-ghost" href="#protocol-glance">
                {t("whatsFixed")}{" "}
                <span className="doc-icon" aria-hidden="true">
                  ↓
                </span>
              </a>
            </div>
          </div>

          <div className="hero-visual" aria-label={t("heroVisual")}>
            <Image
              className="hero-figure"
              src="/assets/robin-hood-hero.png"
              alt={t("heroAlt")}
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
            <div className="system-readout" aria-label={t("systemStatus")}>
              <p>
                <span>&gt;</span> {t("systemStatus")}: <strong>{t("status.system")}</strong>
              </p>
              <p>
                <span>&gt;</span> {t("time")}: <UtcClock suffix />
              </p>
            </div>
          </div>
        </section>

        <section className="economy-grid" aria-label={t("economies")}>
          <article id="baskets" className="panel economy-card">
            <div className="panel-heading">
              <div className="heading-group">
                <span className="line-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <path d="m24 3 17 10v22L24 45 7 35V13L24 3Z" />
                    <path d="m7 13 17 10 17-10M24 23v22M15 18l18 10v9l-9 5-9-5V18Z" />
                  </svg>
                </span>
                <h2>{t("basketsTitle")}</h2>
              </div>
              <a className="arrow-link" href="#protocol-glance" aria-label={t("basketsHow")}>
                →
              </a>
            </div>
            <p>{t("basketsDescription")}</p>
            <ul className="token-list" aria-label={t("assetExamples")}>
              <li title={t("ether")}>◆</li>
              <li title={t("bitcoin")}>₿</li>
              <li title={t("dollarAssets")}>＄</li>
              <li title={t("stableAssets")}>◒</li>
              <li title={t("additionalAssets")}>◉</li>
              <li title={t("governedAssets")}>⬡</li>
              <li className="more">{t("more")}</li>
            </ul>
          </article>

          <article id="dollar" className="panel economy-card">
            <div className="panel-heading">
              <div className="heading-group">
                <span className="line-icon coin-icon" aria-hidden="true">
                  $
                </span>
                <h2>{t("dollarTitle")}</h2>
              </div>
              <a className="arrow-link" href="#protocol-glance" aria-label={t("dollarHow")}>
                →
              </a>
            </div>
            <p>{t("dollarDescription")}</p>
            <ul className="dollar-modes" aria-label={t("dollarCapabilities")}>
              <li>
                <strong>USDstx</strong>
                <span>{t("dollar")}</span>
              </li>
              <li>
                <strong>ethLEV</strong>
                <span>{t("shares")}</span>
              </li>
              <li>
                <strong>{t("redeem")}</strong>
                <span>{t("whenHealthy")}</span>
              </li>
              <li>
                <strong>{t("permit")}</strong>
                <span>{t("oneSignature")}</span>
              </li>
            </ul>
          </article>
        </section>

        <section id="protocol-glance" className="stats-panel frame" aria-labelledby="glance-title">
          <Corners />
          <h2 id="glance-title">
            <span aria-hidden="true">{"///"}</span> {t("whatsFixed")}
          </h2>
          <dl className="stat-grid">
            <div>
              <dt>{t("assetsPerBasket")}</dt>
              <dd>1–16</dd>
              <dd className="stat-note">{t("chosenOnce")}</dd>
            </div>
            <div>
              <dt>{t("redemption")}</dt>
              <dd>{t("inKind")}</dd>
              <dd className="stat-note">{t("exactlyInside")}</dd>
            </div>
            <div>
              <dt>{t("rebalancing")}</dt>
              <dd>{t("never")}</dd>
              <dd className="stat-note">{t("weightsNeverChange")}</dd>
            </div>
            <div>
              <dt>{t("liquidations")}</dt>
              <dd>{t("none")}</dd>
              <dd className="stat-note">{t("debtMatches")}</dd>
            </div>
            <div>
              <dt>{t("rewardAssets")}</dt>
              <dd>{t("upTo12")}</dd>
              <dd className="stat-note">{t("perPosition")}</dd>
            </div>
          </dl>
        </section>

        <section id="liquidity" className="features panel" aria-label={t("features")}>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M14 17V9l4-4h12l4 4v8M10 20l14-6 14 6v19l-14 6-14-6V20Z" />
                <path d="M20 28h8v8h-8zM24 28v-4" />
              </svg>
            </span>
            <h2>{t("ownPosition")}</h2>
            <p>{t("ownPositionDescription")}</p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="m24 4 17 9-17 9-17-9 17-9Z" />
                <path d="m7 22 17 9 17-9M7 31l17 9 17-9" />
              </svg>
            </span>
            <h2>{t("noLiquidations")}</h2>
            <p>{t("noLiquidationsDescription")}</p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="13" />
                <path d="M24 2v12M24 34v12M2 24h12M34 24h12M20 20h8v8h-8z" />
              </svg>
            </span>
            <h2>{t("deepLiquidity")}</h2>
            <p>{t("deepLiquidityDescription")}</p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M12 44V20c0-4 3-7 7-7h10c4 0 7 3 7 7v24M19 13V7l5-3 5 3v6M8 24h8M32 24h8M19 21v23M29 21v23" />
                <circle cx="37" cy="9" r="5" />
              </svg>
            </span>
            <h2>{t("stakeEarn")}</h2>
            <p>{t("stakeEarnDescription")}</p>
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
            <p id="launch-title">{t("tagline")}</p>
          </div>
          <div className="terminal" aria-label={t("principles")} tabIndex={0}>
            <p>
              <UtcClock /> <span>&gt;</span> {t("bundleNeverChanges")}
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> {t("redeemExactly")}
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> {t("noKyc")} <i>|</i> {t("noPermission")} <i>|</i>{" "}
              {t("noMiddlemen")}
            </p>
            <p>
              <UtcClock /> <span>&gt;</span> {t("staticAssets")} <i>|</i> {t("dynamicMarkets")}
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getUTCFullYear()} Statics Protocol</p>
        <nav aria-label={t("projectLinks")}>
          {(["docs", "github", "discord", "twitter"] as const).map((key) => (
            <PlaceholderLink key={key} label={t(key)} />
          ))}
        </nav>
        <nav aria-label={t("legalLinks")}>
          {(["terms", "privacy", "security"] as const).map((key) => (
            <PlaceholderLink key={key} label={t(key)} />
          ))}
        </nav>
      </footer>
    </div>
  );
}
