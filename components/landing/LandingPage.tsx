import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { PlaceholderLink } from "./PlaceholderLink";
import { SiteHeader } from "./SiteHeader";
import { UtcClock } from "./UtcClock";

const volatilityCopy = {
  en: {
    heroDescription:
      "Every basket is a fixed bundle, always redeemable for exactly what is inside it. Markets move. Prices diverge. Arbitrage brings them back together. Every trade feeds permanent liquidity and real rewards.",
    basketsDescription:
      "Bundle 1 to 16 assets into one token. Trade it as a single position or redeem it for exactly what is inside. Fixed composition creates a hard anchor for arbitrage.",
    deepLiquidity: "Volatility builds liquidity",
    deepLiquidityDescription:
      "Prices move. Statics markets move with them. When prices diverge, arbitrageurs trade the gap. Those swaps generate fees, and a share of every swap becomes permanent protocol-owned liquidity. More volatility can mean more arbitrage, more volume, and deeper markets.",
    stakeEarn: "Earn from market activity",
    stakeEarnDescription:
      "Volatility creates trades. Trades generate fees. Stake and opt into up to 12 reward assets. Rewards are swap fees paid in kind: real revenue, not emissions.",
    tagline: "Markets move. Statics compounds.",
  },
  es: {
    heroDescription:
      "Cada cesta es un paquete fijo, siempre rescatable por exactamente lo que contiene. Los mercados se mueven. Los precios divergen. El arbitraje vuelve a alinearlos. Cada operación alimenta liquidez permanente y recompensas reales.",
    basketsDescription:
      "Agrupa entre 1 y 16 activos en un solo token. Opéralo como una única posición o rescátalo por exactamente lo que contiene. La composición fija crea un ancla sólida para el arbitraje.",
    deepLiquidity: "La volatilidad construye liquidez",
    deepLiquidityDescription:
      "Los precios se mueven. Los mercados de Statics se mueven con ellos. Cuando los precios divergen, los arbitrajistas operan la diferencia. Esas operaciones generan comisiones, y una parte de cada intercambio se convierte en liquidez permanente propiedad del protocolo. Más volatilidad puede significar más arbitraje, más volumen y mercados más profundos.",
    stakeEarn: "Gana con la actividad del mercado",
    stakeEarnDescription:
      "La volatilidad crea operaciones. Las operaciones generan comisiones. Haz staking y opta por hasta 12 activos de recompensa. Las recompensas son comisiones de intercambio pagadas en especie: ingresos reales, no emisiones.",
    tagline: "Los mercados se mueven. Statics acumula.",
  },
  "zh-CN": {
    heroDescription:
      "每个篮子都是固定资产组合，并且始终可以精确赎回其中的资产。市场会波动，价格会偏离，套利让它们重新对齐。每一笔交易都为永久流动性和真实奖励提供资金。",
    basketsDescription:
      "将 1 到 16 种资产组合成一个代币。可将其作为单一头寸交易，也可精确赎回篮子中的资产。固定组成，为套利提供明确锚点。",
    deepLiquidity: "波动构建流动性",
    deepLiquidityDescription:
      "价格会波动，Statics 市场随之变化。当价格出现偏离时，套利者会交易价差。这些交易产生费用，其中一部分会转化为协议永久持有的流动性。更高的波动可能带来更多套利、更多交易量和更深的市场。",
    stakeEarn: "从市场活动中赚取收益",
    stakeEarnDescription:
      "波动带来交易，交易产生费用。质押后最多可选择 12 种奖励资产。奖励以原资产形式支付，来自真实的交易费用，而非代币增发。",
    tagline: "市场在动，Statics 在积累。",
  },
} as const;

type LandingLocale = keyof typeof volatilityCopy;

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
  const [locale, t, tCommon, tNavigation] = await Promise.all([
    getLocale(),
    getTranslations("landing"),
    getTranslations("common"),
    getTranslations("navigation"),
  ]);
  const copy = volatilityCopy[locale as LandingLocale] ?? volatilityCopy.en;

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
            <p className="hero-description">{copy.heroDescription}</p>
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
            <p>{copy.basketsDescription}</p>
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
                <span>{t("spendableDollars")}</span>
              </li>
              <li>
                <strong>ethLEV</strong>
                <span>{t("leveragedEth")}</span>
              </li>
              <li>
                <strong>{t("closeOut")}</strong>
                <span>{t("whenCovered")}</span>
              </li>
              <li>
                <strong>{t("signOnce")}</strong>
                <span>{t("noApprovalTransaction")}</span>
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
            <h2>{copy.deepLiquidity}</h2>
            <p>{copy.deepLiquidityDescription}</p>
          </article>
          <article>
            <span className="line-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M12 44V20c0-4 3-7 7-7h10c4 0 7 3 7 7v24M19 13V7l5-3 5 3v6M8 24h8M32 24h8M19 21v23M29 21v23" />
                <circle cx="37" cy="9" r="5" />
              </svg>
            </span>
            <h2>{copy.stakeEarn}</h2>
            <p>{copy.stakeEarnDescription}</p>
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
            <p id="launch-title">{copy.tagline}</p>
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
