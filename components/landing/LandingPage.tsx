import { Gauge, Network } from "lucide-react";
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

      <div className="landing-content">
        <div className="landing-artwork" aria-hidden="true">
          <div className="psd-scene" />
          <Image
            className="hero-figure"
            src="/assets/visual-direction/robinhood-bust.webp"
            alt=""
            width={1254}
            height={1254}
            priority
            sizes="(max-width: 560px) 100vw, (max-width: 860px) 85vw, 1181px"
          />
          <div className="psd-scene psd-planet" />
        </div>
        <SiteHeader />

        <main id="main-content">
          <div className="landing-scene">
            <section id="protocol" className="hero frame" aria-labelledby="hero-title">
              <Corners />

              <div className="hero-copy">
                <p className="eyebrow">
                  <span aria-hidden="true">&gt;&gt;&gt;&gt;&gt;</span> {t("eyebrow")}
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
                    {t("mechanics")}{" "}
                    <span className="doc-icon" aria-hidden="true">
                      ↓
                    </span>
                  </a>
                </div>
              </div>

              <div className="system-readout" aria-label={t("systemStatus")}>
                <p>
                  <span>&gt;</span> {t("systemStatus")}: <strong>{t("status.system")}</strong>
                </p>
                <p>
                  <span>&gt;</span> {t("time")}: <UtcClock suffix />
                </p>
              </div>
            </section>

            <section className="economy-grid" aria-label={t("economies")}>
              <article id="markets" className="panel economy-card">
                <div className="panel-heading">
                  <div className="heading-group">
                    <span className="line-icon" aria-hidden="true">
                      <Network size={64} strokeWidth={1.5} />
                    </span>
                    <h2>{t("marketsTitle")}</h2>
                  </div>
                  <a className="arrow-link" href="#protocol-glance" aria-label={t("marketsHow")}>
                    →
                  </a>
                </div>
                <p>{t("marketsDescription")}</p>
                <ul className="market-labels" aria-label={t("marketCapabilities")}>
                  {(["creatorFees", "nativeEth", "erc20", "uniswapV4"] as const).map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ul>
              </article>

              <article id="gauges" className="panel economy-card">
                <div className="panel-heading">
                  <div className="heading-group">
                    <span className="line-icon" aria-hidden="true">
                      <Gauge size={64} strokeWidth={1.5} />
                    </span>
                    <h2>{t("gaugesTitle")}</h2>
                  </div>
                  <a className="arrow-link" href="#protocol-glance" aria-label={t("gaugesHow")}>
                    →
                  </a>
                </div>
                <p>{t("gaugesDescription")}</p>
                <ul className="dollar-modes" aria-label={t("gaugeCapabilities")}>
                  <li>
                    <strong>STATICS</strong>
                    <span>{t("protocolRewards")}</span>
                  </li>
                  <li>
                    <strong>{t("fourAssets")}</strong>
                    <span>{t("communityRewards")}</span>
                  </li>
                  <li>
                    <strong>{t("lps")}</strong>
                    <span>{t("inRangeIncentives")}</span>
                  </li>
                  <li>
                    <strong>{t("allocators")}</strong>
                    <span>{t("stakeDirectedRewards")}</span>
                  </li>
                </ul>
              </article>
            </section>
          </div>

          <section
            id="protocol-glance"
            className="stats-panel frame"
            aria-labelledby="glance-title"
          >
            <Corners />
            <h2 id="glance-title">
              <span aria-hidden="true">{"///"}</span> {t("mechanics")}
            </h2>
            <dl className="stat-grid">
              <div>
                <dt>{t("creatorShare")}</dt>
                <dd>5%</dd>
                <dd className="stat-note">{t("publicPoolHookFees")}</dd>
              </div>
              <div>
                <dt>{t("rewardSlots")}</dt>
                <dd>5</dd>
                <dd className="stat-note">{t("perPublicPool")}</dd>
              </div>
              <div>
                <dt>{t("gaugeAllocations")}</dt>
                <dd>16</dd>
                <dd className="stat-note">{t("poolsPerPosition")}</dd>
              </div>
              <div>
                <dt>{t("allocationCooldown")}</dt>
                <dd>4h</dd>
                <dd className="stat-note">{t("configurableDefault")}</dd>
              </div>
              <div>
                <dt>{t("rewardAssets")}</dt>
                <dd>12</dd>
                <dd className="stat-note">{t("perPosition")}</dd>
              </div>
            </dl>
          </section>

          <section id="liquidity" className="features panel" aria-label={t("features")}>
            <article>
              <span className="line-icon" aria-hidden="true">
                <Image src="/assets/visual-direction/position.png" alt="" width={64} height={64} />
              </span>
              <h2>{t("ownPosition")}</h2>
              <p>{t("ownPositionDescription")}</p>
            </article>
            <article>
              <span className="line-icon" aria-hidden="true">
                <Image src="/assets/visual-direction/layers.png" alt="" width={64} height={64} />
              </span>
              <h2>{t("activeLiquidity")}</h2>
              <p>{t("activeLiquidityDescription")}</p>
            </article>
            <article>
              <span className="line-icon" aria-hidden="true">
                <Image src="/assets/visual-direction/liquidity.png" alt="" width={64} height={64} />
              </span>
              <h2>{t("deepLiquidity")}</h2>
              <p>{t("deepLiquidityDescription")}</p>
            </article>
            <article>
              <span className="line-icon" aria-hidden="true">
                <Image src="/assets/visual-direction/stakers.png" alt="" width={64} height={64} />
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
              {(
                ["creatorPrinciple", "staticsPrinciple", "lpPrinciple", "marketPrinciple"] as const
              ).map((key) => (
                <p key={key}>
                  <UtcClock /> <span>&gt;</span> {t(key)}
                </p>
              ))}
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
    </div>
  );
}
